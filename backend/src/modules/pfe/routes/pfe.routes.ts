import { Router } from "express";
import { requireAuth, requireRole } from "../../../middlewares/auth.middleware";
import {
  getPFEStatsHandler,
  getPFESubjectByIdHandler,
  getPFESubjectsHandler,
  getTeacherCoursesHandler,
  getCourseGroupsHandler,
} from "../../../controllers/pfe/pfe.controller";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  requireRole(["admin", "vice_doyen", "enseignant", "etudiant", "delegue"]),
  getPFEStatsHandler
);

router.get(
  "/subjects",
  requireAuth,
  requireRole(["admin", "vice_doyen", "enseignant", "etudiant", "delegue", "membre_conseil", "president_conseil"]),
  getPFESubjectsHandler
);

router.get(
  "/subjects/:subjectId",
  requireAuth,
  requireRole(["admin", "vice_doyen", "enseignant", "etudiant", "delegue", "membre_conseil", "president_conseil"]),
  getPFESubjectByIdHandler
);

router.get(
  "/teacher/:teacherId/courses",
  requireAuth,
  requireRole(["admin", "vice_doyen", "enseignant"]),
  getTeacherCoursesHandler
);

router.get(
  "/course/:courseId/groups",
  requireAuth,
  requireRole(["admin", "vice_doyen", "enseignant"]),
  getCourseGroupsHandler
);

export default router;
