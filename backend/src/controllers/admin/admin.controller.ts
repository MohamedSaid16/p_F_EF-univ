import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  AdminDocumentKind,
  AdminServiceError,
  createAnnouncement,
  deleteAnnouncement,
  deleteDocument,
  deleteUser,
  getDashboardOverview,
  getDocumentDownloadInfo,
  listAnnouncements,
  listDocuments,
  listReclamations,
  listUsers,
  updateAnnouncement,
  updateReclamation,
  updateUserRole,
} from "../../modules/admin/services/admin.service";

const parsePositiveInt = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

const parseNumberArray = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item > 0)
      )
    );
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseNumberArray(parsed);
    } catch (_error) {
      return [];
    }
  }

  return Array.from(
    new Set(
      trimmed
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
};

const handleControllerError = (res: Response, error: unknown, fallbackCode: string) => {
  if (error instanceof AdminServiceError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  res.status(500).json({
    success: false,
    error: {
      code: fallbackCode,
      message,
    },
  });
};

export const getAdminDashboardOverviewHandler = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const overview = await getDashboardOverview();
    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_OVERVIEW_FAILED");
  }
};

export const listAdminUsersHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await listUsers({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      role: typeof req.query.role === "string" ? req.query.role : undefined,
      page: parsePositiveInt(req.query.page),
      limit: parsePositiveInt(req.query.limit),
    });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_LIST_USERS_FAILED");
  }
};

export const updateAdminUserRoleHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = parsePositiveInt(req.params.userId);
    const role = typeof req.body?.role === "string" ? req.body.role : "";

    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_USER_ID",
          message: "A valid user id is required",
        },
      });
      return;
    }

    if (!role.trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ROLE",
          message: "A role value is required",
        },
      });
      return;
    }

    const updated = await updateUserRole(userId, role);

    res.status(200).json({
      success: true,
      data: updated,
      message: "User role updated successfully",
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_UPDATE_USER_ROLE_FAILED");
  }
};

export const deleteAdminUserHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = parsePositiveInt(req.params.userId);
    if (!targetUserId) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_USER_ID",
          message: "A valid user id is required",
        },
      });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    const result = await deleteUser(targetUserId, req.user.id);

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_DELETE_USER_FAILED");
  }
};

export const listAdminAnnouncementsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await listAnnouncements({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      target: typeof req.query.target === "string" ? req.query.target : undefined,
      page: parsePositiveInt(req.query.page),
      limit: parsePositiveInt(req.query.limit),
    });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_LIST_ANNOUNCEMENTS_FAILED");
  }
};

export const createAdminAnnouncementHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];

    const created = await createAnnouncement(
      req.user.id,
      {
        title: typeof req.body?.title === "string" ? req.body.title : req.body?.titre,
        content: typeof req.body?.content === "string" ? req.body.content : req.body?.contenu,
        status: typeof req.body?.status === "string" ? req.body.status : undefined,
        target: typeof req.body?.target === "string" ? req.body.target : req.body?.cible,
        priority: typeof req.body?.priority === "string" ? req.body.priority : req.body?.priorite,
        typeName: typeof req.body?.typeName === "string" ? req.body.typeName : req.body?.typeAnnonce,
        typeId: parsePositiveInt(req.body?.typeId) || undefined,
        expiresAt: typeof req.body?.expiresAt === "string" ? req.body.expiresAt : req.body?.dateExpiration,
      },
      files
    );

    res.status(201).json({
      success: true,
      data: created,
      message: "Announcement created successfully",
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_CREATE_ANNOUNCEMENT_FAILED");
  }
};

export const updateAdminAnnouncementHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcementId = parsePositiveInt(req.params.id);
    if (!announcementId) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ANNOUNCEMENT_ID",
          message: "A valid announcement id is required",
        },
      });
      return;
    }

    const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];

    const updated = await updateAnnouncement(
      announcementId,
      {
        title: typeof req.body?.title === "string" ? req.body.title : undefined,
        content: typeof req.body?.content === "string" ? req.body.content : undefined,
        status: typeof req.body?.status === "string" ? req.body.status : undefined,
        target: typeof req.body?.target === "string" ? req.body.target : undefined,
        priority: typeof req.body?.priority === "string" ? req.body.priority : undefined,
        typeName: typeof req.body?.typeName === "string" ? req.body.typeName : undefined,
        typeId: parsePositiveInt(req.body?.typeId) || undefined,
        expiresAt: typeof req.body?.expiresAt === "string" ? req.body.expiresAt : undefined,
        removeDocumentIds: parseNumberArray(req.body?.removeDocumentIds),
      },
      files
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: "Announcement updated successfully",
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_UPDATE_ANNOUNCEMENT_FAILED");
  }
};

export const deleteAdminAnnouncementHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcementId = parsePositiveInt(req.params.id);
    if (!announcementId) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ANNOUNCEMENT_ID",
          message: "A valid announcement id is required",
        },
      });
      return;
    }

    const result = await deleteAnnouncement(announcementId);

    res.status(200).json({
      success: true,
      data: result,
      message: "Announcement deleted successfully",
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_DELETE_ANNOUNCEMENT_FAILED");
  }
};

export const listAdminReclamationsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await listReclamations({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page: parsePositiveInt(req.query.page),
      limit: parsePositiveInt(req.query.limit),
    });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_LIST_RECLAMATIONS_FAILED");
  }
};

export const updateAdminReclamationHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reclamationId = parsePositiveInt(req.params.id);
    if (!reclamationId) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_RECLAMATION_ID",
          message: "A valid reclamation id is required",
        },
      });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["pending", "approved", "rejected"].includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_RECLAMATION_STATUS",
          message: "Status must be one of: pending, approved, rejected",
        },
      });
      return;
    }

    const updated = await updateReclamation(reclamationId, req.user.id, {
      status: status as "pending" | "approved" | "rejected",
      adminResponse: typeof req.body?.adminResponse === "string" ? req.body.adminResponse : "",
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: "Reclamation updated successfully",
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_UPDATE_RECLAMATION_FAILED");
  }
};

export const listAdminDocumentsHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await listDocuments({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      kind: typeof req.query.kind === "string" ? req.query.kind : undefined,
      page: parsePositiveInt(req.query.page),
      limit: parsePositiveInt(req.query.limit),
    });

    res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
      counts: result.counts,
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_LIST_DOCUMENTS_FAILED");
  }
};

export const downloadAdminDocumentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = String(req.params.kind || "").trim().toLowerCase();
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DOCUMENT_ID",
          message: "A valid document id is required",
        },
      });
      return;
    }

    if (!["announcement", "request", "justification"].includes(kind)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DOCUMENT_KIND",
          message: "Document kind must be announcement, request, or justification",
        },
      });
      return;
    }

    const downloadInfo = await getDocumentDownloadInfo(kind as AdminDocumentKind, id);
    res.download(downloadInfo.absolutePath, downloadInfo.fileName);
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_DOWNLOAD_DOCUMENT_FAILED");
  }
};

export const deleteAdminDocumentHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = String(req.params.kind || "").trim().toLowerCase();
    const id = parsePositiveInt(req.params.id);

    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DOCUMENT_ID",
          message: "A valid document id is required",
        },
      });
      return;
    }

    if (!["announcement", "request", "justification"].includes(kind)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DOCUMENT_KIND",
          message: "Document kind must be announcement, request, or justification",
        },
      });
      return;
    }

    const result = await deleteDocument(kind as AdminDocumentKind, id);

    res.status(200).json({
      success: true,
      data: result,
      message: "Document deleted successfully",
    });
  } catch (error: unknown) {
    handleControllerError(res, error, "ADMIN_DELETE_DOCUMENT_FAILED");
  }
};
