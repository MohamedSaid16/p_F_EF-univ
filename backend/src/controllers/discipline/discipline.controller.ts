import { Request, Response } from "express";
import prisma from "../../config/database";
import {
  createDisciplinaryCase,
  getDisciplinaryCases,
  getDisciplinaryCaseById,
  updateDisciplinaryCase,
  scheduleDisciplinaryMeeting,
  recordDisciplinaryDecision,
  getDisciplinaryStats,
} from "../../services/discipline/discipline.service";
import logger from "../../utils/logger";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listConseilsHandler = async (_req: Request, res: Response) => {
  try {
    const conseils = await prisma.conseilDisciplinaire.findMany({
      include: {
        membres: {
          include: {
            enseignant: {
              include: {
                user: true,
                grade: true,
              },
            },
          },
        },
      },
      orderBy: { dateReunion: "desc" },
    });

    res.status(200).json({ success: true, data: conseils });
  } catch (error: any) {
    logger.error("Error listing conseils:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to list conseils" });
  }
};

export const getConseilHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid conseil id" });
      return;
    }

    const conseil = await prisma.conseilDisciplinaire.findUnique({
      where: { id },
      include: {
        membres: {
          include: {
            enseignant: {
              include: {
                user: true,
                grade: true,
              },
            },
          },
        },
        dossiers: {
          include: {
            etudiant: { include: { user: true, promo: { include: { specialite: { include: { filiere: true } } } } } },
            infraction: true,
            decision: true,
          },
        },
      },
    });

    if (!conseil) {
      res.status(404).json({ success: false, message: "Conseil not found" });
      return;
    }

    res.status(200).json({ success: true, data: conseil });
  } catch (error: any) {
    logger.error("Error getting conseil:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to get conseil" });
  }
};

export const createConseilHandler = async (req: Request, res: Response) => {
  try {
    const { dateReunion, heure, lieu, anneeUniversitaire, description, membres } = req.body as {
      dateReunion: string;
      heure?: string;
      lieu?: string;
      anneeUniversitaire?: string;
      description?: string;
      membres?: Array<{ enseignantId: number; role?: "president" | "rapporteur" | "membre" }>;
    };

    if (!dateReunion) {
      res.status(400).json({ success: false, message: "dateReunion is required" });
      return;
    }

    const conseil = await prisma.$transaction(async (tx) => {
      const created = await tx.conseilDisciplinaire.create({
        data: {
          dateReunion: new Date(dateReunion),
          heure: heure ? new Date(heure) : null,
          lieu,
          anneeUniversitaire: anneeUniversitaire || new Date().getFullYear().toString(),
          description_ar: description,
        },
      });

      if (Array.isArray(membres) && membres.length > 0) {
        await tx.membreConseil.createMany({
          data: membres.map((m) => ({
            conseilId: created.id,
            enseignantId: m.enseignantId,
            role: m.role || "membre",
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    res.status(201).json({ success: true, data: conseil });
  } catch (error: any) {
    logger.error("Error creating conseil:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to create conseil" });
  }
};

export const updateConseilHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid conseil id" });
      return;
    }

    const { dateReunion, heure, lieu, anneeUniversitaire, description, status } = req.body;

    const updated = await prisma.conseilDisciplinaire.update({
      where: { id },
      data: {
        dateReunion: dateReunion ? new Date(dateReunion) : undefined,
        heure: heure ? new Date(heure) : undefined,
        lieu,
        anneeUniversitaire,
          description_ar: description,
        status,
      },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error("Error updating conseil:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to update conseil" });
  }
};

export const deleteConseilHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid conseil id" });
      return;
    }

    await prisma.conseilDisciplinaire.delete({ where: { id } });
    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error("Error deleting conseil:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to delete conseil" });
  }
};

export const finaliserConseilHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid conseil id" });
      return;
    }

    const { drafts } = req.body as {
      drafts?: Array<{ caseId: number; decision: string; sanctions?: string; dateDecision?: string; communicatedBy?: number }>;
    };

    await prisma.$transaction(async (tx) => {
      await tx.conseilDisciplinaire.update({
        where: { id },
        data: { status: "termine" },
      });

      if (Array.isArray(drafts) && drafts.length > 0) {
        for (const d of drafts) {
          const decisionRecord = await tx.decision.create({
            data: {
              nom_ar: d.decision,
              nom_en: d.decision,
              description_ar: d.sanctions,
              description_en: d.sanctions,
            },
          });

          await tx.dossierDisciplinaire.update({
            where: { id: d.caseId },
            data: {
              decisionId: decisionRecord.id,
              remarqueDecision_ar: d.sanctions,
              remarqueDecision_en: d.sanctions,
              dateDecision: d.dateDecision ? new Date(d.dateDecision) : new Date(),
              status: "traite",
            },
          });
        }
      }
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error("Error finalizing conseil:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to finalize conseil" });
  }
};

export const addMembreHandler = async (req: Request, res: Response) => {
  try {
    const conseilId = parseInt(String(req.params.cid), 10);
    const { enseignantId, role } = req.body as { enseignantId: number; role?: "president" | "rapporteur" | "membre" };

    if (!conseilId || Number.isNaN(conseilId) || !enseignantId) {
      res.status(400).json({ success: false, message: "Invalid conseilId or enseignantId" });
      return;
    }

    const membre = await prisma.membreConseil.create({
      data: {
        conseilId,
        enseignantId,
        role: role || "membre",
      },
    });

    res.status(201).json({ success: true, data: membre });
  } catch (error: any) {
    logger.error("Error adding membre:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to add member" });
  }
};

export const removeMembreHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.mid), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid member id" });
      return;
    }

    await prisma.membreConseil.delete({ where: { id } });
    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error("Error removing membre:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to remove member" });
  }
};

export const listDossiersHandler = async (req: Request, res: Response) => {
  try {
    const { status, studentId, gravite } = req.query;
    const dossiers = await getDisciplinaryCases({
      status: status ? String(status) : undefined,
      studentId: studentId ? parseInt(String(studentId), 10) : undefined,
      gravite: gravite ? String(gravite) : undefined,
    });

    res.status(200).json({ success: true, data: dossiers });
  } catch (error: any) {
    logger.error("Error listing dossiers:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to list dossiers" });
  }
};

export const getDossierHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid dossier id" });
      return;
    }

    const dossier = await getDisciplinaryCaseById(id);
    res.status(200).json({ success: true, data: dossier });
  } catch (error: any) {
    logger.error("Error getting dossier:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to get dossier" });
  }
};

export const createDossierHandler = async (req: AuthRequest, res: Response) => {
  try {
    const payload = req.body as {
      titre?: string;
      description?: string;
      reason?: string;
      studentIds?: number[];
      studentId?: number;
      typeInfraction?: string;
      gravite?: "mineure" | "majeure" | "grave";
      dateInfraction?: string;
      dateRapport?: string;
    };

    const studentIds = Array.isArray(payload.studentIds)
      ? payload.studentIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : Number.isInteger(Number(payload.studentId)) && Number(payload.studentId) > 0
        ? [Number(payload.studentId)]
        : [];

    if (!studentIds.length) {
      res.status(400).json({ success: false, message: "studentId or studentIds is required" });
      return;
    }

    const reasonText = (payload.description || payload.reason || "").trim();
    if (!reasonText) {
      res.status(400).json({ success: false, message: "description or reason is required" });
      return;
    }

    const reporter = req.user?.id
      ? await prisma.enseignant.findUnique({
          where: { userId: req.user.id },
          select: { id: true },
        })
      : null;

    const created = await createDisciplinaryCase({
      titre: (payload.titre || "Signalement disciplinaire").trim(),
      description: reasonText,
      studentIds,
      typeInfraction: (payload.typeInfraction || "Misconduct").trim(),
      gravite: payload.gravite || "majeure",
      dateInfraction: payload.dateInfraction ? new Date(payload.dateInfraction) : new Date(),
      dateRapport: payload.dateRapport ? new Date(payload.dateRapport) : undefined,
      enseignantSignalant: reporter?.id,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error("Error creating dossier:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to create dossier" });
  }
};

export const listDisciplineStudentsHandler = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();

    const students = await prisma.etudiant.findMany({
      where: q
        ? {
            OR: [
              { matricule: { contains: q, mode: "insensitive" } },
              { user: { nom: { contains: q, mode: "insensitive" } } },
              { user: { prenom: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
            ],
          }
        : undefined,
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
      orderBy: [{ user: { nom: "asc" } }, { user: { prenom: "asc" } }],
      take: 200,
    });

    res.status(200).json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        matricule: s.matricule,
        userId: s.userId,
        fullName: `${s.user.prenom} ${s.user.nom}`.trim(),
        email: s.user.email,
      })),
    });
  } catch (error: any) {
    logger.error("Error listing discipline students:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to list students" });
  }
};

export const getDisciplineStudentProfileHandler = async (req: Request, res: Response) => {
  try {
    const etudiantId = Number(req.params.id);
    if (!Number.isInteger(etudiantId) || etudiantId <= 0) {
      res.status(400).json({ success: false, message: "Invalid student id" });
      return;
    }

    const student = await prisma.etudiant.findUnique({
      where: { id: etudiantId },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            telephone: true,
            createdAt: true,
            lastLogin: true,
            status: true,
            emailVerified: true,
          },
        },
        promo: {
          include: {
            specialite: {
              include: {
                filiere: {
                  include: {
                    departement: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      res.status(404).json({ success: false, message: "Student not found" });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        etudiantId: student.id,
        matricule: student.matricule,
        moyenne: student.moyenne,
        anneeInscription: student.anneeInscription,
        user: student.user,
        promo: student.promo,
      },
    });
  } catch (error: any) {
    logger.error("Error getting discipline student profile:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to get student profile" });
  }
};

export const updateDossierHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid dossier id" });
      return;
    }

    const updated = await updateDisciplinaryCase(id, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error("Error updating dossier:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to update dossier" });
  }
};

export const deleteDossierHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || Number.isNaN(id)) {
      res.status(400).json({ success: false, message: "Invalid dossier id" });
      return;
    }

    await prisma.dossierDisciplinaire.delete({ where: { id } });
    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error("Error deleting dossier:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to delete dossier" });
  }
};

export const listInfractionsHandler = async (_req: Request, res: Response) => {
  try {
    const infractions = await prisma.infraction.findMany({ orderBy: { nom_ar: "asc" } });
    res.status(200).json({ success: true, data: infractions });
  } catch (error: any) {
    logger.error("Error listing infractions:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to list infractions" });
  }
};

export const listDecisionsHandler = async (_req: Request, res: Response) => {
  try {
    const decisions = await prisma.decision.findMany({ orderBy: { nom_ar: "asc" } });
    res.status(200).json({ success: true, data: decisions });
  } catch (error: any) {
    logger.error("Error listing decisions:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to list decisions" });
  }
};

export const scheduleMeetingHandler = async (req: Request, res: Response) => {
  try {
    const payload = req.body as { caseId: number; dateReunion: string; lieu?: string; commissioners?: number[] };
    const meeting = await scheduleDisciplinaryMeeting({
      ...payload,
      dateReunion: new Date(payload.dateReunion),
    });
    res.status(201).json({ success: true, data: meeting });
  } catch (error: any) {
    logger.error("Error scheduling meeting:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to schedule meeting" });
  }
};

export const recordDecisionHandler = async (req: Request, res: Response) => {
  try {
    const payload = req.body as {
      caseId: number;
      decision: string;
      sanctions?: string;
      dateDecision: string;
      communicatedBy: number;
    };

    const record = await recordDisciplinaryDecision({
      ...payload,
      dateDecision: new Date(payload.dateDecision),
    });

    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    logger.error("Error recording decision:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to record decision" });
  }
};

export const statsHandler = async (_req: Request, res: Response) => {
  try {
    const stats = await getDisciplinaryStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    logger.error("Error loading discipline stats:", error);
    res.status(500).json({ success: false, message: error?.message || "Failed to load stats" });
  }
};
