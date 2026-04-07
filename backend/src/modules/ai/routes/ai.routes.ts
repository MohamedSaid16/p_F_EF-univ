import { Router } from "express";
import { requireAuth, requireRole } from "../../../middlewares/auth.middleware";
import { chatHandler } from "../../../controllers/ai/ai.controller";

const router = Router();

router.post(
  "/chat",
  requireAuth,
  requireRole(["etudiant", "delegue", "enseignant", "admin", "vice_doyen", "membre_conseil", "president_conseil"]),
  chatHandler
);

export default router;