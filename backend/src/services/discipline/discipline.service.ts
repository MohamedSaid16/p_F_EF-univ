import prisma from "../../config/database";
import {
  GraviteInfraction,
  Prisma,
  StatusConseil,
  StatusDossier,
} from "@prisma/client";
import logger from "../../utils/logger";

export interface CreateDisciplinaryCase {
  titre: string;
  description: string;
  studentIds: number[];
  typeInfraction: string;
  gravite: "mineure" | "majeure" | "grave";
  dateInfraction: Date;
  dateRapport?: Date;
  enseignantSignalant?: number;
}

export interface UpdateDisciplinaryCase {
  titre?: string;
  description?: string;
  typeInfraction?: string;
  gravite?: "mineure" | "majeure" | "grave";
  status?: string;
  dateReunion?: Date | null;
  lieu?: string | null;
  notes?: string | null;
}

export interface CreateDisciplinaryMeeting {
  caseId: number;
  dateReunion: Date;
  lieu?: string;
  commissioners?: number[];
}

export interface DisciplinaryDecision {
  caseId: number;
  decision: string;
  sanctions?: string;
  dateDecision: Date;
  communicatedBy: number;
}

const toGraviteInfraction = (
  gravite: CreateDisciplinaryCase["gravite"] | UpdateDisciplinaryCase["gravite"]
): GraviteInfraction | undefined => {
  if (!gravite) return undefined;
  if (gravite === "mineure") return GraviteInfraction.faible;
  if (gravite === "majeure") return GraviteInfraction.moyenne;
  return GraviteInfraction.grave;
};

const resolveInfraction = async (typeInfraction: string, gravite?: GraviteInfraction) => {
  const name = typeInfraction.trim();
  const existing = await prisma.infraction.findFirst({
    where: {
      OR: [
        { nom_ar: { equals: name, mode: "insensitive" } },
        { nom_en: { equals: name, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.infraction.create({
    data: {
      nom_ar: name,
      gravite: gravite ?? GraviteInfraction.moyenne,
    },
    select: { id: true },
  });

  return created.id;
};

export const createDisciplinaryCase = async (input: CreateDisciplinaryCase) => {
  try {
    if (input.studentIds.length === 0) {
      throw new Error("At least one student must be provided");
    }

    const infractionId = await resolveInfraction(
      input.typeInfraction,
      toGraviteInfraction(input.gravite)
    );

    const created = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const studentId of input.studentIds) {
        const dossier = await tx.dossierDisciplinaire.create({
          data: {
            etudiantId: studentId,
            enseignantSignalant: input.enseignantSignalant,
            infractionId,
            dateSignal: input.dateInfraction,
            descriptionSignal_ar: `${input.titre}\n\n${input.description}`,
            status: StatusDossier.signale,
          },
        });
        records.push(dossier);
      }
      return records;
    });

    logger.info(`Disciplinary case(s) created: ${created.map((x) => x.id).join(",")}`);
    return created;
  } catch (error) {
    logger.error("Error creating disciplinary case:", error);
    throw error;
  }
};

export const getDisciplinaryCases = async (filters?: {
  status?: string;
  studentId?: number;
  gravite?: string;
}) => {
  try {
    const where: Prisma.DossierDisciplinaireWhereInput = {};

    if (filters?.studentId) {
      where.etudiantId = filters.studentId;
    }

    if (filters?.status && Object.values(StatusDossier).includes(filters.status as StatusDossier)) {
      where.status = filters.status as StatusDossier;
    }

    if (filters?.gravite) {
      const mapped =
        filters.gravite === "mineure"
          ? GraviteInfraction.faible
          : filters.gravite === "majeure"
            ? GraviteInfraction.moyenne
            : filters.gravite === "grave"
              ? GraviteInfraction.grave
              : undefined;

      if (mapped) {
        where.infraction = { gravite: mapped };
      }
    }

    return await prisma.dossierDisciplinaire.findMany({
      where,
      include: {
        etudiant: { include: { user: true } },
        infraction: true,
        decision: true,
        conseil: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.error("Error fetching disciplinary cases:", error);
    throw error;
  }
};

export const getDisciplinaryCaseById = async (id: number) => {
  try {
    const disciplinaryCase = await prisma.dossierDisciplinaire.findUnique({
      where: { id },
      include: {
        etudiant: { include: { user: true } },
        infraction: true,
        decision: true,
        conseil: {
          include: {
            membres: {
              include: { enseignant: { include: { user: true } } },
            },
          },
        },
      },
    });

    if (!disciplinaryCase) {
      throw new Error("Disciplinary case not found");
    }

    return disciplinaryCase;
  } catch (error) {
    logger.error("Error fetching disciplinary case:", error);
    throw error;
  }
};

export const updateDisciplinaryCase = async (
  id: number,
  input: UpdateDisciplinaryCase
) => {
  try {
    let infractionId: number | undefined;
    if (input.typeInfraction?.trim()) {
      infractionId = await resolveInfraction(
        input.typeInfraction,
        toGraviteInfraction(input.gravite)
      );
    }

    const nextStatus =
      input.status && Object.values(StatusDossier).includes(input.status as StatusDossier)
        ? (input.status as StatusDossier)
        : undefined;

    const disciplinaryCase = await prisma.dossierDisciplinaire.update({
      where: { id },
      data: {
        infractionId,
        status: nextStatus,
        descriptionSignal_ar: input.titre || input.description
          ? `${input.titre ?? ""}\n\n${input.description ?? ""}`.trim()
          : undefined,
      },
    });

    logger.info(`Disciplinary case updated: ${id}`);
    return disciplinaryCase;
  } catch (error) {
    logger.error("Error updating disciplinary case:", error);
    throw error;
  }
};

export const scheduleDisciplinaryMeeting = async (
  input: CreateDisciplinaryMeeting
) => {
  try {
    const meeting = await prisma.$transaction(async (tx) => {
      const caseRecord = await tx.dossierDisciplinaire.findUnique({
        where: { id: input.caseId },
        include: { etudiant: { include: { promo: true } } },
      });

      if (!caseRecord) {
        throw new Error("Disciplinary case not found");
      }

      const conseil = await tx.conseilDisciplinaire.create({
        data: {
          dateReunion: input.dateReunion,
          lieu: input.lieu,
          anneeUniversitaire: caseRecord.etudiant.promo?.anneeUniversitaire || new Date().getFullYear().toString(),
          status: StatusConseil.planifie,
        },
      });

      if (input.commissioners?.length) {
        await tx.membreConseil.createMany({
          data: input.commissioners.map((enseignantId) => ({
            conseilId: conseil.id,
            enseignantId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.dossierDisciplinaire.update({
        where: { id: input.caseId },
        data: {
          conseilId: conseil.id,
          status: StatusDossier.en_instruction,
        },
      });

      return conseil;
    });

    logger.info(`Disciplinary meeting scheduled: ${meeting.id}`);
    return meeting;
  } catch (error) {
    logger.error("Error scheduling disciplinary meeting:", error);
    throw error;
  }
};

export const recordDisciplinaryDecision = async (decision: DisciplinaryDecision) => {
  try {
    const caseRecord = await prisma.$transaction(async (tx) => {
      const decisionRecord = await tx.decision.create({
        data: {
          nom_ar: decision.decision,
          description_ar: decision.sanctions,
        },
      });

      const updated = await tx.dossierDisciplinaire.update({
        where: { id: decision.caseId },
        data: {
          decisionId: decisionRecord.id,
          remarqueDecision_ar: decision.sanctions,
          dateDecision: decision.dateDecision,
          status: StatusDossier.traite,
        },
      });

      return updated;
    });

    logger.info(`Disciplinary decision recorded: ${caseRecord.id}`);
    return caseRecord;
  } catch (error) {
    logger.error("Error recording disciplinary decision:", error);
    throw error;
  }
};

export const getStudentDisciplinaryHistory = async (studentId: number) => {
  try {
    return await prisma.dossierDisciplinaire.findMany({
      where: { etudiantId: studentId },
      include: {
        decision: true,
        conseil: true,
        infraction: true,
      },
      orderBy: { dateSignal: "desc" },
    });
  } catch (error) {
    logger.error("Error fetching student disciplinary history:", error);
    throw error;
  }
};

export const getDisciplinaryStats = async () => {
  try {
    const [totalCases, openCases, closedCases, minorCases, majorCases, severeCases] =
      await Promise.all([
        prisma.dossierDisciplinaire.count(),
        prisma.dossierDisciplinaire.count({ where: { status: { in: [StatusDossier.signale, StatusDossier.en_instruction, StatusDossier.jugement] } } }),
        prisma.dossierDisciplinaire.count({ where: { status: StatusDossier.traite } }),
        prisma.dossierDisciplinaire.count({ where: { infraction: { gravite: GraviteInfraction.faible } } }),
        prisma.dossierDisciplinaire.count({ where: { infraction: { gravite: GraviteInfraction.moyenne } } }),
        prisma.dossierDisciplinaire.count({ where: { infraction: { gravite: { in: [GraviteInfraction.grave, GraviteInfraction.tres_grave] } } } }),
      ]);

    return {
      totalCases,
      openCases,
      closedCases,
      byGravity: {
        minor: minorCases,
        major: majorCases,
        severe: severeCases,
      },
    };
  } catch (error) {
    logger.error("Error fetching disciplinary stats:", error);
    throw error;
  }
};
