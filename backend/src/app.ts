import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./modules/auth/routes/auth.routes";
import teacherDashboardRoutes from "./modules/dashboard/routes/teacher-dashboard.routes";
import requestRoutes from "./modules/requests/routes/request.routes";
import documentsRoutes from "./modules/documents/routes/documents.routes";
import studentRoutes from "./modules/student/routes/student.routes";
import groupManagementRoutes from "./modules/pfe/routes/group-management.routes";
import pfeRoutes from "./modules/pfe/routes/pfe.routes";
import disciplineRoutes from "./modules/discipline/routes/discipline.routes";
import affectationRoutes from "./modules/affectation/routes/affectation.routes";
import notificationRoutes from "./modules/notifications/routes/notification.routes";
import messageRoutes from "./modules/messages/routes/message.routes";
import adminRoutes from "./modules/admin/routes/admin.routes";
import teacherRoutes from "./modules/teacher/routes/teacher.routes";
import actualitesRoutes from "./modules/actualites/routes/actualites.routes";
import aiRoutes from "./modules/ai/routes/ai.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

const configuredOrigins = (
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:3000,http://localhost:3001"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localhostDevOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV !== "production" && localhostDevOriginRegex.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "University API Running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/dashboard", teacherDashboardRoutes);
app.use("/api/v1/requests", requestRoutes);
app.use("/api/v1/documents", documentsRoutes);
app.use("/api/v1/student", studentRoutes);
app.use("/api/v1/pfe", pfeRoutes);
app.use("/api/v1/pfe/groups", groupManagementRoutes);
app.use("/api/v1/cd", disciplineRoutes);
app.use("/api/v1/disciplinary", disciplineRoutes);
app.use("/api/v1/affectation", affectationRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/teacher", teacherRoutes);
app.use("/api/v1/actualites", actualitesRoutes);
app.use("/api/v1/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
