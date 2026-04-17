// src/modules/discipline/controllers/infraction.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import prisma from "../../../config/database";

// GET /api/v1/cd/infractions
export const getAllInfractions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const infractions = await prisma.infraction.findMany({
      orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: infractions });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/cd/infractions/:id
export const getInfractionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const infraction = await prisma.infraction.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!infraction) {
      res.status(404).json({ success: false, error: { message: "Infraction introuvable." } });
      return;
    }
    res.json({ success: true, data: infraction });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cd/infractions
export const createInfraction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, description, gravite } = req.body;
    if (!nom || !gravite) {
      res.status(400).json({ success: false, error: { message: "nom et gravite sont obligatoires." } });
      return;
    }
    const infraction = await prisma.infraction.create({
      data: { nom, description, gravite },
    });
    res.status(201).json({ success: true, data: infraction });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/cd/infractions/:id
export const updateInfraction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, description, gravite } = req.body;
    const infraction = await prisma.infraction.update({
      where: { id: Number(req.params.id) },
      data: { nom, description, gravite },
    });
    res.json({ success: true, data: infraction });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cd/infractions/:id
export const deleteInfraction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.infraction.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: "Supprimée." });
  } catch (error) {
    next(error);
  }
};
