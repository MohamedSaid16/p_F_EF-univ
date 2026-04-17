// src/controllers/discipline/discipline.controller.ts
// Consolidated Disciplinary Module Controller
// Integrates Conseil, Dossier, Decision, and Infraction management

import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import prisma from "../../config/database";

/* ════════════════════════════════════════════════════════════════
   INCLUDE QUERIES (Reusable Relations)
   ════════════════════════════════════════════════════════════════ */

const dossierInclude = {
  etudiant: {
    include: {
      user: { select: { nom: true, prenom: true, email: true } },
      promo: {
        include: {
          specialite: {
            include: { filiere: { select: { id: true, nom_ar: true, nom_en: true } } },
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

const conseilInclude = {
  membres: {
    include: {
      enseignant: {
        include: {
          user: { select: { nom: true, prenom: true } },
          grade: { select: { id: true, nom_ar: true, nom_en: true } },
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
                include: { filiere: { select: { id: true, nom_ar: true, nom_en: true } } },
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
};

/* ════════════════════════════════════════════════════════════════
   DOSSIER DISCIPLINAIRE HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/cd/dossiers-disciplinaires
 * GET /api/v1/cd/cases
 * List all disciplinary dossiers with optional filters
 */
export const listDossiersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, conseilId, search, gravite, studentId } = req.query;

    const dossiers = await prisma.dossierDisciplinaire.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(conseilId && { conseilId: Number(conseilId) }),
        ...(gravite && { infraction: { gravite: gravite as any } }),
        ...(studentId && { etudiantId: Number(studentId) }),
        ...(search && {
          OR: [
            {
              etudiant: {
                user: {
                  OR: [
                    { nom: { contains: search as string, mode: "insensitive" } },
                    { prenom: { contains: search as string, mode: "insensitive" } },
                  ],
                },
              },
            },
            {
              descriptionSignal_ar: { contains: search as string, mode: "insensitive" },
            },
            {
              descriptionSignal_en: { contains: search as string, mode: "insensitive" },
            },
          ],
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

/**
 * GET /api/v1/cd/dossiers-disciplinaires/:id
 * GET /api/v1/cd/cases/:id
 * Get a single dossier by ID
 */
export const getDossierHandler = async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /api/v1/cd/dossiers-disciplinaires
 * POST /api/v1/cd/cases
 * Create a new disciplinary dossier
 */
export const createDossierHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      etudiantId,
      studentId,
      infractionId,
      typeInfraction,
      descriptionSignal,
      description,
      reason,
      conseilId,
      dateSignal,
      gravite,
      studentIds,
      titre,
    } = req.body;

    // Handle multiple ways to pass student ID
    const studentIdToUse = etudiantId || studentId;
    const studentIdsArray = Array.isArray(studentIds)
      ? studentIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : Number.isInteger(Number(studentIdToUse)) && Number(studentIdToUse) > 0
      ? [Number(studentIdToUse)]
      : [];

    if (!studentIdsArray.length) {
      res.status(400).json({
        success: false,
        error: { message: "etudiantId ou studentId est obligatoire." },
      });
      return;
    }

    // Get enseignant id of logged-in user
    const enseignant = await prisma.enseignant.findUnique({
      where: { userId: req.user!.id },
    });

    // Handle infraction - either use provided ID or create from typeInfraction
    let infractionIdToUse = infractionId;

    if (!infractionIdToUse && typeInfraction) {
      // Try to find existing infraction by name
      const existingInfraction = await prisma.infraction.findFirst({
        where: {
          OR: [{ nom_ar: typeInfraction }, { nom_en: typeInfraction }],
        },
      });

      if (existingInfraction) {
        infractionIdToUse = existingInfraction.id;
      } else {
        // Create new infraction
        const newInfraction = await prisma.infraction.create({
          data: {
            nom_ar: typeInfraction,
            nom_en: typeInfraction,
            gravite: (gravite as any) || "moyenne",
          },
        });
        infractionIdToUse = newInfraction.id;
      }
    }

    if (!infractionIdToUse) {
      res.status(400).json({
        success: false,
        error: { message: "infractionId ou typeInfraction est obligatoire." },
      });
      return;
    }

    const descriptionToUse = descriptionSignal || description || reason || titre || "";

    // Create dossiers for each student
    const dossiers = await Promise.all(
      studentIdsArray.map((eid) =>
        prisma.dossierDisciplinaire.create({
          data: {
            etudiantId: eid,
            enseignantSignalant: enseignant?.id ?? null,
            infractionId: infractionIdToUse!,
            descriptionSignal_ar: descriptionToUse,
            descriptionSignal_en: descriptionToUse,
            conseilId: conseilId ? Number(conseilId) : null,
            dateSignal: dateSignal ? new Date(dateSignal) : new Date(),
            status: "signale",
          },
          include: dossierInclude,
        })
      )
    );

    // Return first if single, array if multiple
    const result = studentIdsArray.length === 1 ? dossiers[0] : dossiers;

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/cd/dossiers-disciplinaires/:id
 * PATCH /api/v1/cd/cases/:id
 * Update a disciplinary dossier
 */
export const updateDossierHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, decisionId, remarqueDecision, dateDecision, conseilId, description } = req.body;

    const dossier = await prisma.dossierDisciplinaire.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(status !== undefined && { status }),
        ...(decisionId !== undefined && { decisionId: decisionId ? Number(decisionId) : null }),
        ...(remarqueDecision !== undefined && {
          remarqueDecision_ar: remarqueDecision,
          remarqueDecision_en: remarqueDecision,
        }),
        ...(dateDecision !== undefined && {
          dateDecision: dateDecision ? new Date(dateDecision) : null,
        }),
        ...(conseilId !== undefined && {
          conseilId: conseilId ? Number(conseilId) : null,
        }),
        ...(description !== undefined && {
          descriptionSignal_ar: description,
          descriptionSignal_en: description,
        }),
      },
      include: dossierInclude,
    });

    res.json({ success: true, data: dossier });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/cd/dossiers-disciplinaires/:id
 * DELETE /api/v1/cd/cases/:id
 * Delete a disciplinary dossier
 */
export const deleteDossierHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.dossierDisciplinaire.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true, message: "Dossier supprimé." });
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════════════════════════════════════════
   CONSEIL DISCIPLINAIRE HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/cd/conseils
 * List all conseils with optional filters
 */
export const listConseilsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, annee } = req.query;

    const conseils = await prisma.conseilDisciplinaire.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(annee && { anneeUniversitaire: annee as string }),
      },
      include: conseilInclude,
      orderBy: { dateReunion: "desc" },
    });

    res.json({ success: true, data: conseils });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cd/conseils/:id
 * Get a single conseil by ID
 */
export const getConseilHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conseil = await prisma.conseilDisciplinaire.findUnique({
      where: { id: Number(req.params.id) },
      include: conseilInclude,
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

/**
 * POST /api/v1/cd/conseils
 * Create a new conseil
 */
export const createConseilHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { dateReunion, heure, lieu, anneeUniversitaire, description_ar, description_en, dossierIds = [], membres = [], presidentId } = req.body;

    if (!dateReunion || !anneeUniversitaire) {
      res.status(400).json({
        success: false,
        error: { message: "dateReunion et anneeUniversitaire sont obligatoires." },
      });
      return;
    }

    let presidentEnseignantId: number | null = null;

    // 1. Try to use the logged-in user if they're an enseignant
    if (req.user?.id) {
      const userEnseignant = await prisma.enseignant.findUnique({
        where: { userId: req.user.id },
      });
      if (userEnseignant) {
        presidentEnseignantId = userEnseignant.id;
      }
    }

    // 2. If not enseignant, use presidentId if provided
    if (!presidentEnseignantId && presidentId) {
      presidentEnseignantId = presidentId;
    }

    // 3. If still no president, use first available enseignant
    if (!presidentEnseignantId) {
      const firstEnseignant = await prisma.enseignant.findFirst({
        select: { id: true },
      });
      if (!firstEnseignant) {
        res.status(400).json({
          success: false,
          error: { message: "Aucun enseignant disponible pour présider le conseil." },
        });
        return;
      }
      presidentEnseignantId = firstEnseignant.id;
    }

    const conseil = await prisma.$transaction(async (tx) => {
      // 1. Create the conseil
      const newConseil = await tx.conseilDisciplinaire.create({
        data: {
          dateReunion: new Date(dateReunion),
          heure: heure ? new Date(`1970-01-01T${heure}:00`) : null,
          lieu,
          anneeUniversitaire,
          description_ar: description_ar || description_en,
          description_en: description_en || description_ar,
        },
      });

      // 2. Add president
      await tx.membreConseil.create({
        data: {
          conseilId: newConseil.id,
          enseignantId: presidentEnseignantId!,
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

      // 4. Link dossiers (cases) to the conseil
      if (Array.isArray(dossierIds) && dossierIds.length > 0) {
        await tx.dossierDisciplinaire.updateMany({
          where: { id: { in: dossierIds } },
          data: { conseilId: newConseil.id },
        });
      }

      // Return the created conseil with all relations
      return tx.conseilDisciplinaire.findUnique({
        where: { id: newConseil.id },
        include: conseilInclude,
      });
    });

    res.status(201).json({ success: true, data: conseil });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/cd/conseils/:id
 * Update a conseil
 */
export const updateConseilHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateReunion, heure, lieu, anneeUniversitaire, description, status } = req.body;

    const conseil = await prisma.conseilDisciplinaire.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(dateReunion && { dateReunion: new Date(dateReunion) }),
        ...(heure && { heure: new Date(`1970-01-01T${heure}:00`) }),
        ...(lieu !== undefined && { lieu }),
        ...(anneeUniversitaire && { anneeUniversitaire }),
        ...(description !== undefined && {
          description_ar: description,
          description_en: description,
        }),
        ...(status && { status }),
      },
      include: conseilInclude,
    });

    res.json({ success: true, data: conseil });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/cd/conseils/:id
 * Delete a conseil
 */
export const deleteConseilHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.conseilDisciplinaire.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true, message: "Conseil supprimé." });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/cd/conseils/:id/finaliser
 * Finalize a conseil and record decisions
 */
export const finaliserConseilHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { drafts } = req.body as {
      drafts?: Array<{
        caseId: number;
        decision: string;
        sanctions?: string;
        dateDecision?: string;
        status?: string;
      }>;
    };

    await prisma.$transaction(async (tx) => {
      // Update conseil status
      await tx.conseilDisciplinaire.update({
        where: { id: Number(id) },
        data: { status: "termine" },
      });

      // Process each decision
      if (Array.isArray(drafts) && drafts.length > 0) {
        for (const d of drafts) {
          // Create decision record
          const decisionRecord = await tx.decision.create({
            data: {
              nom_ar: d.decision,
              nom_en: d.decision,
              description_ar: d.sanctions,
              description_en: d.sanctions,
            },
          });

          // Update dossier with decision
          await tx.dossierDisciplinaire.update({
            where: { id: d.caseId },
            data: {
              decisionId: decisionRecord.id,
              remarqueDecision_ar: d.sanctions,
              remarqueDecision_en: d.sanctions,
              dateDecision: d.dateDecision ? new Date(d.dateDecision) : new Date(),
              status: (d.status || "traite") as "signale" | "en_instruction" | "jugement" | "traite",
            },
          });
        }
      }
    });

    res.json({ success: true, message: "Conseil finalisé." });
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════════════════════════════════════════
   MEMBRE CONSEIL HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * POST /api/v1/cd/conseils/:cid/membres
 * Add a member to a conseil
 */
export const addMembreHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conseilId = Number(req.params.cid);
    const { enseignantId, role } = req.body as { enseignantId: number; role?: string };

    if (!conseilId || !enseignantId) {
      res.status(400).json({
        success: false,
        error: { message: "conseilId et enseignantId sont obligatoires." },
      });
      return;
    }

    const membre = await prisma.membreConseil.create({
      data: {
        conseilId,
        enseignantId,
        role: (role || "membre") as "president" | "rapporteur" | "membre",
      },
      include: {
        enseignant: {
          include: {
            user: { select: { nom: true, prenom: true } },
          },
        },
      },
    });

    res.status(201).json({ success: true, data: membre });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/cd/conseils/:cid/membres/:mid
 * Remove a member from a conseil
 */
export const removeMembreHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.mid);
    if (!id) {
      res.status(400).json({
        success: false,
        error: { message: "Membre ID est obligatoire." },
      });
      return;
    }

    await prisma.membreConseil.delete({
      where: { id },
    });
    res.json({ success: true, message: "Membre supprimé du conseil." });
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════════════════════════════════════════
   INFRACTION HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/cd/infractions
 * List all infractions
 */
export const listInfractionsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const infractions = await prisma.infraction.findMany({
      orderBy: { nom_ar: "asc" },
    });
    res.json({ success: true, data: infractions });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cd/infractions/:id
 * Get a single infraction
 */
export const getInfractionHandler = async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /api/v1/cd/infractions
 * Create a new infraction
 */
export const createInfractionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, nom_ar, nom_en, description, description_ar, description_en, gravite } = req.body;

    if (!nom && !nom_ar && !nom_en) {
      res.status(400).json({
        success: false,
        error: { message: "nom ou nom_ar/nom_en est obligatoire." },
      });
      return;
    }

    if (!gravite) {
      res.status(400).json({
        success: false,
        error: { message: "gravite est obligatoire (faible, moyenne, grave, très_grave)." },
      });
      return;
    }

    const infraction = await prisma.infraction.create({
      data: {
        nom_ar: nom_ar || nom,
        nom_en: nom_en || nom,
        description_ar: description_ar || description,
        description_en: description_en || description,
        gravite,
      },
    });

    res.status(201).json({ success: true, data: infraction });
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════════════════════════════════════════
   DECISION HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/cd/decisions
 * List all decisions
 */
export const listDecisionsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const decisions = await prisma.decision.findMany({
      orderBy: { nom_ar: "asc" },
    });
    res.json({ success: true, data: decisions });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cd/decisions/:id
 * Get a single decision
 */
export const getDecisionHandler = async (req: Request, res: Response, next: NextFunction) => {
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

/**
 * POST /api/v1/cd/decisions
 * Create a new decision
 */
export const createDecisionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, nom_ar, nom_en, description, description_ar, description_en, niveauSanction } = req.body;

    if (!nom && !nom_ar && !nom_en) {
      res.status(400).json({
        success: false,
        error: { message: "nom ou nom_ar/nom_en est obligatoire." },
      });
      return;
    }

    const decision = await prisma.decision.create({
      data: {
        nom_ar: nom_ar || nom,
        nom_en: nom_en || nom,
        description_ar: description_ar || description,
        description_en: description_en || description,
        niveauSanction,
      },
    });

    res.status(201).json({ success: true, data: decision });
  } catch (error) {
    next(error);
  }
};

/* ════════════════════════════════════════════════════════════════
   STUDENT & STATISTICS HANDLERS
   ════════════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/cd/students
 * List all students (for discipline module dropdown)
 */
export const listDisciplineStudentsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || "").trim();

    const students = await prisma.etudiant.findMany({
      where: q
        ? {
            OR: [
              { user: { nom: { contains: q, mode: "insensitive" } } },
              { user: { prenom: { contains: q, mode: "insensitive" } } },
              { matricule: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      select: {
        id: true,
        matricule: true,
        user: { select: { nom: true, prenom: true } },
      },
      take: 50,
    });

    const formatted = students.map((s) => ({
      id: s.id,
      matricule: s.matricule,
      fullName: `${s.user.prenom} ${s.user.nom}`,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cd/students/:id/profile
 * Get student's disciplinary profile
 */
export const getDisciplineStudentProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = Number(req.params.id);

    const profile = await prisma.etudiant.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { nom: true, prenom: true, email: true } },
        promo: {
          include: {
            specialite: { select: { id: true, nom_ar: true, nom_en: true } },
          },
        },
      },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: { message: "Étudiant introuvable." } });
      return;
    }

    // Get student's dossiers
    const dossiers = await prisma.dossierDisciplinaire.findMany({
      where: { etudiantId: studentId },
      include: {
        infraction: true,
        decision: true,
        conseil: { select: { dateReunion: true } },
      },
      orderBy: { dateSignal: "desc" },
    });

    res.json({
      success: true,
      data: {
        student: profile,
        dossiers,
        stats: {
          totalCases: dossiers.length,
          pendingCases: dossiers.filter((d) => d.status === "signale").length,
          completedCases: dossiers.filter((d) => d.status === "traite").length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cd/stats
 * Get disciplinary statistics
 */
export const statsHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalDossiers, pendingDossiers, completedDossiers, totalConseils, totalInfractions, totalDecisions] =
      await Promise.all([
        prisma.dossierDisciplinaire.count(),
        prisma.dossierDisciplinaire.count({ where: { status: "signale" } }),
        prisma.dossierDisciplinaire.count({ where: { status: "traite" } }),
        prisma.conseilDisciplinaire.count(),
        prisma.infraction.count(),
        prisma.decision.count(),
      ]);

    res.json({
      success: true,
      data: {
        dossiers: {
          total: totalDossiers,
          pending: pendingDossiers,
          completed: completedDossiers,
        },
        conseils: totalConseils,
        infractions: totalInfractions,
        decisions: totalDecisions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/cd/record-decision
 * Record a decision for a dossier
 */
export const recordDecisionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dossierId, decisionId, remarque, dateDecision } = req.body;

    if (!dossierId || !decisionId) {
      res.status(400).json({
        success: false,
        error: { message: "dossierId et decisionId sont obligatoires." },
      });
      return;
    }

    const dossier = await prisma.dossierDisciplinaire.update({
      where: { id: dossierId },
      data: {
        decisionId,
        remarqueDecision_ar: remarque,
        remarqueDecision_en: remarque,
        dateDecision: dateDecision ? new Date(dateDecision) : new Date(),
        status: "traite",
      },
      include: dossierInclude,
    });

    res.json({ success: true, data: dossier });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/cd/staff
 * Get available staff members for discipline council
 */
export const listStaffHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const staff = await prisma.enseignant.findMany({
      select: {
        id: true,
        user: {
          select: {
            nom: true,
            prenom: true,
            email: true,
          },
        },
        grade: {
          select: {
            id: true,
            nom_ar: true,
            nom_en: true,
          },
        },
      },
      orderBy: { user: { nom: 'asc' } },
    });

    const formatted = staff.map((s) => ({
      id: s.id,
      name: [s.user?.prenom, s.user?.nom].filter(Boolean).join(' ').trim(),
      email: s.user?.email,
      grade: s.grade?.nom_en || s.grade?.nom_ar || 'Staff',
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/cd/meetings
 * Alias for scheduling meetings (create conseil)
 */
export const scheduleMeetingHandler = createConseilHandler;
