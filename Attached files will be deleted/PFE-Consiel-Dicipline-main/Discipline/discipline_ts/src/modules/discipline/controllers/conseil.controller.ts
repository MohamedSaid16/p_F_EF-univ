// src/modules/discipline/controllers/conseil.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import prisma from "../../../config/database";

// GET /api/v1/cd/conseils
export const getAllConseils = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, annee } = req.query;

    const conseils = await prisma.conseilDisciplinaire.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(annee && { anneeUniversitaire: annee as string }),
      },
      include: {
        membres: {
          include: {
            enseignant: {
              include: {
                user: { select: { nom: true, prenom: true } },
                grade: { select: { nom: true } },
              },
            },
          },
        },
        dossiers: {
          include: {
            etudiant: {
              include: {
                user: { select: { nom: true, prenom: true } },
                promo: {
                  include: {
                    specialite: {
                      include: { filiere: { select: { nom: true } } },
                    },
                  },
                },
              },
            },
            infraction: true,
            decision: true,
          },
        },
      },
      orderBy: { dateReunion: "desc" },
    });

    res.json({ success: true, data: conseils });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/cd/conseils/:id
export const getConseilById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conseil = await prisma.conseilDisciplinaire.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        membres: {
          include: {
            enseignant: {
              include: {
                user: { select: { nom: true, prenom: true } },
                grade: { select: { nom: true } },
              },
            },
          },
        },
        dossiers: {
          include: {
            etudiant: {
              include: {
                user: { select: { nom: true, prenom: true } },
                promo: {
                  include: {
                    specialite: {
                      include: { filiere: { select: { nom: true } } },
                    },
                  },
                },
              },
            },
            infraction: true,
            decision: true,
            enseignantSignalantR: {
              include: { user: { select: { nom: true, prenom: true } } },
            },
          },
        },
      },
    });

    if (!conseil) {
      res.status(404).json({ success: false, error: { message: "Conseil introuvable." } });
      return;
    }

    res.json({ success: true, data: conseil });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cd/conseils
export const createConseil = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dateReunion, heure, lieu, anneeUniversitaire, description, membres = [] } = req.body;

    if (!dateReunion || !anneeUniversitaire) {
      res.status(400).json({
        success: false,
        error: { message: "dateReunion et anneeUniversitaire sont obligatoires." },
      });
      return;
    }

    // Find the president_conseil enseignant (the logged-in user)
    const enseignant = await prisma.enseignant.findUnique({
      where: { userId: req.user!.id },
    });

    if (!enseignant) {
      res.status(400).json({
        success: false,
        error: { message: "L'utilisateur connecté n'est pas un enseignant." },
      });
      return;
    }

    const conseil = await prisma.$transaction(async (tx) => {
      // 1. Create the conseil
      const newConseil = await tx.conseilDisciplinaire.create({
        data: {
          dateReunion: new Date(dateReunion),
          heure: heure ? new Date(`1970-01-01T${heure}:00`) : null,
          lieu,
          anneeUniversitaire,
          description,
        },
      });

      // 2. Add the logged-in user as president
      await tx.membreConseil.create({
        data: {
          conseilId: newConseil.id,
          enseignantId: enseignant.id,
          role: "president",
        },
      });

      // 3. Add additional members (max 3)
      const additionalMembers = membres.slice(0, 3);
      if (additionalMembers.length > 0) {
        await tx.membreConseil.createMany({
          data: additionalMembers.map((m: { enseignantId: number; role?: string }) => ({
            conseilId: newConseil.id,
            enseignantId: m.enseignantId,
            role: m.role ?? "membre",
          })),
        });
      }

      return newConseil;
    });

    res.status(201).json({ success: true, data: conseil });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/cd/conseils/:id
export const updateConseil = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dateReunion, heure, lieu, anneeUniversitaire, description, status } = req.body;

    const conseil = await prisma.conseilDisciplinaire.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(dateReunion && { dateReunion: new Date(dateReunion) }),
        ...(heure && { heure: new Date(`1970-01-01T${heure}:00`) }),
        ...(lieu !== undefined && { lieu }),
        ...(anneeUniversitaire && { anneeUniversitaire }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
      },
    });

    res.json({ success: true, data: conseil });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cd/conseils/:id
export const deleteConseil = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.conseilDisciplinaire.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true, message: "Conseil supprimé." });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/cd/conseils/:id/finaliser
export const finaliserConseil = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { drafts = {} } = req.body;
    const conseilId = Number(req.params.id);
    const today = new Date();

    await prisma.$transaction(async (tx) => {
      // Mark conseil as termine
      await tx.conseilDisciplinaire.update({
        where: { id: conseilId },
        data: { status: "termine" },
      });

      // Save each dossier decision
      for (const [dossierId, d] of Object.entries(drafts) as [string, any][]) {
        await tx.dossierDisciplinaire.update({
          where: { id: Number(dossierId) },
          data: {
            ...(d.decisionId && { decisionId: Number(d.decisionId) }),
            ...(d.remarqueDecision !== undefined && { remarqueDecision: d.remarqueDecision }),
            status: d.status ?? "traite",
            dateDecision: today,
          },
        });
      }
    });

    res.json({ success: true, message: "Conseil finalisé.", id: conseilId });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cd/conseils/:id/membres
export const addMembre = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { enseignantId, role = "membre" } = req.body;
    if (!enseignantId) {
      res.status(400).json({ success: false, error: { message: "enseignantId est obligatoire." } });
      return;
    }

    // Check max 3 non-president members
    const existing = await prisma.membreConseil.count({
      where: { conseilId: Number(req.params.id), role: { not: "president" } },
    });

    if (existing >= 3) {
      res.status(400).json({
        success: false,
        error: { message: "Maximum 3 membres additionnels autorisés." },
      });
      return;
    }

    const membre = await prisma.membreConseil.create({
      data: {
        conseilId: Number(req.params.id),
        enseignantId: Number(enseignantId),
        role,
      },
    });

    res.status(201).json({ success: true, data: membre });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cd/conseils/:id/membres/:membreId
export const removeMembre = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const membre = await prisma.membreConseil.findFirst({
      where: {
        id: Number(req.params.membreId),
        conseilId: Number(req.params.id),
      },
    });

    if (!membre) {
      res.status(404).json({ success: false, error: { message: "Membre introuvable." } });
      return;
    }

    if (membre.role === "president") {
      res.status(400).json({
        success: false,
        error: { message: "Impossible de supprimer le président." },
      });
      return;
    }

    await prisma.membreConseil.delete({ where: { id: membre.id } });
    res.json({ success: true, message: "Membre retiré." });
  } catch (error) {
    next(error);
  }
};
