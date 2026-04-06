import fs from "fs";
import multer from "multer";
import path from "path";
import { Router } from "express";
import {
  changeTeacherPasswordHandler,
  createTeacherAnnouncementHandler,
  createTeacherDocumentHandler,
  deleteTeacherAnnouncementHandler,
  deleteTeacherDocumentHandler,
  downloadTeacherDocumentHandler,
  getTeacherDashboardHandler,
  getTeacherProfileHandler,
  getTeacherStudentReclamationHistoryHandler,
  listTeacherAnnouncementsHandler,
  listTeacherDocumentsHandler,
  listTeacherReclamationsHandler,
  listTeacherStudentsHandler,
  updateTeacherAnnouncementHandler,
  updateTeacherDocumentHandler,
  updateTeacherProfileHandler,
  updateTeacherReclamationHandler,
} from "../../../controllers/teacher/teacher.controller";
import { requireAnyPermission, requireAuth, requireRole } from "../../../middlewares/auth.middleware";

const router = Router();

const announcementsUploadPath = path.join(process.cwd(), "uploads", "teacher-announcements");
const documentsUploadPath = path.join(process.cwd(), "uploads", "teacher-documents");

if (!fs.existsSync(announcementsUploadPath)) {
  fs.mkdirSync(announcementsUploadPath, { recursive: true });
}

if (!fs.existsSync(documentsUploadPath)) {
  fs.mkdirSync(documentsUploadPath, { recursive: true });
}

const allowedAnnouncementMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

const allowedDocumentMimeTypes = new Set([
  ...allowedAnnouncementMimeTypes,
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const createDiskStorage = (destination: string) =>
  multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, destination);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      callback(null, uniqueName);
    },
  });

const teacherAnnouncementUpload = multer({
  storage: createDiskStorage(announcementsUploadPath),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, callback) => {
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
      ".zip",
    ].includes(extension);

    if (allowedAnnouncementMimeTypes.has((file.mimetype || "").toLowerCase()) || hasKnownExtension) {
      callback(null, true);
      return;
    }

    callback(new Error("Unsupported file type for announcement attachments"));
  },
});

const teacherDocumentUpload = multer({
  storage: createDiskStorage(documentsUploadPath),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
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
      ".zip",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
    ].includes(extension);

    if (allowedDocumentMimeTypes.has((file.mimetype || "").toLowerCase()) || hasKnownExtension) {
      callback(null, true);
      return;
    }

    callback(new Error("Unsupported file type for document uploads"));
  },
});

router.use(requireAuth, requireRole(["enseignant"]));

router.get("/dashboard", requireAnyPermission(["announcements:manage:course", "students:view:course", "reclamations:view:course"]), getTeacherDashboardHandler);

router.get("/announcements", requireAnyPermission(["announcements:manage:course"]), listTeacherAnnouncementsHandler);
router.post(
  "/announcements",
  requireAnyPermission(["announcements:manage:course"]),
  teacherAnnouncementUpload.array("files", 10),
  createTeacherAnnouncementHandler
);
router.patch(
  "/announcements/:id",
  requireAnyPermission(["announcements:manage:course"]),
  teacherAnnouncementUpload.array("files", 10),
  updateTeacherAnnouncementHandler
);
router.delete("/announcements/:id", requireAnyPermission(["announcements:manage:course"]), deleteTeacherAnnouncementHandler);

router.get("/reclamations", requireAnyPermission(["reclamations:view:course"]), listTeacherReclamationsHandler);
router.patch("/reclamations/:id/status", requireAnyPermission(["reclamations:update-status:course", "reclamations:respond:course"]), updateTeacherReclamationHandler);

router.get("/students", requireAnyPermission(["students:view:course"]), listTeacherStudentsHandler);
router.get("/students/:studentId/reclamations", requireAnyPermission(["students:view:course"]), getTeacherStudentReclamationHistoryHandler);

router.get("/documents", requireAnyPermission(["documents:manage:course"]), listTeacherDocumentsHandler);
router.post("/documents", requireAnyPermission(["documents:manage:course"]), teacherDocumentUpload.single("file"), createTeacherDocumentHandler);
router.patch("/documents/:id", requireAnyPermission(["documents:manage:course"]), teacherDocumentUpload.single("file"), updateTeacherDocumentHandler);
router.delete("/documents/:id", requireAnyPermission(["documents:manage:course"]), deleteTeacherDocumentHandler);
router.get("/documents/:id/download", requireAnyPermission(["documents:manage:course"]), downloadTeacherDocumentHandler);

router.get("/profile", requireAnyPermission(["profile:manage:self"]), getTeacherProfileHandler);
router.patch("/profile", requireAnyPermission(["profile:manage:self"]), updateTeacherProfileHandler);
router.post("/profile/change-password", requireAnyPermission(["password:change:self"]), changeTeacherPasswordHandler);

export default router;
