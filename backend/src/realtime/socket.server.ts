import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer, Socket } from "socket.io";
import prisma from "../config/database";
import { ACCESS_TOKEN_COOKIE_NAME, JWT_ACCESS_SECRET } from "../config/auth";
import logger from "../utils/logger";

type RealtimeSocketUser = {
  id: number;
  email: string;
  roles: string[];
};

type NotificationRealtimePayload = {
  id: number;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
};

type ServerToClientEvents = {
  "realtime:connected": (payload: { userId: number }) => void;
  "notifications:new": (payload: NotificationRealtimePayload) => void;
  "notifications:unread-count": (payload: { unreadCount: number }) => void;
};

type ClientToServerEvents = {
  "notifications:subscribe": () => void;
};

type SocketData = {
  user?: RealtimeSocketUser;
};

type RealtimeSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

type AccessTokenPayload = {
  sub: number;
  email: string;
  roles?: string[];
};

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

const configuredOrigins = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localhostDevOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

const getUserRoom = (userId: number) => `user:${userId}`;

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, chunk) => {
    const [rawKey, ...rawValueParts] = chunk.split("=");
    const key = rawKey?.trim();
    if (!key) {
      return acc;
    }

    const value = rawValueParts.join("=").trim();
    acc[key] = decodeURIComponent(value || "");
    return acc;
  }, {});
};

const extractToken = (socket: RealtimeSocket): string | null => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === "string") {
    const parts = authorization.split(" ");
    if (parts.length === 2 && /^bearer$/i.test(parts[0]) && parts[1]) {
      return parts[1].trim();
    }
  }

  const cookies = parseCookies(socket.handshake.headers.cookie);
  const cookieToken = cookies[ACCESS_TOKEN_COOKIE_NAME];
  if (cookieToken?.trim()) {
    return cookieToken.trim();
  }

  return null;
};

const authenticateSocket = async (socket: RealtimeSocket): Promise<RealtimeSocketUser> => {
  const token = extractToken(socket);
  if (!token) {
    throw new Error("UNAUTHORIZED");
  }

  const payload = jwt.verify(token, JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
  if (!payload?.sub || !payload.email) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      status: true,
      userRoles: {
        select: {
          role: {
            select: {
              nom: true,
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "active") {
    throw new Error("UNAUTHORIZED");
  }

  const roleNames = user.userRoles
    .map((entry) => entry.role?.nom)
    .filter((roleName): roleName is string => Boolean(roleName));

  return {
    id: user.id,
    email: user.email,
    roles: roleNames,
  };
};

export const initializeRealtimeServer = (
  server: HttpServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents> => {
  if (io) {
    return io;
  }

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (configuredOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        if (process.env.NODE_ENV !== "production" && localhostDevOriginRegex.test(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    authenticateSocket(socket)
      .then((user) => {
        socket.data.user = user;
        next();
      })
      .catch(() => {
        next(new Error("UNAUTHORIZED"));
      });
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(getUserRoom(user.id));
    socket.emit("realtime:connected", { userId: user.id });

    socket.on("notifications:subscribe", () => {
      socket.join(getUserRoom(user.id));
    });
  });

  logger.info("Realtime websocket server initialized");
  return io;
};

export const emitNotificationToUser = (userId: number, payload: NotificationRealtimePayload): void => {
  if (!io) {
    return;
  }

  io.to(getUserRoom(userId)).emit("notifications:new", payload);
};

export const emitUnreadCountToUser = (userId: number, unreadCount: number): void => {
  if (!io) {
    return;
  }

  io.to(getUserRoom(userId)).emit("notifications:unread-count", { unreadCount });
};
