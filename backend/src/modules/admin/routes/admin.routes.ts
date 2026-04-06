import fs from "fs";
import multer from "multer";
import path from "path";
import { Router } from "express";
import {
  createAdminAnnouncementHandler,
  deleteAdminAnnouncementHandler,
  deleteAdminDocumentHandler,
  deleteAdminUserHandler,
  downloadAdminDocumentHandler,
  getAdminDashboardOverviewHandler,
  listAdminAnnouncementsHandler,
  listAdminDocumentsHandler,
  listAdminReclamationsHandler,
  listAdminUsersHandler,
  updateAdminAnnouncementHandler,
  updateAdminReclamationHandler,
  updateAdminUserRoleHandler,
} from "../../../controllers/admin/admin.controller";
import { listAdminAuditLogsHandler } from "../../../controllers/admin/audit.controller";
import { requireAnyPermission, requireAuth, requireRole } from "../../../middlewares/auth.middleware";

const router = Router();

const announcementUploadPath = path.join(process.cwd(), "uploads", "announcements");
if (!fs.existsSync(announcementUploadPath)) {
  fs.mkdirSync(announcementUploadPath, { recursive: true });
}

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const announcementUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, announcementUploadPath);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const hasKnownExtension = [
      ".pdf",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".gif",
      ".doc",
      ".docx",
      ".txt",
    ].includes(extension);

    if (allowedMimeTypes.has((file.mimetype || "").toLowerCase()) || hasKnownExtension) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported file type for announcement attachments"));
  },
});

router.use(requireAuth, requireRole(["admin", "vice_doyen"]));

router.get("/dashboard/overview", requireAnyPermission(["users:manage"]), getAdminDashboardOverviewHandler);
router.get("/audit-logs", requireAnyPermission(["users:manage", "reclamations:manage:global"]), listAdminAuditLogsHandler);

router.get("/users", requireAnyPermission(["users:manage"]), listAdminUsersHandler);
router.patch("/users/:userId/role", requireAnyPermission(["users:manage", "roles:assign"]), updateAdminUserRoleHandler);
router.delete("/users/:userId", requireAnyPermission(["users:manage"]), deleteAdminUserHandler);

router.get("/announcements", requireAnyPermission(["announcements:manage:global"]), listAdminAnnouncementsHandler);
router.post("/announcements", requireAnyPermission(["announcements:manage:global"]), announcementUpload.array("files", 10), createAdminAnnouncementHandler);
router.patch("/announcements/:id", requireAnyPermission(["announcements:manage:global"]), announcementUpload.array("files", 10), updateAdminAnnouncementHandler);
router.delete("/announcements/:id", requireAnyPermission(["announcements:manage:global"]), deleteAdminAnnouncementHandler);

router.get("/reclamations", requireAnyPermission(["reclamations:manage:global"]), listAdminReclamationsHandler);
router.patch("/reclamations/:id/status", requireAnyPermission(["reclamations:manage:global"]), updateAdminReclamationHandler);

router.get("/documents", requireAnyPermission(["users:manage", "reclamations:manage:global"]), listAdminDocumentsHandler);
router.get("/documents/:kind/:id/download", requireAnyPermission(["users:manage", "reclamations:manage:global"]), downloadAdminDocumentHandler);
router.delete("/documents/:kind/:id", requireAnyPermission(["users:manage", "reclamations:manage:global"]), deleteAdminDocumentHandler);

export default router;
