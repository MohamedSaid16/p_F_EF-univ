// src/modules/discipline/controllers/decision.controller.ts
import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../middleware/auth.middleware";
import prisma from "../../../config/database";

// GET /api/v1/cd/decisions
export const getAllDecisions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const decisions = await prisma.decision.findMany({
      orderBy: { nom: "asc" },
    });
    res.json({ success: true, data: decisions });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/cd/decisions/:id
export const getDecisionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const decision = await prisma.decision.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!decision) {
      res.status(404).json({ success: false, error: { message: "Décision introuvable." } });
      return;
    }
    res.json({ success: true, data: decision });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cd/decisions
export const createDecision = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, description, niveauSanction } = req.body;
    if (!nom) {
      res.status(400).json({ success: false, error: { message: "nom est obligatoire." } });
      return;
    }
    const decision = await prisma.decision.create({
      data: { nom, description, niveauSanction },
    });
    res.status(201).json({ success: true, data: decision });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/cd/decisions/:id
export const updateDecision = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { nom, description, niveauSanction } = req.body;
    const decision = await prisma.decision.update({
      where: { id: Number(req.params.id) },
      data: { nom, description, niveauSanction },
    });
    res.json({ success: true, data: decision });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cd/decisions/:id
export const deleteDecision = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.decision.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true, message: "Supprimée." });
  } catch (error) {
    next(error);
  }
};
