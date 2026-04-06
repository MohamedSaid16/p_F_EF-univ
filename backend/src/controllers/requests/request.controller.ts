import { Response } from "express";
import prisma from "../../config/database";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { Prisma, StatusJustification, StatusReclamation } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { createNotification } from "../../services/common/notification.service";
import { writeAuditLogSafe } from "../../services/common/audit-log.service";
import {
  appendRequestWorkflowEvent,
  ensureRequestWorkflowHistoryTable,
  ensureRequestWorkflowSubmitted,
  listRequestWorkflowHistory,
  loadLatestWorkflowStageMap,
  mapJustificationStatusToWorkflowStage,
  mapReclamationStatusToWorkflowStage,
  RequestWorkflowAction,
  RequestWorkflowCategory,
  RequestWorkflowStage,
} from "../../services/requests/workflow.service";

type RequestAttachmentPayload = {
  id: number | string;
  name: string;
  type: string;
  size: string;
  mimeType: string | null;
  fileSize: number | null;
  url: string | null;
  downloadUrl: string | null;
  isImage: boolean;
  createdAt: Date | null;
};

type ReclamationDocumentRow = {
  id: number;
  reclamationId: number;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  fileSize: bigint | number | null;
  createdAt: Date;
};

type JustificationDocumentRow = {
  id: number;
  justificationId: number;
  filePath: string;
  fileName: string;
  mimeType: string | null;
  fileSize: bigint | number | null;
  createdAt: Date;
};

let requestSupportTablesInitialized = false;

const normalizeStoredPath = (storedPath: string): string =>
  storedPath.replace(/\\/g, "/").replace(/^\/+/, "");

const toPublicFileUrl = (storedPath?: string | null): string | null => {
  if (!storedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(storedPath)) {
    return storedPath;
  }

  const normalized = normalizeStoredPath(storedPath);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("uploads/")) {
    return `/${normalized}`;
  }

  return `/uploads/${normalized.replace(/^uploads\//, "")}`;
};

const toNumber = (value: bigint | number | null | undefined): number | null => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return null;
};

const formatAttachmentSize = (value: bigint | number | null | undefined): string => {
  const size = toNumber(value);
  if (!size || Number.isNaN(size) || size <= 0) {
    return "N/A";
  }

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const inferAttachmentKind = (mimeType?: string | null, fileName?: string): string => {
  const mime = String(mimeType || "").toLowerCase();
  const extension = path.extname(fileName || "").toLowerCase();

  if (
    mime.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"].includes(extension)
  ) {
    return "Image";
  }

  if (mime === "application/pdf" || extension === ".pdf") {
    return "PDF";
  }

  if (mime.startsWith("text/") || extension === ".txt") {
    return "Text";
  }

  return "Document";
};

const buildAttachmentPayload = (input: {
  id: number | string;
  filePath: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: bigint | number | null;
  createdAt?: Date | null;
}): RequestAttachmentPayload => {
  const normalizedFileName =
    input.fileName?.trim() || path.basename(normalizeStoredPath(input.filePath || "attachment"));
  const kind = inferAttachmentKind(input.mimeType, normalizedFileName);
  const publicUrl = toPublicFileUrl(input.filePath);

  return {
    id: input.id,
    name: normalizedFileName,
    type: kind,
    size: formatAttachmentSize(input.fileSize),
    mimeType: input.mimeType || null,
    fileSize: toNumber(input.fileSize),
    url: publicUrl,
    downloadUrl: publicUrl,
    isImage: kind === "Image",
    createdAt: input.createdAt || null,
  };
};

const parseLegacyJustificationAttachments = (rawDocument?: string | null): RequestAttachmentPayload[] => {
  const rawValue = String(rawDocument || "").trim();
  if (!rawValue) {
    return [];
  }

  const attachments: RequestAttachmentPayload[] = [];

  if (rawValue.startsWith("[") || rawValue.startsWith("{")) {
    try {
      const parsed = JSON.parse(rawValue);
      const values = Array.isArray(parsed) ? parsed : [parsed];

      values.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return;
        }

        const filePath = String(
          (entry as Record<string, unknown>).filePath ||
            (entry as Record<string, unknown>).path ||
            (entry as Record<string, unknown>).url ||
            ""
        ).trim();

        if (!filePath) {
          return;
        }

        const fileName = String(
          (entry as Record<string, unknown>).fileName ||
            (entry as Record<string, unknown>).name ||
            path.basename(filePath)
        ).trim();

        const mimeType = String((entry as Record<string, unknown>).mimeType || "").trim() || null;
        const fileSize = Number((entry as Record<string, unknown>).fileSize || 0);
        const createdAtRaw = (entry as Record<string, unknown>).createdAt;
        const createdAt = createdAtRaw ? new Date(String(createdAtRaw)) : null;

        attachments.push(
          buildAttachmentPayload({
            id: `legacy-${index}-${fileName}`,
            filePath,
            fileName,
            mimeType,
            fileSize: Number.isFinite(fileSize) && fileSize > 0 ? fileSize : null,
            createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
          })
        );
      });

      if (attachments.length) {
        return attachments;
      }
    } catch {
      // Fallback to legacy plain string path
    }
  }

  return [
    buildAttachmentPayload({
      id: `legacy-${path.basename(rawValue)}`,
      filePath: rawValue,
      fileName: path.basename(rawValue),
      mimeType: null,
      fileSize: null,
      createdAt: null,
    }),
  ];
};

const ensureRequestSupportTables = async () => {
  if (requestSupportTablesInitialized) {
    return;
  }

  await fs.mkdir(path.join(process.cwd(), "uploads", "student-requests"), { recursive: true });

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_reclamation_documents (
      id SERIAL PRIMARY KEY,
      reclamation_id INTEGER NOT NULL REFERENCES reclamations(id) ON DELETE CASCADE,
      etudiant_id INTEGER NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120),
      file_size BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_reclamation_documents_reclamation_id
    ON student_reclamation_documents(reclamation_id)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_reclamation_documents_etudiant_id
    ON student_reclamation_documents(etudiant_id)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS student_justification_documents (
      id SERIAL PRIMARY KEY,
      justification_id INTEGER NOT NULL REFERENCES justifications(id) ON DELETE CASCADE,
      etudiant_id INTEGER NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120),
      file_size BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_justification_documents_justification_id
    ON student_justification_documents(justification_id)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_student_justification_documents_etudiant_id
    ON student_justification_documents(etudiant_id)
  `);

  await ensureRequestWorkflowHistoryTable();

  requestSupportTablesInitialized = true;
};

const loadReclamationAttachmentsMap = async (reclamationIds: number[]) => {
  const map = new Map<number, RequestAttachmentPayload[]>();

  if (!reclamationIds.length) {
    return map;
  }

  const rows = await prisma.$queryRaw<ReclamationDocumentRow[]>(Prisma.sql`
    SELECT
      id,
      reclamation_id AS "reclamationId",
      file_path AS "filePath",
      file_name AS "fileName",
      mime_type AS "mimeType",
      file_size AS "fileSize",
      created_at AS "createdAt"
    FROM student_reclamation_documents
    WHERE reclamation_id IN (${Prisma.join(reclamationIds)})
    ORDER BY created_at DESC
  `);

  rows.forEach((row) => {
    const group = map.get(row.reclamationId) || [];
    group.push(
      buildAttachmentPayload({
        id: row.id,
        filePath: row.filePath,
        fileName: row.fileName,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
      })
    );
    map.set(row.reclamationId, group);
  });

  return map;
};

const loadJustificationAttachmentsMap = async (justificationIds: number[]) => {
  const map = new Map<number, RequestAttachmentPayload[]>();

  if (!justificationIds.length) {
    return map;
  }

  const rows = await prisma.$queryRaw<JustificationDocumentRow[]>(Prisma.sql`
    SELECT
      id,
      justification_id AS "justificationId",
      file_path AS "filePath",
      file_name AS "fileName",
      mime_type AS "mimeType",
      file_size AS "fileSize",
      created_at AS "createdAt"
    FROM student_justification_documents
    WHERE justification_id IN (${Prisma.join(justificationIds)})
    ORDER BY created_at DESC
  `);

  rows.forEach((row) => {
    const group = map.get(row.justificationId) || [];
    group.push(
      buildAttachmentPayload({
        id: row.id,
        filePath: row.filePath,
        fileName: row.fileName,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        createdAt: row.createdAt,
      })
    );
    map.set(row.justificationId, group);
  });

  return map;
};

// ─── Helper: récupérer Etudiant.id depuis User.id ───────────────────────────
const getEtudiantId = async (userId?: number): Promise<number | null> => {
  if (typeof userId === "number") {
    const etudiant = await prisma.etudiant.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (etudiant) return etudiant.id;
  }

  return null;
};

const isAdminRole = (roles: string[] = []): boolean => {
  return roles.some((role) => ["admin", "vice_doyen"].includes(role));
};

const mapReclamationStatusToUi = (status: StatusReclamation, response?: string | null) => {
  if (status === StatusReclamation.traitee) return "resolved";
  if (status === StatusReclamation.refusee) return "rejected";
  if (response && response.includes("[INFO_REQUEST]")) return "info-requested";
  if (status === StatusReclamation.en_cours || status === StatusReclamation.en_attente) return "under-review";
  return "submitted";
};

const mapJustificationStatusToUi = (status: StatusJustification, comment?: string | null) => {
  if (status === StatusJustification.valide) return "resolved";
  if (status === StatusJustification.refuse) return "rejected";
  if (comment && comment.includes("[INFO_REQUEST]")) return "info-requested";
  if (status === StatusJustification.en_verification) return "under-review";
  return "submitted";
};

const mapWorkflowStageToUiStatus = (stage: RequestWorkflowStage): string => {
  if (stage === "final_decision") {
    return "resolved";
  }

  if (["under_review", "teacher_response", "council_review"].includes(stage)) {
    return "under-review";
  }

  return "submitted";
};

const DECISION_ACTIONS = ["approve", "reject", "info", "teacher", "council"] as const;

type DecisionAction = (typeof DECISION_ACTIONS)[number];

const isDecisionAction = (value: string): value is DecisionAction => {
  return DECISION_ACTIONS.includes(value as DecisionAction);
};

const getWorkflowTransitionForDecision = (
  action: DecisionAction
): { stage: RequestWorkflowStage; actionCode: RequestWorkflowAction } => {
  switch (action) {
    case "approve":
      return { stage: "final_decision", actionCode: "approve" };
    case "reject":
      return { stage: "final_decision", actionCode: "reject" };
    case "teacher":
      return { stage: "teacher_response", actionCode: "teacher_feedback" };
    case "council":
      return { stage: "council_review", actionCode: "escalate_to_council" };
    case "info":
    default:
      return { stage: "under_review", actionCode: "request_info" };
  }
};

const buildDecisionComment = (action: DecisionAction, responseText: string): string | null => {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return null;
  }

  if (action === "info") {
    return `[INFO_REQUEST] ${trimmed}`;
  }

  if (action === "teacher") {
    return `[TEACHER_REVIEW] ${trimmed}`;
  }

  if (action === "council") {
    return `[COUNCIL_REVIEW] ${trimmed}`;
  }

  return trimmed;
};

const writeRequestAuditEvent = async (
  req: AuthRequest,
  input: {
    eventKey: string;
    action: string;
    entityType: string;
    entityId: number;
    payload?: Record<string, unknown>;
  }
) => {
  await writeAuditLogSafe({
    eventKey: input.eventKey,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actorUserId: req.user?.id ?? null,
    actorRoles: req.user?.roles || [],
    requestPath: req.originalUrl,
    requestMethod: req.method,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || null,
    payload: input.payload || null,
  });
};

const DEFAULT_RECLAMATION_TYPES = [
  { nom: "Grade Error", description: "Issue related to marks or exam grading." },
  { nom: "Schedule Conflict", description: "Conflict in timetable or exam schedule." },
  { nom: "Administrative Error", description: "Administrative or registration issue." },
  { nom: "Other", description: "Other reclamation reasons." },
];

const DEFAULT_JUSTIFICATION_TYPES = [
  { nom: "Medical", description: "Medical reason with supporting document." },
  { nom: "Family Emergency", description: "Urgent family situation." },
  { nom: "Academic Overlap", description: "Overlap with another official academic activity." },
  { nom: "Administrative Reason", description: "Institutional or administrative reason." },
  { nom: "Other", description: "Other justification reasons." },
];

const ensureDefaultReclamationTypes = async () => {
  for (const item of DEFAULT_RECLAMATION_TYPES) {
    const existing = await prisma.reclamationType.findFirst({
      where: { nom: { equals: item.nom, mode: "insensitive" } },
      select: { id: true },
    });

    if (!existing) {
      await prisma.reclamationType.create({
        data: { nom: item.nom, description: item.description },
      });
    }
  }
};

const ensureDefaultJustificationTypes = async () => {
  for (const item of DEFAULT_JUSTIFICATION_TYPES) {
    const existing = await prisma.typeAbsence.findFirst({
      where: { nom: { equals: item.nom, mode: "insensitive" } },
      select: { id: true },
    });

    if (!existing) {
      await prisma.typeAbsence.create({
        data: { nom: item.nom, description: item.description },
      });
    }
  }
};

const getRelatedTeacherUserIds = async (etudiantId: number): Promise<number[]> => {
  const student = await prisma.etudiant.findUnique({
    where: { id: etudiantId },
    select: { promoId: true },
  });

  if (!student?.promoId) {
    return [];
  }

  const teachings = await prisma.enseignement.findMany({
    where: {
      promoId: student.promoId,
      enseignantId: { not: null },
    },
    select: {
      enseignant: {
        select: {
          userId: true,
        },
      },
    },
  });

  const ids = new Set<number>();
  teachings.forEach((teaching) => {
    const userId = teaching.enseignant?.userId;
    if (typeof userId === "number") {
      ids.add(userId);
    }
  });

  return Array.from(ids);
};

const getAdminUserIds = async (): Promise<number[]> => {
  const adminUsers = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            nom: {
              in: ["admin", "vice_doyen"],
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return adminUsers.map((user) => user.id);
};

const notifyRequestDecision = async (
  etudiantId: number,
  category: "reclamation" | "justification",
  requestId: number,
  approved: boolean,
  adminComment?: string
) => {
  const student = await prisma.etudiant.findUnique({
    where: { id: etudiantId },
    select: {
      userId: true,
      user: {
        select: {
          nom: true,
          prenom: true,
        },
      },
    },
  });

  if (!student) {
    return;
  }

  const outcome = approved ? "accepted" : "rejected";
  const title = approved
    ? `${category === "reclamation" ? "Reclamation" : "Justification"} accepted`
    : `${category === "reclamation" ? "Reclamation" : "Justification"} rejected`;

  await createNotification({
    userId: student.userId,
    type: `request-${outcome}`,
    title,
    message: adminComment?.trim()
      ? adminComment.trim()
      : `Your ${category} request #${requestId} was ${outcome} by administration.`,
    metadata: {
      category,
      requestId,
      outcome,
    },
  });

  const teacherIds = await getRelatedTeacherUserIds(etudiantId);
  if (!teacherIds.length) {
    return;
  }

  const studentName = `${student.user.prenom ?? ""} ${student.user.nom ?? ""}`.trim() || "Student";
  await Promise.all(
    teacherIds.map((teacherId) =>
      createNotification({
        userId: teacherId,
        type: `request-${category}-decision`,
        title: `${category === "reclamation" ? "Reclamation" : "Justification"} ${outcome}`,
        message: `${studentName}'s ${category} request #${requestId} was ${outcome} by administration.`,
        metadata: {
          category,
          requestId,
          outcome,
          etudiantId,
        },
      })
    )
  );
};

const resolveReclamationTypeId = async (typeIdRaw: unknown, typeNameRaw: unknown): Promise<number> => {
  const parsedTypeId = Number(typeIdRaw);
  if (Number.isInteger(parsedTypeId) && parsedTypeId > 0) {
    const existing = await prisma.reclamationType.findUnique({
      where: { id: parsedTypeId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const typeName = String(typeNameRaw || "General").trim() || "General";

  const byName = await prisma.reclamationType.findFirst({
    where: { nom: { equals: typeName, mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return byName.id;

  const created = await prisma.reclamationType.create({
    data: { nom: typeName, description: "Auto-created by public request submission" },
    select: { id: true },
  });

  return created.id;
};

const resolveJustificationTypeId = async (typeIdRaw: unknown, typeNameRaw: unknown): Promise<number> => {
  const parsedTypeId = Number(typeIdRaw);
  if (Number.isInteger(parsedTypeId) && parsedTypeId > 0) {
    const existing = await prisma.typeAbsence.findUnique({
      where: { id: parsedTypeId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const typeName = String(typeNameRaw || "General").trim() || "General";

  const byName = await prisma.typeAbsence.findFirst({
    where: { nom: { equals: typeName, mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return byName.id;

  const created = await prisma.typeAbsence.create({
    data: { nom: typeName, description: "Auto-created by public justification submission" },
    select: { id: true },
  });

  return created.id;
};

// ════════════════════════════════════════════════════════════
//  RECLAMATIONS
// ════════════════════════════════════════════════════════════

// POST /api/v1/requests/reclamations
export const createReclamation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureRequestSupportTables();

    const userId = req.user?.id;
    const etudiantId = await getEtudiantId(userId);

    if (!etudiantId) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only students can submit reclamations" },
      });
      return;
    }

    const { typeId, typeName, objet, description, priorite } = req.body;
    const resolvedTypeId = await resolveReclamationTypeId(typeId, typeName);

    const uploadedFiles = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const preparedFiles = uploadedFiles.map((file) => ({
      storedPath: normalizeStoredPath(path.relative(process.cwd(), file.path)),
      fileName: file.originalname || path.basename(file.path),
      mimeType: file.mimetype || null,
      fileSize: typeof file.size === "number" ? file.size : null,
    }));

    const reclamation = await prisma.$transaction(async (tx) => {
      const created = await tx.reclamation.create({
        data: {
          etudiantId,
          typeId: resolvedTypeId,
          objet,
          description,
          priorite: priorite ?? "normale",
          status: "soumise",
        },
        include: {
          type: { select: { nom: true } },
          etudiant: {
            include: {
              user: { select: { nom: true, prenom: true, email: true } },
            },
          },
        },
      });

      for (const file of preparedFiles) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO student_reclamation_documents (
            reclamation_id,
            etudiant_id,
            file_path,
            file_name,
            mime_type,
            file_size,
            created_at
          )
          VALUES (
            ${created.id},
            ${etudiantId},
            ${file.storedPath},
            ${file.fileName},
            ${file.mimeType},
            ${file.fileSize},
            NOW()
          )
        `);
      }

      return created;
    });

    await ensureRequestWorkflowSubmitted({
      requestCategory: "reclamation",
      requestId: reclamation.id,
      actorUserId: req.user?.id ?? null,
      actorRoles: req.user?.roles || [],
      note: "Student submitted reclamation",
      metadata: {
        status: reclamation.status,
        source: "student_portal",
      },
    });

    await writeRequestAuditEvent(req, {
      eventKey: "requests.reclamation.created",
      action: "create",
      entityType: "reclamation",
      entityId: reclamation.id,
      payload: {
        etudiantId,
        typeId: resolvedTypeId,
      },
    });

    try {
      const adminUserIds = await getAdminUserIds();
      const studentName = `${reclamation.etudiant.user.prenom ?? ""} ${reclamation.etudiant.user.nom ?? ""}`.trim() || "Student";
      await Promise.all(
        adminUserIds.map((adminUserId) =>
          createNotification({
            userId: adminUserId,
            type: "request-reclamation-submitted",
            title: "New reclamation submitted",
            message: `${studentName} submitted reclamation #${reclamation.id}.`,
            metadata: {
              category: "reclamation",
              requestId: reclamation.id,
              etudiantId,
            },
          })
        )
      );
    } catch (notificationError) {
      console.warn("Unable to notify admins for reclamation submission", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Reclamation submitted successfully",
      data: reclamation,
    });
  } catch (error) {
    console.error("createReclamation error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// GET /api/v1/requests/reclamations
export const getMyReclamations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const etudiantId = await getEtudiantId(userId);

    if (!etudiantId) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only students can view reclamations" },
      });
      return;
    }

    const { status } = req.query;
    const where: any = { etudiantId };
    if (status) where.status = status;

    const reclamations = await prisma.reclamation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        type: { select: { nom: true } },
      },
    });

    const workflowStageMap = await loadLatestWorkflowStageMap(
      "reclamation",
      reclamations.map((item) => item.id)
    );

    // Stats pour les cartes du dashboard
    const all = await prisma.reclamation.findMany({
      where: { etudiantId },
      select: { status: true },
    });

    const stats = {
      total: all.length,
      pending: all.filter((r) => r.status === "soumise" || r.status === "en_cours").length,
      resolved: all.filter((r) => r.status === "traitee").length,
      rejected: all.filter((r) => r.status === "refusee").length,
    };

    res.status(200).json({
      success: true,
      data: reclamations.map((item) => ({
        ...item,
        workflowStage: workflowStageMap.get(item.id) || mapReclamationStatusToWorkflowStage(item.status),
      })),
      stats,
    });
  } catch (error) {
    console.error("getMyReclamations error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// GET /api/v1/requests/admin/inbox
export const getAdminRequestsInbox = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.roles)) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only admin can access requests inbox" },
      });
      return;
    }

    await ensureRequestSupportTables();

    const [reclamations, justifications] = await Promise.all([
      prisma.reclamation.findMany({
        include: {
          type: { select: { nom: true } },
          etudiant: {
            select: {
              id: true,
              userId: true,
              matricule: true,
              promo: { select: { section: true } },
              user: { select: { nom: true, prenom: true } },
            },
          },
        },
      }),
      prisma.justification.findMany({
        include: {
          type: { select: { nom: true } },
          etudiant: {
            select: {
              id: true,
              userId: true,
              matricule: true,
              promo: { select: { section: true } },
              user: { select: { nom: true, prenom: true } },
            },
          },
        },
      }),
    ]);

    const [
      reclamationAttachmentsMap,
      justificationAttachmentsMap,
      reclamationWorkflowStageMap,
      justificationWorkflowStageMap,
    ] = await Promise.all([
      loadReclamationAttachmentsMap(reclamations.map((item) => item.id)),
      loadJustificationAttachmentsMap(justifications.map((item) => item.id)),
      loadLatestWorkflowStageMap("reclamation", reclamations.map((item) => item.id)),
      loadLatestWorkflowStageMap("justification", justifications.map((item) => item.id)),
    ]);

    const mappedReclamations = reclamations.map((item) => {
      const studentName = `${item.etudiant.user.prenom ?? ""} ${item.etudiant.user.nom ?? ""}`.trim() || "Student";
      const workflowStage =
        reclamationWorkflowStageMap.get(item.id) || mapReclamationStatusToWorkflowStage(item.status);

      return {
        id: `REC-${item.id}`,
        requestId: item.id,
        category: "reclamation",
        title: item.objet,
        description: item.description,
        type: item.type.nom || "Reclamation",
        status: mapReclamationStatusToUi(item.status, item.reponse),
        priority: ["haute", "urgente"].includes(String(item.priorite)) ? "high" : "normal",
        dateSubmitted: item.createdAt,
        studentName,
        studentEtudiantId: item.etudiant.id,
        studentUserId: item.etudiant.userId || null,
        studentId: item.etudiant.matricule || `ETU-${item.etudiant.id}`,
        department: item.etudiant.promo?.section || "N/A",
        attachments: reclamationAttachmentsMap.get(item.id) || [],
        internalNotes: item.reponse || "",
        linkedExam: null,
        workflowStage,
        workflowStatus: mapWorkflowStageToUiStatus(workflowStage),
      };
    });

    const mappedJustifications = justifications.map((item) => {
      const studentName = `${item.etudiant.user.prenom ?? ""} ${item.etudiant.user.nom ?? ""}`.trim() || "Student";
      const workflowStage =
        justificationWorkflowStageMap.get(item.id) || mapJustificationStatusToWorkflowStage(item.status);
      const tableAttachments = justificationAttachmentsMap.get(item.id) || [];
      const mergedByKey = new Map<string, RequestAttachmentPayload>();

      tableAttachments.forEach((attachment) => {
        mergedByKey.set(`${attachment.name}-${attachment.url || ""}`, attachment);
      });

      if (!tableAttachments.length) {
        parseLegacyJustificationAttachments(item.document).forEach((attachment) => {
          const key = `${attachment.name}-${attachment.url || ""}`;
          if (!mergedByKey.has(key)) {
            mergedByKey.set(key, attachment);
          }
        });
      }

      return {
        id: `JUS-${item.id}`,
        requestId: item.id,
        category: "justification",
        title: item.motif || "Absence Justification",
        description: item.motif || "No additional description provided",
        type: item.type.nom || "Justification",
        status: mapJustificationStatusToUi(item.status, item.commentaireAdmin),
        priority: "normal",
        dateSubmitted: item.createdAt,
        studentName,
        studentEtudiantId: item.etudiant.id,
        studentUserId: item.etudiant.userId || null,
        studentId: item.etudiant.matricule || `ETU-${item.etudiant.id}`,
        department: item.etudiant.promo?.section || "N/A",
        attachments: Array.from(mergedByKey.values()),
        internalNotes: item.commentaireAdmin || "",
        linkedExam: null,
        workflowStage,
        workflowStatus: mapWorkflowStageToUiStatus(workflowStage),
      };
    });

    const data = [...mappedReclamations, ...mappedJustifications].sort(
      (a, b) => new Date(b.dateSubmitted).getTime() - new Date(a.dateSubmitted).getTime()
    );

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getAdminRequestsInbox error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// POST /api/v1/requests/admin/reclamations/:id/decision
export const decideReclamation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.roles)) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only admin can decide requests" },
      });
      return;
    }

    const reclamationId = Number(req.params.id);
    if (!Number.isInteger(reclamationId) || reclamationId <= 0) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid reclamation id" } });
      return;
    }

    const action = String(req.body?.action || "").toLowerCase();
    const responseText = String(req.body?.responseText || "").trim();
    if (!isDecisionAction(action)) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid action" } });
      return;
    }

    const status: StatusReclamation =
      action === "approve"
        ? StatusReclamation.traitee
        : action === "reject"
          ? StatusReclamation.refusee
          : StatusReclamation.en_cours;

    const responseValue = buildDecisionComment(action, responseText);
    const workflowTransition = getWorkflowTransitionForDecision(action);

    const updated = await prisma.reclamation.update({
      where: { id: reclamationId },
      data: {
        status,
        traitePar: req.user?.id,
        dateTraitement: new Date(),
        reponse: responseValue,
      },
      include: {
        etudiant: { select: { id: true } },
      },
    });

    await appendRequestWorkflowEvent({
      requestCategory: "reclamation",
      requestId: updated.id,
      stage: workflowTransition.stage,
      action: workflowTransition.actionCode,
      actorUserId: req.user?.id ?? null,
      actorRoles: req.user?.roles || [],
      note: responseText || undefined,
      metadata: {
        decision: action,
        status,
      },
    });

    await writeRequestAuditEvent(req, {
      eventKey: "requests.reclamation.decision",
      action: action,
      entityType: "reclamation",
      entityId: updated.id,
      payload: {
        decision: action,
        status,
      },
    });

    if (action === "approve" || action === "reject") {
      await notifyRequestDecision(
        updated.etudiant.id,
        "reclamation",
        updated.id,
        action === "approve",
        responseText
      );
    }

    res.status(200).json({
      success: true,
      data: {
        ...updated,
        workflowStage: workflowTransition.stage,
      },
    });
  } catch (error) {
    console.error("decideReclamation error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// ════════════════════════════════════════════════════════════
//  JUSTIFICATIONS
// ════════════════════════════════════════════════════════════

// POST /api/v1/requests/justifications
export const createJustification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureRequestSupportTables();

    const userId = req.user?.id;
    const etudiantId = await getEtudiantId(userId);

    if (!etudiantId) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only students can submit justifications" },
      });
      return;
    }

    const { typeId, typeName, dateAbsence, motif } = req.body;
    const resolvedTypeId = await resolveJustificationTypeId(typeId, typeName);

    const uploadedFiles = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const preparedFiles = uploadedFiles.map((file) => ({
      storedPath: normalizeStoredPath(path.relative(process.cwd(), file.path)),
      fileName: file.originalname || path.basename(file.path),
      mimeType: file.mimetype || null,
      fileSize: typeof file.size === "number" ? file.size : null,
    }));

    const justification = await prisma.$transaction(async (tx) => {
      const created = await tx.justification.create({
        data: {
          etudiantId,
          typeId: resolvedTypeId,
          dateAbsence: new Date(dateAbsence),
          motif: motif ?? null,
          document: preparedFiles[0]?.storedPath || null,
          status: "soumis",
        },
        include: {
          type: { select: { nom: true } },
          etudiant: {
            include: {
              user: { select: { nom: true, prenom: true, email: true } },
            },
          },
        },
      });

      for (const file of preparedFiles) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO student_justification_documents (
            justification_id,
            etudiant_id,
            file_path,
            file_name,
            mime_type,
            file_size,
            created_at
          )
          VALUES (
            ${created.id},
            ${etudiantId},
            ${file.storedPath},
            ${file.fileName},
            ${file.mimeType},
            ${file.fileSize},
            NOW()
          )
        `);
      }

      return created;
    });

    await ensureRequestWorkflowSubmitted({
      requestCategory: "justification",
      requestId: justification.id,
      actorUserId: req.user?.id ?? null,
      actorRoles: req.user?.roles || [],
      note: "Student submitted justification",
      metadata: {
        status: justification.status,
        source: "student_portal",
      },
    });

    await writeRequestAuditEvent(req, {
      eventKey: "requests.justification.created",
      action: "create",
      entityType: "justification",
      entityId: justification.id,
      payload: {
        etudiantId,
        typeId: resolvedTypeId,
      },
    });

    try {
      const adminUserIds = await getAdminUserIds();
      const studentName = `${justification.etudiant.user.prenom ?? ""} ${justification.etudiant.user.nom ?? ""}`.trim() || "Student";
      await Promise.all(
        adminUserIds.map((adminUserId) =>
          createNotification({
            userId: adminUserId,
            type: "request-justification-submitted",
            title: "New justification submitted",
            message: `${studentName} submitted justification #${justification.id}.`,
            metadata: {
              category: "justification",
              requestId: justification.id,
              etudiantId,
            },
          })
        )
      );
    } catch (notificationError) {
      console.warn("Unable to notify admins for justification submission", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Justification submitted successfully",
      data: justification,
    });
  } catch (error) {
    console.error("createJustification error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// GET /api/v1/requests/justifications
export const getMyJustifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const etudiantId = await getEtudiantId(userId);

    if (!etudiantId) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only students can view justifications" },
      });
      return;
    }

    const { status } = req.query;
    const where: any = { etudiantId };
    if (status) where.status = status;

    const justifications = await prisma.justification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        type: { select: { nom: true } },
      },
    });

    const workflowStageMap = await loadLatestWorkflowStageMap(
      "justification",
      justifications.map((item) => item.id)
    );

    const all = await prisma.justification.findMany({
      where: { etudiantId },
      select: { status: true },
    });

    const stats = {
      total: all.length,
      pending: all.filter((j) => j.status === "soumis" || j.status === "en_verification").length,
      resolved: all.filter((j) => j.status === "valide").length,
      rejected: all.filter((j) => j.status === "refuse").length,
    };

    res.status(200).json({
      success: true,
      data: justifications.map((item) => ({
        ...item,
        workflowStage: workflowStageMap.get(item.id) || mapJustificationStatusToWorkflowStage(item.status),
      })),
      stats,
    });
  } catch (error) {
    console.error("getMyJustifications error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// POST /api/v1/requests/admin/justifications/:id/decision
export const decideJustification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.roles)) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only admin can decide requests" },
      });
      return;
    }

    const justificationId = Number(req.params.id);
    if (!Number.isInteger(justificationId) || justificationId <= 0) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid justification id" } });
      return;
    }

    const action = String(req.body?.action || "").toLowerCase();
    const responseText = String(req.body?.responseText || "").trim();
    if (!isDecisionAction(action)) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid action" } });
      return;
    }

    const status: StatusJustification =
      action === "approve"
        ? StatusJustification.valide
        : action === "reject"
          ? StatusJustification.refuse
          : StatusJustification.en_verification;

    const adminComment = buildDecisionComment(action, responseText);
    const workflowTransition = getWorkflowTransitionForDecision(action);

    const updated = await prisma.justification.update({
      where: { id: justificationId },
      data: {
        status,
        traitePar: req.user?.id,
        dateTraitement: new Date(),
        commentaireAdmin: adminComment,
      },
      include: {
        etudiant: { select: { id: true } },
      },
    });

    await appendRequestWorkflowEvent({
      requestCategory: "justification",
      requestId: updated.id,
      stage: workflowTransition.stage,
      action: workflowTransition.actionCode,
      actorUserId: req.user?.id ?? null,
      actorRoles: req.user?.roles || [],
      note: responseText || undefined,
      metadata: {
        decision: action,
        status,
      },
    });

    await writeRequestAuditEvent(req, {
      eventKey: "requests.justification.decision",
      action: action,
      entityType: "justification",
      entityId: updated.id,
      payload: {
        decision: action,
        status,
      },
    });

    if (action === "approve" || action === "reject") {
      await notifyRequestDecision(
        updated.etudiant.id,
        "justification",
        updated.id,
        action === "approve",
        responseText
      );
    }

    res.status(200).json({
      success: true,
      data: {
        ...updated,
        workflowStage: workflowTransition.stage,
      },
    });
  } catch (error) {
    console.error("decideJustification error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// GET /api/v1/requests/admin/:category/:id/workflow
export const getAdminRequestWorkflowHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!isAdminRole(req.user?.roles)) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only admin can access request workflow history" },
      });
      return;
    }

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid request id" } });
      return;
    }

    const categoryRaw = String(req.params.category || "").trim().toLowerCase();
    const requestCategory: RequestWorkflowCategory | null =
      categoryRaw === "reclamation" || categoryRaw === "justification"
        ? (categoryRaw as RequestWorkflowCategory)
        : null;

    if (!requestCategory) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Category must be reclamation or justification" },
      });
      return;
    }

    const recordStatus =
      requestCategory === "reclamation"
        ? await prisma.reclamation.findUnique({ where: { id: requestId }, select: { status: true } })
        : await prisma.justification.findUnique({ where: { id: requestId }, select: { status: true } });

    if (!recordStatus) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Request not found" },
      });
      return;
    }

    let history = await listRequestWorkflowHistory(requestCategory, requestId, 200);

    if (!history.length) {
      const fallbackStage =
        requestCategory === "reclamation"
          ? mapReclamationStatusToWorkflowStage(recordStatus.status)
          : mapJustificationStatusToWorkflowStage(recordStatus.status);

      await appendRequestWorkflowEvent({
        requestCategory,
        requestId,
        stage: fallbackStage,
        action: "manual_update",
        actorUserId: req.user?.id ?? null,
        actorRoles: req.user?.roles || [],
        note: "Backfilled workflow from current request status",
        metadata: {
          backfilled: true,
          sourceStatus: recordStatus.status,
        },
      });

      history = await listRequestWorkflowHistory(requestCategory, requestId, 200);
    }

    const currentStage =
      history[history.length - 1]?.stage ||
      (requestCategory === "reclamation"
        ? mapReclamationStatusToWorkflowStage(recordStatus.status)
        : mapJustificationStatusToWorkflowStage(recordStatus.status));

    res.status(200).json({
      success: true,
      data: {
        requestCategory,
        requestId,
        currentStage,
        history,
      },
    });
  } catch (error) {
    console.error("getAdminRequestWorkflowHistory error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  }
};

// GET /api/v1/requests/types/reclamations
export const getReclamationTypes = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureDefaultReclamationTypes();
    const types = await prisma.reclamationType.findMany({
      select: { id: true, nom: true, description: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  }
};

// GET /api/v1/requests/types/justifications
export const getJustificationTypes = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    await ensureDefaultJustificationTypes();
    const types = await prisma.typeAbsence.findMany({
      select: { id: true, nom: true, description: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  }
};
