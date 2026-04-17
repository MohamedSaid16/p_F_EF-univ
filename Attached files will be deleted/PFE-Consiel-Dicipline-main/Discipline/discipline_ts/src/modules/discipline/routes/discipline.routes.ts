// src/modules/discipline/routes/discipline.routes.ts
import { Router } from "express";
import { requireAuth }  from "../../../middleware/auth.middleware";
import { requireRole }  from "../../../middleware/role.middleware";

import {
  getAllInfractions, getInfractionById,
  createInfraction,  updateInfraction, deleteInfraction,
} from "../controllers/infraction.controller";

import {
  getAllDecisions, getDecisionById,
  createDecision, updateDecision, deleteDecision,
} from "../controllers/decision.controller";

import {
  getAllConseils,   getConseilById,
  createConseil,    updateConseil,   deleteConseil,
  finaliserConseil, addMembre,       removeMembre,
} from "../controllers/conseil.controller";

import {
  getAllDossiers, getDossierById,
  createDossier,  updateDossier,  deleteDossier,
} from "../controllers/dossier.controller";

const router = Router();

// All discipline routes require authentication
router.use(requireAuth);

// ── Only admin and president_conseil can access ───────────────
const canAccess = requireRole(["admin", "president_conseil"]);

// ── Infractions ───────────────────────────────────────────────
router.get   ("/infractions",      canAccess, getAllInfractions);
router.get   ("/infractions/:id",  canAccess, getInfractionById);
router.post  ("/infractions",      canAccess, createInfraction);
router.put   ("/infractions/:id",  canAccess, updateInfraction);
router.delete("/infractions/:id",  canAccess, deleteInfraction);

// ── Décisions ─────────────────────────────────────────────────
router.get   ("/decisions",        canAccess, getAllDecisions);
router.get   ("/decisions/:id",    canAccess, getDecisionById);
router.post  ("/decisions",        canAccess, createDecision);
router.put   ("/decisions/:id",    canAccess, updateDecision);
router.delete("/decisions/:id",    canAccess, deleteDecision);

// ── Conseils disciplinaires ───────────────────────────────────
router.get   ("/conseils",                         canAccess, getAllConseils);
router.get   ("/conseils/:id",                     canAccess, getConseilById);
router.post  ("/conseils",                         canAccess, createConseil);
router.patch ("/conseils/:id",                     canAccess, updateConseil);
router.delete("/conseils/:id",                     canAccess, deleteConseil);
router.patch ("/conseils/:id/finaliser",           canAccess, finaliserConseil);
router.post  ("/conseils/:id/membres",             canAccess, addMembre);
router.delete("/conseils/:id/membres/:membreId",   canAccess, removeMembre);

// ── Dossiers disciplinaires ───────────────────────────────────
router.get   ("/dossiers-disciplinaires",      canAccess, getAllDossiers);
router.get   ("/dossiers-disciplinaires/:id",  canAccess, getDossierById);
router.post  ("/dossiers-disciplinaires",      canAccess, createDossier);
router.patch ("/dossiers-disciplinaires/:id",  canAccess, updateDossier);
router.delete("/dossiers-disciplinaires/:id",  canAccess, deleteDossier);

export default router;
