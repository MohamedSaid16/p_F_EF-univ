import { Request, Response } from "express";
import {
  getTeacherPFECourses,
  getGroupsByPFECourse,
} from "../../services/pfe/pfe-assignment.service";
import { getPFEStats, getPFESubjectById, getPFESubjects } from "../../services/pfe/pfe.service";
import logger from "../../utils/logger";

export const getPFEStatsHandler = async (_req: Request, res: Response) => {
  try {
    const stats = await getPFEStats();

    return res.status(200).json({
      data: stats,
    });
  } catch (error: any) {
    logger.error("Error in getPFEStatsHandler:", error);
    return res.status(500).json({
      error: error?.message || "Failed to fetch PFE stats",
    });
  }
};

export const getPFESubjectsHandler = async (req: Request, res: Response) => {
  try {
    const promoId = req.query.promoId ? parseInt(String(req.query.promoId), 10) : undefined;
    const enseignantId = req.query.enseignantId ? parseInt(String(req.query.enseignantId), 10) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const subjects = await getPFESubjects({
      promoId: promoId && !Number.isNaN(promoId) ? promoId : undefined,
      enseignantId: enseignantId && !Number.isNaN(enseignantId) ? enseignantId : undefined,
      status,
    });

    return res.status(200).json({
      data: subjects,
      count: subjects.length,
    });
  } catch (error: any) {
    logger.error("Error in getPFESubjectsHandler:", error);
    return res.status(500).json({
      error: error?.message || "Failed to fetch PFE subjects",
    });
  }
};

export const getPFESubjectByIdHandler = async (req: Request, res: Response) => {
  try {
    const subjectId = parseInt(String(req.params.subjectId), 10);

    if (!subjectId || Number.isNaN(subjectId)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const subject = await getPFESubjectById(subjectId);

    return res.status(200).json({
      data: subject,
    });
  } catch (error: any) {
    logger.error("Error in getPFESubjectByIdHandler:", error);
    return res.status(500).json({
      error: error?.message || "Failed to fetch PFE subject",
    });
  }
};

export const getTeacherCoursesHandler = async (req: Request, res: Response) => {
  try {
    const teacherId = parseInt(String(req.params.teacherId), 10);

    if (!teacherId || Number.isNaN(teacherId)) {
      return res.status(400).json({ error: "Invalid teacher ID" });
    }

    const courses = await getTeacherPFECourses(teacherId);

    return res.status(200).json({
      data: courses,
      count: courses.length,
    });
  } catch (error: any) {
    logger.error("Error in getTeacherCoursesHandler:", error);
    return res.status(500).json({
      error: error?.message || "Failed to fetch teacher courses",
    });
  }
};

export const getCourseGroupsHandler = async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(String(req.params.courseId), 10);

    if (!courseId || Number.isNaN(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const groups = await getGroupsByPFECourse(courseId);

    return res.status(200).json({
      data: groups,
      count: groups.length,
    });
  } catch (error: any) {
    logger.error("Error in getCourseGroupsHandler:", error);
    return res.status(500).json({
      error: error?.message || "Failed to fetch course groups",
    });
  }
};
