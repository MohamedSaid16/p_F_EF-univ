import prisma from "../../config/database";
import { Prisma } from "@prisma/client";
import logger from "../../utils/logger";

export interface CreateAnnounceInput {
  titre: string;
  contenu: string;
  typeAnnonce?: string;
  typeId?: number;
  dateExpiration?: Date;
}

export interface UpdateAnnounceInput {
  titre?: string;
  contenu?: string;
  typeAnnonce?: string;
  typeId?: number;
  dateExpiration?: Date;
}

const resolveTypeId = async (
  input: Pick<CreateAnnounceInput, "typeAnnonce" | "typeId">
): Promise<number | null> => {
  if (typeof input.typeId === "number") {
    return input.typeId;
  }

  if (!input.typeAnnonce?.trim()) {
    return null;
  }

  const typeName = input.typeAnnonce.trim();
  const existing = await prisma.annonceType.findFirst({
    where: {
      OR: [
        { nom_ar: { equals: typeName, mode: "insensitive" } },
        { nom_en: { equals: typeName, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.annonceType.create({
    data: { nom_ar: typeName },
    select: { id: true },
  });

  return created.id;
};

export const createAnnounce = async (
  input: CreateAnnounceInput,
  createdById: number
) => {
  try {
    const typeId = await resolveTypeId(input);

    const announce = await prisma.annonce.create({
      data: {
        titre_ar: input.titre,
        contenu_ar: input.contenu,
        auteurId: createdById,
        typeId,
        datePublication: new Date(),
        dateExpiration: input.dateExpiration,
      },
      include: {
        auteur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        type: true,
      },
    });

    logger.info(`Announcement created: ${announce.id}`);
    return announce;
  } catch (error) {
    logger.error("Error creating announcement:", error);
    throw error;
  }
};

export const getAnnounces = async (filters?: {
  typeAnnonce?: string;
  isExpired?: boolean;
}) => {
  try {
    const where: Prisma.AnnonceWhereInput = {};

    if (filters?.typeAnnonce?.trim()) {
      where.type = {
        OR: [
          { nom_ar: { equals: filters.typeAnnonce.trim(), mode: "insensitive" } },
          { nom_en: { equals: filters.typeAnnonce.trim(), mode: "insensitive" } },
        ],
      };
    }

    const announces = await prisma.annonce.findMany({
      where,
      include: {
        auteur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        type: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (filters?.isExpired === true) {
      return announces.filter(
        (a) => a.dateExpiration && new Date(a.dateExpiration) < new Date()
      );
    }

    if (filters?.isExpired === false) {
      return announces.filter(
        (a) => !a.dateExpiration || new Date(a.dateExpiration) >= new Date()
      );
    }

    return announces;
  } catch (error) {
    logger.error("Error fetching announcements:", error);
    throw error;
  }
};

export const getAnnounceById = async (id: number) => {
  try {
    const announce = await prisma.annonce.findUnique({
      where: { id },
      include: {
        auteur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        type: true,
      },
    });

    if (!announce) {
      throw new Error("Announcement not found");
    }

    return announce;
  } catch (error) {
    logger.error("Error fetching announcement:", error);
    throw error;
  }
};

export const updateAnnounce = async (id: number, input: UpdateAnnounceInput) => {
  try {
    const typeId = await resolveTypeId(input);

    const announce = await prisma.annonce.update({
      where: { id },
      data: {
        titre_ar: input.titre,
        contenu_ar: input.contenu,
        typeId: typeId ?? undefined,
        dateExpiration: input.dateExpiration,
      },
      include: {
        auteur: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        type: true,
      },
    });

    logger.info(`Announcement updated: ${id}`);
    return announce;
  } catch (error) {
    logger.error("Error updating announcement:", error);
    throw error;
  }
};

export const deleteAnnounce = async (id: number) => {
  try {
    const announce = await prisma.annonce.delete({
      where: { id },
    });

    logger.info(`Announcement deleted: ${id}`);
    return announce;
  } catch (error) {
    logger.error("Error deleting announcement:", error);
    throw error;
  }
};

export const getLatestAnnounces = async (limit = 5) => {
  try {
    return await prisma.annonce.findMany({
      where: {
        OR: [
          { dateExpiration: null },
          { dateExpiration: { gte: new Date() } },
        ],
      },
      include: {
        auteur: {
          select: { id: true, nom: true, prenom: true },
        },
        type: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    logger.error("Error fetching latest announcements:", error);
    throw error;
  }
};
