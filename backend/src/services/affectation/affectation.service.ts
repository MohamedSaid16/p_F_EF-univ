import prisma from "../../config/database";
import {
  NiveauCible,
  NiveauSource,
  Prisma,
  StatusCampagne,
  StatusVoeu,
} from "@prisma/client";
import logger from "../../utils/logger";

export interface CreateAffectationCampaignInput {
  nom: string;
  anneeUniversitaire: string;
  dateDebut: Date;
  dateFin: Date;
  specialites?: number[];
  niveauSource?: NiveauSource;
  niveauCible?: NiveauCible;
}

export interface UpdateAffectationCampaignInput {
  nom?: string;
  dateDebut?: Date;
  dateFin?: Date;
  status?: "ouverte" | "fermee" | "annulee";
}

const mapCampaignStatus = (
  status?: UpdateAffectationCampaignInput["status"] | string
): StatusCampagne | undefined => {
  if (!status) return undefined;
  if (status === "ouverte") return StatusCampagne.ouverte;
  if (status === "fermee") return StatusCampagne.fermee;
  if (status === "annulee") return StatusCampagne.terminee;
  if (Object.values(StatusCampagne).includes(status as StatusCampagne)) {
    return status as StatusCampagne;
  }
  return undefined;
};

export const createAffectationCampaign = async (
  input: CreateAffectationCampaignInput
) => {
  try {
    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campagneAffectation.create({
        data: {
          nom_ar: input.nom,
          anneeUniversitaire: input.anneeUniversitaire,
          dateDebut: input.dateDebut,
          dateFin: input.dateFin,
          status: StatusCampagne.brouillon,
          niveauSource: input.niveauSource ?? NiveauSource.L3,
          niveauCible: input.niveauCible ?? NiveauCible.M1,
        },
      });

      if (input.specialites?.length) {
        await tx.campagneSpecialite.createMany({
          data: input.specialites.map((specialiteId) => ({
            campagneId: newCampaign.id,
            specialiteId,
          })),
          skipDuplicates: true,
        });
      }

      return newCampaign;
    });

    logger.info(`Affectation campaign created: ${campaign.id}`);
    return campaign;
  } catch (error) {
    logger.error("Error creating affectation campaign:", error);
    throw error;
  }
};

export const getAffectationCampaigns = async (filters?: {
  status?: string;
  anneeUniversitaire?: string;
}) => {
  try {
    const where: Prisma.CampagneAffectationWhereInput = {};

    const status = mapCampaignStatus(filters?.status);
    if (status) where.status = status;
    if (filters?.anneeUniversitaire) where.anneeUniversitaire = filters.anneeUniversitaire;

    return await prisma.campagneAffectation.findMany({
      where,
      include: {
        campagneSpecialites: {
          include: { specialite: true },
        },
      },
      orderBy: { dateDebut: "desc" },
    });
  } catch (error) {
    logger.error("Error fetching affectation campaigns:", error);
    throw error;
  }
};

export const getAffectationCampaignById = async (id: number) => {
  try {
    const campaign = await prisma.campagneAffectation.findUnique({
      where: { id },
      include: {
        campagneSpecialites: {
          include: { specialite: true },
        },
        voeux: {
          include: {
            etudiant: { include: { user: true } },
            specialite: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error("Affectation campaign not found");
    }

    return campaign;
  } catch (error) {
    logger.error("Error fetching affectation campaign:", error);
    throw error;
  }
};

export const updateAffectationCampaign = async (
  id: number,
  input: UpdateAffectationCampaignInput
) => {
  try {
    const campaign = await prisma.campagneAffectation.update({
      where: { id },
      data: {
        nom_ar: input.nom,
        dateDebut: input.dateDebut,
        dateFin: input.dateFin,
        status: mapCampaignStatus(input.status),
      },
    });

    logger.info(`Affectation campaign updated: ${id}`);
    return campaign;
  } catch (error) {
    logger.error("Error updating affectation campaign:", error);
    throw error;
  }
};

export const closeAffectationCampaign = async (id: number) => {
  try {
    const campaign = await prisma.campagneAffectation.update({
      where: { id },
      data: { status: StatusCampagne.fermee },
    });

    logger.info(`Affectation campaign closed: ${id}`);
    return campaign;
  } catch (error) {
    logger.error("Error closing affectation campaign:", error);
    throw error;
  }
};

export const getStudentVoeux = async (studentId: number, campaignId?: number) => {
  try {
    const where: Prisma.VoeuWhereInput = { etudiantId: studentId };

    if (campaignId) where.campagneId = campaignId;

    return await prisma.voeu.findMany({
      where,
      include: {
        specialite: true,
        campagne: true,
      },
      orderBy: [{ campagneId: "desc" }, { ordre: "asc" }],
    });
  } catch (error) {
    logger.error("Error fetching student voeux:", error);
    throw error;
  }
};

export const getAffectationResults = async (campaignId: number) => {
  try {
    return await prisma.voeu.findMany({
      where: {
        campagneId: campaignId,
        status: StatusVoeu.accepte,
      },
      include: {
        etudiant: { include: { user: true } },
        specialite: true,
        campagne: true,
      },
      orderBy: { specialiteId: "asc" },
    });
  } catch (error) {
    logger.error("Error fetching affectation results:", error);
    throw error;
  }
};

export const getStudentAffectation = async (studentId: number) => {
  try {
    return await prisma.voeu.findFirst({
      where: {
        etudiantId: studentId,
        status: StatusVoeu.accepte,
      },
      include: {
        specialite: true,
        campagne: true,
      },
      orderBy: { dateSaisie: "desc" },
    });
  } catch (error) {
    logger.error("Error fetching student affectation:", error);
    throw error;
  }
};

export const getAffectationStats = async (campaignId?: number) => {
  try {
    const where: Prisma.VoeuWhereInput = {};
    if (campaignId) where.campagneId = campaignId;

    const [totalAffectations, successfulAffectations] = await Promise.all([
      prisma.voeu.count({ where }),
      prisma.voeu.count({
        where: { ...where, status: StatusVoeu.accepte },
      }),
    ]);

    return {
      totalAffectations,
      successfulAffectations,
      successRate:
        totalAffectations > 0
          ? Math.round((successfulAffectations / totalAffectations) * 100)
          : 0,
    };
  } catch (error) {
    logger.error("Error fetching affectation stats:", error);
    throw error;
  }
};

export const getCampaignStats = async (campaignId: number) => {
  try {
    const [totalVoeux, totalAffectations] = await Promise.all([
      prisma.voeu.count({ where: { campagneId: campaignId } }),
      prisma.voeu.count({ where: { campagneId: campaignId, status: StatusVoeu.accepte } }),
    ]);

    return {
      campaignId,
      totalVoeux,
      totalAffectations,
      voeux_to_affectation_ratio:
        totalVoeux > 0 ? totalAffectations / totalVoeux : 0,
    };
  } catch (error) {
    logger.error("Error fetching campaign stats:", error);
    throw error;
  }
};
