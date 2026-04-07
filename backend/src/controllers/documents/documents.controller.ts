import { CategorieDocument, Prisma, StatusDocumentRequest } from "@prisma/client";
import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import prisma from "../../config/database";
import { AuthRequest } from "../../middlewares/auth.middleware";

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const resolveEnseignantIdByUserId = async (userId: number): Promise<number | null> => {
  const enseignant = await prisma.enseignant.findUnique({
    where: { userId },
    select: { id: true },
  });
  return enseignant?.id ?? null;
};

export const createDocumentType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nom, categorie, description } = req.body as {
      nom?: string;
      categorie?: CategorieDocument;
      description?: string;
    };

    if (!nom?.trim()) {
      res.status(400).json({ success: false, message: "nom is required" });
      return;
    }

    if (!categorie || !Object.values(CategorieDocument).includes(categorie)) {
      res.status(400).json({ success: false, message: "Invalid categorie" });
      return;
    }

    const docType = await prisma.documentType.create({
      data: {
        nom_ar: nom.trim(),
        categorie,
        description_ar: description?.trim() || null,
      },
    });

    res.status(201).json({ success: true, data: docType });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create document type";
    res.status(500).json({ success: false, message });
  }
};

export const getDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, page = "1", limit = "10" } = req.query;

    const pageNumber = parsePositiveInt(page) ?? 1;
    const pageSize = parsePositiveInt(limit) ?? 10;

    const where: Prisma.DocumentTypeWhereInput = {};

    if (typeof category === "string" && Object.values(CategorieDocument).includes(category as CategorieDocument)) {
      where.categorie = category as CategorieDocument;
    }

    if (typeof search === "string" && search.trim()) {
      where.OR = [
        { nom_ar: { contains: search.trim(), mode: "insensitive" } },
        { nom_en: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.documentType.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
      prisma.documentType.count({ where }),
    ]);

    res.json({
      success: true,
      data: documents,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch documents";
    res.status(500).json({ success: false, message });
  }
};

export const createRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const { typeDocId, description } = req.body as {
      typeDocId?: number | string;
      description?: string;
    };

    const parsedTypeDocId = parsePositiveInt(typeDocId);
    if (!parsedTypeDocId) {
      res.status(400).json({ success: false, message: "typeDocId must be a positive integer" });
      return;
    }

    const enseignantId = await resolveEnseignantIdByUserId(req.user.id);
    if (!enseignantId) {
      res.status(400).json({ success: false, message: "Authenticated user is not linked to an enseignant profile" });
      return;
    }

    const request = await prisma.documentRequest.create({
      data: {
        enseignantId,
        typeDocId: parsedTypeDocId,
        description_ar: description?.trim() || null,
        description_en: description?.trim() || null,
        dateDemande: new Date(),
      },
    });

    res.status(201).json({ success: true, data: request });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create request";
    res.status(500).json({ success: false, message });
  }
};

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: "File is required" });
      return;
    }

    const requestId = parsePositiveInt(req.body.requestId);
    if (!requestId) {
      res.status(400).json({ success: false, message: "requestId must be a positive integer" });
      return;
    }

    const existingRequest = await prisma.documentRequest.findUnique({
      where: { id: requestId },
      select: { id: true },
    });

    if (!existingRequest) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }

    const relativeDocumentPath = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");

    const updated = await prisma.documentRequest.update({
      where: { id: requestId },
      data: {
        documentUrl: relativeDocumentPath,
        status: StatusDocumentRequest.valide,
        traitePar: req.user.id,
        dateTraitement: new Date(),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload document";
    res.status(500).json({ success: false, message });
  }
};

export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid request id" });
      return;
    }

    const request = await prisma.documentRequest.findUnique({
      where: { id },
      select: { documentUrl: true },
    });

    if (!request?.documentUrl) {
      res.status(404).json({ success: false, message: "Document not found" });
      return;
    }

    const filePath = path.isAbsolute(request.documentUrl)
      ? request.documentUrl
      : path.join(process.cwd(), request.documentUrl);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: "File not found on server" });
      return;
    }

    res.download(filePath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to download document";
    res.status(500).json({ success: false, message });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = parsePositiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: "Invalid request id" });
      return;
    }

    const request = await prisma.documentRequest.findUnique({
      where: { id },
      select: {
        id: true,
        enseignantId: true,
        documentUrl: true,
        enseignant: { select: { userId: true } },
      },
    });

    if (!request) {
      res.status(404).json({ success: false, message: "Request not found" });
      return;
    }

    const isAdmin = req.user.roles.includes("admin");
    const isOwner = request.enseignant?.userId === req.user.id;

    if (!isAdmin && !isOwner) {
      res.status(403).json({ success: false, message: "Not allowed" });
      return;
    }

    if (request.documentUrl) {
      const filePath = path.isAbsolute(request.documentUrl)
        ? request.documentUrl
        : path.join(process.cwd(), request.documentUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.documentRequest.delete({ where: { id } });

    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete document";
    res.status(500).json({ success: false, message });
  }
};
