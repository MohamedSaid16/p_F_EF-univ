import { Prisma } from "@prisma/client";
import prisma from "../../config/database";
import {
  emitNotificationToUser,
  emitUnreadCountToUser,
} from "../../realtime/socket.server";
import logger from "../../utils/logger";

export interface NotificationData {
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  read?: boolean;
}

interface StoredNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type NotificationRow = {
  id: bigint | number;
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata: Prisma.JsonValue | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};

let notificationsTableInitialized = false;
let notificationsInitPromise: Promise<void> | null = null;

const toNumber = (value: bigint | number): number =>
  typeof value === "bigint" ? Number(value) : value;

const parseMetadata = (raw: Prisma.JsonValue | null): Record<string, unknown> | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  return raw as Record<string, unknown>;
};

const mapNotificationRow = (row: NotificationRow): StoredNotification => ({
  id: toNumber(row.id),
  userId: row.userId,
  type: row.type,
  title: row.title,
  message: row.message,
  metadata: parseMetadata(row.metadata),
  read: Boolean(row.read),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureNotificationsTable = async (): Promise<void> => {
  if (notificationsTableInitialized) {
    return;
  }

  if (!notificationsInitPromise) {
    notificationsInitPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS user_notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(120) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
        ON user_notifications(user_id, created_at DESC)
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read
        ON user_notifications(user_id, is_read)
      `);

      notificationsTableInitialized = true;
    })()
      .catch((error) => {
        notificationsTableInitialized = false;
        logger.error("Error initializing notifications table:", error);
        throw error;
      })
      .finally(() => {
        notificationsInitPromise = null;
      });
  }

  await notificationsInitPromise;
};

const pushRealtimeUnreadCount = async (userId: number): Promise<void> => {
  try {
    const unreadCount = await getUnreadCount(userId);
    emitUnreadCountToUser(userId, unreadCount);
  } catch (error) {
    logger.warn("Unable to push realtime unread notification count", error);
  }
};

const getMetadataSqlValue = (metadata: Record<string, unknown> | undefined) =>
  metadata ? Prisma.sql`CAST(${JSON.stringify(metadata)} AS JSONB)` : Prisma.sql`NULL`;

export const createNotification = async (data: NotificationData) => {
  await ensureNotificationsTable();

  try {
    const rows = await prisma.$queryRaw<NotificationRow[]>(Prisma.sql`
      INSERT INTO user_notifications (
        user_id,
        type,
        title,
        message,
        metadata,
        is_read,
        created_at,
        updated_at
      )
      VALUES (
        ${data.userId},
        ${data.type},
        ${data.title},
        ${data.message},
        ${getMetadataSqlValue(data.metadata)},
        ${Boolean(data.read)},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        user_id AS "userId",
        type,
        title,
        message,
        metadata,
        is_read AS "read",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);

    if (!rows.length) {
      throw new Error("Unable to create notification");
    }

    const notification = mapNotificationRow(rows[0]);

    emitNotificationToUser(notification.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      read: notification.read,
      createdAt: notification.createdAt,
    });

    void pushRealtimeUnreadCount(notification.userId);
    return notification;
  } catch (error) {
    logger.error("Error creating notification:", error);
    throw error;
  }
};

export const getUserNotifications = async (
  userId: number,
  skip?: number,
  take?: number
) => {
  await ensureNotificationsTable();

  const _skip = skip ?? 0;
  const _take = take ?? 10;

  try {
    const [countRows, rows] = await Promise.all([
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::INT AS total
        FROM user_notifications
        WHERE user_id = ${userId}
      `),
      prisma.$queryRaw<NotificationRow[]>(Prisma.sql`
        SELECT
          id,
          user_id AS "userId",
          type,
          title,
          message,
          metadata,
          is_read AS "read",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM user_notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC, id DESC
        OFFSET ${_skip}
        LIMIT ${_take}
      `),
    ]);

    const total = Number(countRows[0]?.total || 0);
    const notifications = rows.map(mapNotificationRow);

    return {
      notifications,
      total,
      pages: Math.ceil(total / _take),
      currentPage: Math.floor(_skip / _take) + 1,
    };
  } catch (error) {
    logger.error("Error fetching user notifications:", error);
    throw error;
  }
};

export const markAsRead = async (notificationId: number) => {
  await ensureNotificationsTable();

  try {
    const rows = await prisma.$queryRaw<NotificationRow[]>(Prisma.sql`
      UPDATE user_notifications
      SET is_read = TRUE,
          updated_at = NOW()
      WHERE id = ${notificationId}
      RETURNING
        id,
        user_id AS "userId",
        type,
        title,
        message,
        metadata,
        is_read AS "read",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);

    if (!rows.length) {
      throw new Error("Notification not found");
    }

    const updated = mapNotificationRow(rows[0]);
    void pushRealtimeUnreadCount(updated.userId);
    return updated;
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    throw error;
  }
};

export const markAllAsRead = async (userId: number) => {
  await ensureNotificationsTable();

  try {
    const count = await prisma.$executeRaw(Prisma.sql`
      UPDATE user_notifications
      SET is_read = TRUE,
          updated_at = NOW()
      WHERE user_id = ${userId}
        AND is_read = FALSE
    `);

    emitUnreadCountToUser(userId, 0);
    return { count };
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    throw error;
  }
};

export const deleteNotification = async (notificationId: number) => {
  await ensureNotificationsTable();

  try {
    const rows = await prisma.$queryRaw<NotificationRow[]>(Prisma.sql`
      DELETE FROM user_notifications
      WHERE id = ${notificationId}
      RETURNING
        id,
        user_id AS "userId",
        type,
        title,
        message,
        metadata,
        is_read AS "read",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);

    if (!rows.length) {
      throw new Error("Notification not found");
    }

    const removed = mapNotificationRow(rows[0]);
    void pushRealtimeUnreadCount(removed.userId);
    return removed;
  } catch (error) {
    logger.error("Error deleting notification:", error);
    throw error;
  }
};

export const deleteAllNotifications = async (userId: number) => {
  await ensureNotificationsTable();

  try {
    const count = await prisma.$executeRaw(Prisma.sql`
      DELETE FROM user_notifications
      WHERE user_id = ${userId}
    `);

    emitUnreadCountToUser(userId, 0);
    return { count };
  } catch (error) {
    logger.error("Error deleting all notifications:", error);
    throw error;
  }
};

export const getUnreadCount = async (userId: number): Promise<number> => {
  await ensureNotificationsTable();

  try {
    const rows = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::INT AS total
      FROM user_notifications
      WHERE user_id = ${userId}
        AND is_read = FALSE
    `);

    return Number(rows[0]?.total || 0);
  } catch (error) {
    logger.error("Error getting unread notifications count:", error);
    throw error;
  }
};

export const getNotificationByIdForUser = async (
  userId: number,
  notificationId: number
): Promise<StoredNotification | null> => {
  await ensureNotificationsTable();

  const rows = await prisma.$queryRaw<NotificationRow[]>(Prisma.sql`
    SELECT
      id,
      user_id AS "userId",
      type,
      title,
      message,
      metadata,
      is_read AS "read",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM user_notifications
    WHERE id = ${notificationId}
      AND user_id = ${userId}
    LIMIT 1
  `);

  if (!rows.length) {
    return null;
  }

  return mapNotificationRow(rows[0]);
};

export const broadcastNotification = async (
  userIds: number[],
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  try {
    const uniqueUserIds = Array.from(
      new Set(userIds.map((userId) => Number(userId)).filter((userId) => Number.isInteger(userId) && userId > 0))
    );

    const created = await Promise.all(
      uniqueUserIds.map((userId) =>
        createNotification({ userId, type, title, message, metadata, read: false })
      )
    );

    return {
      count: created.length,
    };
  } catch (error) {
    logger.error("Error broadcasting notifications:", error);
    throw error;
  }
};
