import prisma from "../../config/database";
import { Prisma, RoleJury, StatusSujet } from "@prisma/client";
import logger from "../../utils/logger";

const toNumber = (value: Prisma.Decimal | null | undefined): number => {
  if (value == null) return 0;
  return Number(value);
};

export interface CreatePFESubjectInput {
  titreAr: string;
  titreEn?: string;
  descriptionAr: string;
  descriptionEn?: string;
  keywordsAr?: string;
  keywordsEn?: string;
  workplanAr?: string;
  workplanEn?: string;
  bibliographieAr?: string;
  bibliographieEn?: string;
  typeProjet?: string;
  maxGrps?: number;
  promoId?: number;
  enseignantId: number;
}

export interface UpdatePFESubjectInput {
  titreAr?: string;
  titreEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  keywordsAr?: string;
  keywordsEn?: string;
  workplanAr?: string;
  workplanEn?: string;
  bibliographieAr?: string;
  bibliographieEn?: string;
  typeProjet?: string;
  status?: string;
  maxGrps?: number;
}

export interface AssignStudentsInput {
  groupId: number;
  studentIds: number[];
}

export interface ScheduleDefenseInput {
  groupId: number;
  dateSoutenance: Date;
  lieu?: string;
  notes?: string;
}

const resolveStatusSujet = (value?: string): StatusSujet | undefined => {
  if (!value) return undefined;
  const allowed = Object.values(StatusSujet);
  return allowed.includes(value as StatusSujet) ? (value as StatusSujet) : undefined;
};

const resolveTypeProjet = (value?: string) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const allowed = new Set(["application", "recherche", "innovation", "etude"]);
  return allowed.has(normalized) ? normalized : undefined;
};

export const createPFESubject = async (input: CreatePFESubjectInput) => {
  try {
    if (!input.promoId) {
      throw new Error("promoId is required");
    }

    const subject = await prisma.pfeSujet.create({
      data: {
        titre_ar: input.titreAr,
        titre_en: input.titreEn ?? null,
        description_ar: input.descriptionAr,
        description_en: input.descriptionEn ?? null,
        keywords_ar: input.keywordsAr ?? null,
        keywords_en: input.keywordsEn ?? null,
        workplan_ar: input.workplanAr ?? null,
        workplan_en: input.workplanEn ?? null,
        bibliographie_ar: input.bibliographieAr ?? null,
        bibliographie_en: input.bibliographieEn ?? null,
        typeProjet: resolveTypeProjet(input.typeProjet) as any,
        enseignantId: input.enseignantId,
        promoId: input.promoId,
        status: StatusSujet.propose,
        anneeUniversitaire: new Date().getFullYear().toString(),
        maxGrps: input.maxGrps ?? 1,
      },
      include: {
        enseignant: {
          include: { user: true },
        },
        promo: true,
      },
    });

    logger.info(`PFE Subject created: ${subject.id}`);
    return subject;
  } catch (error) {
    logger.error("Error creating PFE subject:", error);
    throw error;
  }
};

export const getPFESubjects = async (filters?: {
  promoId?: number;
  enseignantId?: number;
  status?: string;
}) => {
  try {
    const where: Prisma.PfeSujetWhereInput = {};

    if (filters?.promoId) where.promoId = filters.promoId;
    if (filters?.enseignantId) where.enseignantId = filters.enseignantId;

    const status = resolveStatusSujet(filters?.status);
    if (status) where.status = status;

    return await prisma.pfeSujet.findMany({
      where,
      include: {
        enseignant: {
          include: { user: true },
        },
        promo: true,
        groupsPfe: {
          include: {
            groupMembers: {
              include: { etudiant: { include: { user: true } } },
            },
            coEncadrant: { include: { user: true } },
            pfeJury: {
              include: {
                enseignant: { include: { user: true } },
              },
            },
          },
        },
        groupSujets: {
          include: {
            group: {
              include: {
                groupMembers: {
                  include: { etudiant: { include: { user: true } } },
                },
              },
            },
          },
          orderBy: { ordre: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.error("Error fetching PFE subjects:", error);
    throw error;
  }
};

export const getPFESubjectById = async (id: number) => {
  try {
    const subject = await prisma.pfeSujet.findUnique({
      where: { id },
      include: {
        enseignant: {
          include: { user: true },
        },
        promo: true,
        groupsPfe: {
          include: {
            groupMembers: {
              include: { etudiant: { include: { user: true } } },
            },
            coEncadrant: { include: { user: true } },
            pfeJury: {
              include: {
                enseignant: { include: { user: true } },
              },
            },
          },
        },
        groupSujets: {
          include: {
            group: {
              include: {
                groupMembers: {
                  include: { etudiant: { include: { user: true } } },
                },
              },
            },
            sujet: true,
          },
          orderBy: { ordre: "asc" },
        },
      },
    });

    if (!subject) {
      throw new Error("PFE subject not found");
    }

    return subject;
  } catch (error) {
    logger.error("Error fetching PFE subject:", error);
    throw error;
  }
};

export const updatePFESubject = async (
  id: number,
  input: UpdatePFESubjectInput
) => {
  try {
    const subject = await prisma.pfeSujet.update({
      where: { id },
      data: {
        titre_ar: input.titreAr,
        titre_en: input.titreEn,
        description_ar: input.descriptionAr,
        description_en: input.descriptionEn,
        keywords_ar: input.keywordsAr,
        keywords_en: input.keywordsEn,
        workplan_ar: input.workplanAr,
        workplan_en: input.workplanEn,
        bibliographie_ar: input.bibliographieAr,
        bibliographie_en: input.bibliographieEn,
        typeProjet: resolveTypeProjet(input.typeProjet) as any,
        status: resolveStatusSujet(input.status),
        maxGrps: input.maxGrps,
      },
    });

    logger.info(`PFE Subject updated: ${id}`);
    return subject;
  } catch (error) {
    logger.error("Error updating PFE subject:", error);
    throw error;
  }
};

export const submitPFEGroup = async (
  groupId: number,
  sujetFinal: {
    titre: string;
    abstractFR: string;
    abstractEN: string;
  }
) => {
  try {
    const group = await prisma.groupPfe.findUnique({
      where: { id: groupId },
      select: { id: true, sujetFinalId: true },
    });

    if (!group) {
      throw new Error("PFE group not found");
    }

    const updatedSubject = await prisma.pfeSujet.update({
      where: { id: group.sujetFinalId },
      data: {
        description_ar: sujetFinal.abstractFR,
        description_en: sujetFinal.abstractEN,
        status: StatusSujet.termine,
      },
    });

    await prisma.groupPfe.update({
      where: { id: groupId },
      data: {
        dateAffectation: new Date(),
      },
    });

    logger.info(`PFE group submitted: ${groupId}`);
    return updatedSubject;
  } catch (error) {
    logger.error("Error submitting PFE group:", error);
    throw error;
  }
};

export const scheduleDefense = async (input: ScheduleDefenseInput) => {
  try {
    const group = await prisma.groupPfe.update({
      where: { id: input.groupId },
      data: {
        dateSoutenance: input.dateSoutenance,
        salleSoutenance: input.lieu,
      },
      include: {
        groupMembers: {
          include: { etudiant: { include: { user: true } } },
        },
        sujetFinal: {
          include: { enseignant: { include: { user: true } } },
        },
      },
    });

    logger.info(`PFE defense scheduled: ${input.groupId} on ${input.dateSoutenance}`);
    return group;
  } catch (error) {
    logger.error("Error scheduling PFE defense:", error);
    throw error;
  }
};

export const addJuryMember = async (
  groupId: number,
  enseignantId: number,
  role: string
) => {
  try {
    const juryRole = (Object.values(RoleJury).includes(role as RoleJury)
      ? (role as RoleJury)
      : RoleJury.examinateur);

    const jury = await prisma.pfeJury.create({
      data: {
        groupId,
        enseignantId,
        role: juryRole,
      },
      include: {
        enseignant: {
          include: { user: true },
        },
      },
    });

    logger.info(`Jury member added to group ${groupId}`);
    return jury;
  } catch (error) {
    logger.error("Error adding jury member:", error);
    throw error;
  }
};

export const submitGrade = async (
  groupId: number,
  _enseignantId: number,
  note: number,
  _feedbacks?: string
) => {
  try {
    if (note < 0 || note > 20) {
      throw new Error("Note must be between 0 and 20");
    }

    const mention =
      note >= 16
        ? "excellent"
        : note >= 14
          ? "tres_bien"
          : note >= 12
            ? "bien"
            : note >= 10
              ? "assez_bien"
              : "passable";

    const updated = await prisma.groupPfe.update({
      where: { id: groupId },
      data: {
        note: new Prisma.Decimal(String(note)),
        mention: mention as any,
      },
    });

    return {
      ...updated,
      noteNumeric: toNumber(updated.note),
    };
  } catch (error) {
    logger.error("Error submitting grade:", error);
    throw error;
  }
};

export const getPFEStats = async (promoId?: number) => {
  try {
    const where: Prisma.GroupPfeWhereInput = {};
    if (promoId) {
      where.sujetFinal = {
        promoId,
      };
    }

    const [totalGroups, submittedGroups, defenseScheduled, defenseCompleted] =
      await Promise.all([
        prisma.groupPfe.count({ where }),
        prisma.groupPfe.count({
          where: { ...where, dateAffectation: { not: null } },
        }),
        prisma.groupPfe.count({
          where: { ...where, dateSoutenance: { not: null }, note: null },
        }),
        prisma.groupPfe.count({
          where: { ...where, note: { not: null } },
        }),
      ]);

    return {
      totalGroups,
      submittedGroups,
      defenseScheduled,
      defenseCompleted,
      progressPercentage:
        totalGroups > 0
          ? Math.round(((submittedGroups + defenseScheduled + defenseCompleted) / totalGroups) * 100)
          : 0,
    };
  } catch (error) {
    logger.error("Error fetching PFE stats:", error);
    throw error;
  }
};
