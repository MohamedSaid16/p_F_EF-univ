import prisma from "../../config/database";
import logger from "../../utils/logger";

const subjectLabel = (subject: { titre_ar: string; titre_en?: string | null }) =>
  subject.titre_ar || subject.titre_en || `PFE-${subject.titre_ar}`;

const groupLabel = (group: { nom_ar: string; nom_en?: string | null }) =>
  group.nom_ar || group.nom_en || `Groupe ${group.nom_ar}`;

export const getTeacherPFECourses = async (teacherId: number) => {
  try {
    const courses = await prisma.pfeSujet.findMany({
      where: { enseignantId: teacherId },
      orderBy: { titre_ar: "asc" },
      select: {
        id: true,
        titre_ar: true,
        titre_en: true,
        anneeUniversitaire: true,
      },
    });

    return courses.map((course) => ({
      id: course.id,
      name: subjectLabel(course),
      code: `PFE-${course.id}`,
      promo: course.anneeUniversitaire ?? "N/A",
    }));
  } catch (error) {
    logger.error("Error fetching teacher PFE courses:", error);
    throw error;
  }
};

export const getGroupsByPFECourse = async (courseId: number) => {
  try {
    const groups = await prisma.groupPfe.findMany({
      where: { sujetFinalId: courseId },
      include: {
        groupMembers: {
          select: { id: true },
        },
      },
      orderBy: { nom_ar: "asc" },
    });

    return groups.map((group) => ({
      id: group.id,
      nom: groupLabel(group),
      studentCount: group.groupMembers.length,
    }));
  } catch (error) {
    logger.error("Error fetching groups by PFE course:", error);
    throw error;
  }
};
