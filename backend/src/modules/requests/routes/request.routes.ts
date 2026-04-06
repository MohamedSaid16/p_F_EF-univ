import fs from "fs";
import multer from "multer";
import path from "path";
import { Router } from "express";
import {
  createReclamation,
  getMyReclamations,
  createJustification,
  getMyJustifications,
  getReclamationTypes,
  getJustificationTypes,
  getAdminRequestsInbox,
  decideReclamation,
  decideJustification,
  getAdminRequestWorkflowHistory,
} from "../../../controllers/requests/request.controller";
import { requireAuth, requireRole } from "../../../middlewares/auth.middleware";
import {
  validateReclamation,
  validateJustification,
} from "../validators/request.validator";

const router = Router();

const studentRequestUploadPath = path.join(process.cwd(), "uploads", "student-requests");
if (!fs.existsSync(studentRequestUploadPath)) {
  fs.mkdirSync(studentRequestUploadPath, { recursive: true });
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
  "application/zip",
  "application/x-zip-compressed",
]);

const studentRequestUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, studentRequestUploadPath);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      callback(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 8,
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

    if (allowedMimeTypes.has((file.mimetype || "").toLowerCase()) || hasKnownExtension) {
      callback(null, true);
      return;
    }

    callback(new Error("Unsupported file type for request attachments"));
  },
});

// ── Types (pour remplir les selects du formulaire) ──────────
router.get("/types/reclamations", getReclamationTypes);
router.get("/types/justifications", getJustificationTypes);

// ── Reclamations ────────────────────────────────────────────
router.post(
  "/reclamations",
  requireAuth,
  studentRequestUpload.array("files", 8),
  validateReclamation,
  createReclamation
);
router.get("/reclamations", requireAuth, getMyReclamations);

// ── Justifications ──────────────────────────────────────────
router.post(
  "/justifications",
  requireAuth,
  studentRequestUpload.array("files", 8),
  validateJustification,
  createJustification
);
router.get("/justifications", requireAuth, getMyJustifications);

// ── Admin processing ────────────────────────────────────────
router.get("/admin/inbox", requireAuth, requireRole(["admin", "vice_doyen"]), getAdminRequestsInbox);
router.post("/admin/reclamations/:id/decision", requireAuth, requireRole(["admin", "vice_doyen"]), decideReclamation);
router.post("/admin/justifications/:id/decision", requireAuth, requireRole(["admin", "vice_doyen"]), decideJustification);
router.get("/admin/:category/:id/workflow", requireAuth, requireRole(["admin", "vice_doyen"]), getAdminRequestWorkflowHistory);

export default router;