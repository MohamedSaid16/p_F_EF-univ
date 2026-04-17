// src/modules/discipline/controllers/dossier.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import prisma from "../../../config/database";

const dossierInclude = {
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
  conseil: { select: { id: true, dateReunion: true, lieu: true, status: true } },
};

// GET /api/v1/cd/dossiers-disciplinaires
export const getAllDossiers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, conseilId, search } = req.query;

    const dossiers = await prisma.dossierDisciplinaire.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(conseilId && { conseilId: Number(conseilId) }),
        ...(search && {
          etudiant: {
            user: {
              OR: [
                { nom:    { contains: search as string, mode: "insensitive" } },
                { prenom: { contains: search as string, mode: "insensitive" } },
              ],
            },
          },
        }),
      },
      include: dossierInclude,
      orderBy: { dateSignal: "desc" },
    });

    res.json({ success: true, data: dossiers });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/cd/dossiers-disciplinaires/:id
export const getDossierById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dossier = await prisma.dossierDisciplinaire.findUnique({
      where: { id: Number(req.params.id) },
      include: dossierInclude,
    });

    if (!dossier) {
      res.status(404).json({ success: false, error: { message: "Dossier introuvable." } });
      return;
    }

    res.json({ success: true, data: dossier });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cd/dossiers-disciplinaires
export const createDossier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { etudiantId, infractionId, descriptionSignal, conseilId, dateSignal } = req.body;

    if (!etudiantId || !infractionId) {
      res.status(400).json({
        success: false,
        error: { message: "etudiantId et infractionId sont obligatoires." },
      });
      return;
    }

    // Get enseignant id of logged-in user
    const enseignant = await prisma.enseignant.findUnique({
      where: { userId: req.user!.id },
    });

    const dossier = await prisma.dossierDisciplinaire.create({
      data: {
        etudiantId:         Number(etudiantId),
        enseignantSignalant: enseignant?.id ?? null,
        infractionId:       Number(infractionId),
        descriptionSignal,
        conseilId:          conseilId ? Number(conseilId) : null,
        dateSignal:         dateSignal ? new Date(dateSignal) : new Date(),
        status:             "signale",
      },
      include: dossierInclude,
    });

    res.status(201).json({ success: true, data: dossier });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/cd/dossiers-disciplinaires/:id
export const updateDossier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, decisionId, remarqueDecision, dateDecision, conseilId } = req.body;

    const dossier = await prisma.dossierDisciplinaire.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(status !== undefined        && { status }),
        ...(decisionId !== undefined    && { decisionId: decisionId ? Number(decisionId) : null }),
        ...(remarqueDecision !== undefined && { remarqueDecision }),
        ...(dateDecision !== undefined  && { dateDecision: dateDecision ? new Date(dateDecision) : null }),
        ...(conseilId !== undefined     && { conseilId: conseilId ? Number(conseilId) : null }),
      },
      include: dossierInclude,
    });

    res.json({ success: true, data: dossier });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cd/dossiers-disciplinaires/:id
export const deleteDossier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.dossierDisciplinaire.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true, message: "Dossier supprimé." });
  } catch (error) {
    next(error);
  }
};
