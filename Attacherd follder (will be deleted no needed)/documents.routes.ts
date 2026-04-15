import { Router } from "express";
import {
  createDocumentType,
  createRequest,
  deleteDocument,
  downloadDocument,
  getAllRequests,
  getDocumentTypes,
  getMyRequests,
  uploadDocument,
  validerDocument,
} from "../../../controllers/documents/documents.controller";
import { requireAuth, requireRole } from "../../../middlewares/auth.middleware";
import upload from "../../../middlewares/upload.middleware";

const router = Router();

// Publique — types de documents (pour le select frontend)
router.get("/", getDocumentTypes);

// Enseignant — ses propres demandes
router.get("/my-requests", requireAuth, requireRole(["enseignant", "admin"]), getMyRequests);

// Admin — toutes les demandes de tous les enseignants
router.get("/all-requests", requireAuth, requireRole(["admin"]), getAllRequests);

// Enseignant — soumettre une demande
router.post("/request", requireAuth, requireRole(["enseignant", "admin"]), createRequest);

// Admin — upload du fichier
router.post("/upload", requireAuth, requireRole(["admin"]), upload.single("file"), uploadDocument);

// Admin — valider ou refuser
router.patch("/:id/valider", requireAuth, requireRole(["admin"]), validerDocument);

// Admin — créer un type de document
router.post("/type", requireAuth, requireRole(["admin"]), createDocumentType);

// Enseignant ou admin — télécharger
router.get("/download/:id", requireAuth, downloadDocument);

// Enseignant ou admin — supprimer
router.delete("/:id", requireAuth, deleteDocument);

export default router;
