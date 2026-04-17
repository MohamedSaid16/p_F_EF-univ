import { Router } from "express";
import { requireAuth, requireRole } from "../../../middlewares/auth.middleware";

import {
  addMembreHandler,
  createConseilHandler,
  createDossierHandler,
  deleteConseilHandler,
  deleteDossierHandler,
  finaliserConseilHandler,
  getConseilHandler,
  getDisciplineStudentProfileHandler,
  getDossierHandler,
  listConseilsHandler,
  listDecisionsHandler,
  listDisciplineStudentsHandler,
  listDossiersHandler,
  listInfractionsHandler,
  listStaffHandler,
  recordDecisionHandler,
  removeMembreHandler,
  scheduleMeetingHandler,
  statsHandler,
  updateConseilHandler,
  updateDossierHandler,
} from "../../../controllers/discipline/discipline.controller";

const router = Router();

const readRoles = ["admin", "enseignant", "vice_doyen", "president_conseil"];
const writeRoles = ["admin", "enseignant"];

router.get("/conseils", requireAuth, requireRole(readRoles), listConseilsHandler);
router.get("/conseils/:id", requireAuth, requireRole(readRoles), getConseilHandler);
router.post("/conseils", requireAuth, requireRole(writeRoles), createConseilHandler);
router.patch("/conseils/:id", requireAuth, requireRole(writeRoles), updateConseilHandler);
router.delete("/conseils/:id", requireAuth, requireRole(writeRoles), deleteConseilHandler);
router.patch("/conseils/:id/finaliser", requireAuth, requireRole(writeRoles), finaliserConseilHandler);
router.post("/conseils/:cid/membres", requireAuth, requireRole(writeRoles), addMembreHandler);
router.delete("/conseils/:cid/membres/:mid", requireAuth, requireRole(writeRoles), removeMembreHandler);

router.get("/dossiers-disciplinaires", requireAuth, requireRole(readRoles), listDossiersHandler);
router.get("/cases", requireAuth, requireRole(readRoles), listDossiersHandler);
router.get("/dossiers-disciplinaires/:id", requireAuth, requireRole(readRoles), getDossierHandler);
router.get("/cases/:id", requireAuth, requireRole(readRoles), getDossierHandler);
router.post("/dossiers-disciplinaires", requireAuth, requireRole(writeRoles), createDossierHandler);
router.post("/cases", requireAuth, requireRole(writeRoles), createDossierHandler);
router.patch("/dossiers-disciplinaires/:id", requireAuth, requireRole(writeRoles), updateDossierHandler);
router.patch("/cases/:id", requireAuth, requireRole(writeRoles), updateDossierHandler);
router.delete("/dossiers-disciplinaires/:id", requireAuth, requireRole(writeRoles), deleteDossierHandler);
router.delete("/cases/:id", requireAuth, requireRole(writeRoles), deleteDossierHandler);

router.get("/infractions", requireAuth, requireRole(readRoles), listInfractionsHandler);
router.get("/decisions", requireAuth, requireRole(readRoles), listDecisionsHandler);
router.get("/students", requireAuth, requireRole(readRoles), listDisciplineStudentsHandler);
router.get("/students/:id/profile", requireAuth, requireRole(readRoles), getDisciplineStudentProfileHandler);
router.get("/staff", requireAuth, requireRole(readRoles), listStaffHandler);

router.post("/meetings", requireAuth, requireRole(writeRoles), scheduleMeetingHandler);
router.get("/meetings", requireAuth, requireRole(readRoles), listConseilsHandler);
router.post("/decisions", requireAuth, requireRole(writeRoles), recordDecisionHandler);
router.get("/stats", requireAuth, requireRole(readRoles), statsHandler);

export default router;
