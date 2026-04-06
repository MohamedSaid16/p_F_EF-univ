import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  verifyEmail,
  resendVerification,
  getUserById,
  changePassword,
  createUserByAdmin,
  adminResetPassword,
  listRolesForAdmin,
  listUsersForAdmin,
  updateUserRolesByAdmin,
  updateUserStatusByAdmin,
  getAcademicManagementOptions,
  createSpecialiteForManagement,
  createPromoForManagement,
  createModuleForManagement,
  getAcademicAssignmentsData,
  assignStudentPromoByAdmin,
  assignTeacherModulesByAdmin,
  getRbacCatalogForClient,
  requestPasswordReset,
  resetPasswordWithToken,
  updateCurrentUserPhoto,
} from "../../modules/auth/auth.service";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "../../config/auth";
import { AuthRequest } from "../../middlewares/auth.middleware";

type ParsedExcelImportRow = {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  roleNames: string[];
  promoId?: number;
  specialiteId?: number;
  moduleIds?: number[];
  anneeUniversitaire?: string;
};

const pickCellValue = (row: Record<string, unknown>, aliases: string[]): string => {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      const value = row[alias];
      if (value === null || value === undefined) {
        return "";
      }
      return String(value).trim();
    }
  }
  return "";
};

const parseOptionalPositiveInteger = (rawValue: string): number | undefined => {
  if (!rawValue) return undefined;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
};

const parseOptionalPositiveIntegerList = (rawValue: string): number[] => {
  if (!rawValue) return [];
  return Array.from(
    new Set(
      rawValue
        .split(/[;,|]/)
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
};

const parseRoleNames = (rawValue: string): string[] => {
  if (!rawValue) return [];
  return Array.from(
    new Set(
      rawValue
        .split(/[;,|]/)
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
};

const parseExcelUserRow = (row: Record<string, unknown>): ParsedExcelImportRow => {
  const nom = pickCellValue(row, ["nom", "lastName", "last_name"]);
  const prenom = pickCellValue(row, ["prenom", "firstName", "first_name"]);
  const email = pickCellValue(row, ["email", "mail"]);
  const telephone = pickCellValue(row, ["telephone", "phone", "tel"]);
  const roleNames = parseRoleNames(pickCellValue(row, ["roles", "role", "roleNames", "role_names"]));
  const promoId = parseOptionalPositiveInteger(pickCellValue(row, ["promoId", "promo_id"]));
  const specialiteId = parseOptionalPositiveInteger(pickCellValue(row, ["specialiteId", "specialite_id"]));
  const moduleIds = parseOptionalPositiveIntegerList(pickCellValue(row, ["moduleIds", "module_ids"]));
  const anneeUniversitaire = pickCellValue(row, ["anneeUniversitaire", "annee_universitaire"]);

  return {
    nom,
    prenom,
    email,
    telephone: telephone || undefined,
    roleNames,
    promoId,
    specialiteId,
    moduleIds: moduleIds.length > 0 ? moduleIds : undefined,
    anneeUniversitaire: anneeUniversitaire || undefined,
  };
};

const UPLOADS_DIRECTORY = path.join(process.cwd(), "uploads");
const IMAGE_MIME_TYPE_REGEX = /^image\/(jpeg|png|gif|webp|bmp|svg\+xml)$/i;
const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const resolveUploadAbsolutePath = (publicPath: string): string | null => {
  const normalizedPath = String(publicPath || "").replace(/\\/g, "/");

  if (!normalizedPath.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = normalizedPath.slice("/uploads/".length);
  if (!relativePath || relativePath.includes("..")) {
    return null;
  }

  return path.join(UPLOADS_DIRECTORY, relativePath);
};

const removeStoredPhotoFile = (publicPath: string | null | undefined): void => {
  if (!publicPath) {
    return;
  }

  const absolutePath = resolveUploadAbsolutePath(publicPath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return;
  }

  fs.unlinkSync(absolutePath);
};

export const register = async (req: Request, res: Response) => {
  try {
    const result = await registerUser(req.body);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, result.accessToken, accessTokenCookieOptions);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshTokenCookieOptions);

    return res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
      message: "Registration successful. Please check your email for verification.",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "REGISTRATION_FAILED",
        message: error.message,
      },
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, result.accessToken, accessTokenCookieOptions);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshTokenCookieOptions);

    return res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        requiresPasswordChange: result.requiresPasswordChange,
      },
      message: "Login successful",
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: error.message,
      },
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "REFRESH_TOKEN_MISSING",
          message: "No refresh token provided",
        },
      });
    }

    const { accessToken, refreshToken } = await refreshTokens(token);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, accessTokenCookieOptions);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions);

    return res.json({
      success: true,
      data: { accessToken },
      message: "Tokens refreshed successfully",
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: "REFRESH_FAILED",
        message: error.message,
      },
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (token) {
      await logoutUser(token);
    }

    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME);

    return res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LOGOUT_FAILED",
        message: error.message,
      },
    });
  }
};

export const verifyEmailHandler = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token);
    await verifyEmail(token);

    return res.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VERIFICATION_FAILED",
        message: error.message,
      },
    });
  }
};

export const resendVerificationHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_EMAIL",
          message: "Email is required",
        },
      });
    }
    await resendVerification(email);

    return res.json({
      success: true,
      message: "Verification email sent",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "RESEND_FAILED",
        message: error.message,
      },
    });
  }
};

export const getMeHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const user = await getUserById(req.user.id);

    return res.json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "GET_ME_FAILED",
        message: error.message,
      },
    });
  }
};

export const changePasswordHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Current password and new password are required",
        },
      });
    }

    await changePassword(req.user.id, currentPassword, newPassword);

    // Clear tokens so user must re-login with new password
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME);

    return res.json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PASSWORD_CHANGE_FAILED",
        message: error.message,
      },
    });
  }
};

export const uploadProfilePhotoHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FILE",
          message: "Profile photo is required",
        },
      });
    }

    if (!IMAGE_MIME_TYPE_REGEX.test(uploadedFile.mimetype || "")) {
      removeStoredPhotoFile(`/uploads/${uploadedFile.filename}`);

      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILE_TYPE",
          message: "Only image files are allowed",
        },
      });
    }

    if ((uploadedFile.size || 0) > PROFILE_PHOTO_MAX_BYTES) {
      removeStoredPhotoFile(`/uploads/${uploadedFile.filename}`);

      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "Profile photo cannot exceed 5 MB",
        },
      });
    }

    const nextPhotoPath = `/uploads/${uploadedFile.filename}`;

    try {
      const result = await updateCurrentUserPhoto(req.user.id, nextPhotoPath);

      if (result.previousPhoto && result.previousPhoto !== nextPhotoPath) {
        removeStoredPhotoFile(result.previousPhoto);
      }

      return res.json({
        success: true,
        data: {
          user: result.user,
        },
        message: "Profile photo updated successfully",
      });
    } catch (error: any) {
      removeStoredPhotoFile(nextPhotoPath);
      throw error;
    }
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PROFILE_PHOTO_UPDATE_FAILED",
        message: error.message,
      },
    });
  }
};

export const removeProfilePhotoHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const result = await updateCurrentUserPhoto(req.user.id, null);

    if (result.previousPhoto) {
      removeStoredPhotoFile(result.previousPhoto);
    }

    return res.json({
      success: true,
      data: {
        user: result.user,
      },
      message: "Profile photo removed successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PROFILE_PHOTO_REMOVE_FAILED",
        message: error.message,
      },
    });
  }
};

export const createUserByAdminHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const {
      email,
      nom,
      prenom,
      roleName,
      roleNames,
      sexe,
      telephone,
      promoId,
      specialiteId,
      moduleIds,
      anneeUniversitaire,
    } = req.body;

    const normalizedRoleNames = Array.isArray(roleNames)
      ? roleNames
      : (roleName ? [roleName] : []);

    if (!email || !nom || !prenom || normalizedRoleNames.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Email, nom, prenom, and at least one role are required",
        },
      });
    }

    const result = await createUserByAdmin({
      email,
      nom,
      prenom,
      roleNames: normalizedRoleNames,
      sexe,
      telephone,
      promoId,
      specialiteId,
      moduleIds,
      anneeUniversitaire,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: "User created successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CREATE_USER_FAILED",
        message: error.message,
      },
    });
  }
};

export const importUsersByAdminExcelHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const uploadedFile = req.file;
    if (!uploadedFile?.buffer) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FILE",
          message: "Excel file is required",
        },
      });
    }

    const workbook = XLSX.read(uploadedFile.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FILE",
          message: "Excel file does not contain any sheet",
        },
      });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
      raw: false,
    });

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: "EMPTY_FILE",
          message: "Excel file is empty",
        },
      });
    }

    const created: Array<{
      rowNumber: number;
      userId: number;
      nom: string;
      prenom: string;
      email: string;
      telephone: string;
      roleNames: string[];
      tempPassword: string;
      generatedAt: string;
    }> = [];
    const failures: Array<{ rowNumber: number; email: string; reason: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const parsedRow = parseExcelUserRow(rows[index]);

      if (!parsedRow.nom || !parsedRow.prenom || !parsedRow.email) {
        failures.push({
          rowNumber,
          email: parsedRow.email || "",
          reason: "nom, prenom, and email are required",
        });
        continue;
      }

      if (!parsedRow.roleNames.length) {
        failures.push({
          rowNumber,
          email: parsedRow.email,
          reason: "At least one role is required",
        });
        continue;
      }

      try {
        const result = await createUserByAdmin(parsedRow);
        created.push({
          rowNumber,
          userId: result.user.id,
          nom: result.user.nom,
          prenom: result.user.prenom,
          email: result.user.email,
          telephone: parsedRow.telephone || "",
          roleNames: result.user.roles,
          tempPassword: result.tempPassword,
          generatedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        failures.push({
          rowNumber,
          email: parsedRow.email,
          reason: error?.message || "Failed to create user",
        });
      }
    }

    return res.status(created.length > 0 ? 201 : 200).json({
      success: true,
      data: {
        totalRows: rows.length,
        createdCount: created.length,
        failedCount: failures.length,
        created,
        failures,
      },
      message:
        created.length > 0
          ? "Excel import completed"
          : "Excel import processed, but no accounts were created",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "IMPORT_USERS_FAILED",
        message: error.message,
      },
    });
  }
};

export const adminResetPasswordHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const targetUserId = Number(req.params.userId || req.body?.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Valid userId is required",
        },
      });
    }

    const tempPassword = await adminResetPassword(req.user.id, targetUserId);

    return res.json({
      success: true,
      data: {
        userId: targetUserId,
        tempPassword,
      },
      message: "Password reset successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PASSWORD_RESET_FAILED",
        message: error.message,
      },
    });
  }
};

export const listRolesForAdminHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const roles = await listRolesForAdmin();

    return res.json({
      success: true,
      data: roles,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LIST_ROLES_FAILED",
        message: error.message,
      },
    });
  }
};

export const listRolesHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const roles = await listRolesForAdmin();

    return res.json({
      success: true,
      data: roles,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LIST_ROLES_FAILED",
        message: error.message,
      },
    });
  }
};

export const getRbacCatalogHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const catalog = await getRbacCatalogForClient();

    return res.json({
      success: true,
      data: catalog,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "RBAC_CATALOG_FAILED",
        message: error.message,
      },
    });
  }
};

export const listAdminUsersHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const users = await listUsersForAdmin();

    return res.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LIST_USERS_FAILED",
        message: error.message,
      },
    });
  }
};

export const getAcademicManagementOptionsHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const data = await getAcademicManagementOptions();

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "ACADEMIC_OPTIONS_FAILED",
        message: error.message,
      },
    });
  }
};

export const createSpecialiteManagementHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    const created = await createSpecialiteForManagement({
      nom: req.body?.nom,
      niveau: req.body?.niveau,
      filiereId: req.body?.filiereId,
    });

    return res.status(201).json({
      success: true,
      data: created,
      message: "Specialite created successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CREATE_SPECIALITE_FAILED",
        message: error.message,
      },
    });
  }
};

export const createPromoManagementHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    const created = await createPromoForManagement({
      nom: req.body?.nom,
      section: req.body?.section,
      anneeUniversitaire: req.body?.anneeUniversitaire,
      specialiteId: req.body?.specialiteId,
    });

    return res.status(201).json({
      success: true,
      data: created,
      message: "Promo created successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CREATE_PROMO_FAILED",
        message: error.message,
      },
    });
  }
};

export const createModuleManagementHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    const created = await createModuleForManagement({
      nom: req.body?.nom,
      code: req.body?.code,
      specialiteId: req.body?.specialiteId,
      semestre: req.body?.semestre,
      credit: req.body?.credit,
      coef: req.body?.coef,
      volumeCours: req.body?.volumeCours,
      volumeTd: req.body?.volumeTd,
      volumeTp: req.body?.volumeTp,
    });

    return res.status(201).json({
      success: true,
      data: created,
      message: "Module created successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CREATE_MODULE_FAILED",
        message: error.message,
      },
    });
  }
};

export const getAcademicAssignmentsHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    const data = await getAcademicAssignmentsData();

    return res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: "ACADEMIC_ASSIGNMENTS_FAILED",
        message: error.message,
      },
    });
  }
};

export const assignStudentPromoHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    const userId = Number(req.params.userId);
    const promoId = Number(req.body?.promoId);

    const data = await assignStudentPromoByAdmin(req.user.id, userId, promoId);

    return res.json({
      success: true,
      data,
      message: "Student assignment updated successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "ASSIGN_STUDENT_PROMO_FAILED",
        message: error.message,
      },
    });
  }
};

export const assignTeacherModulesHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      });
    }

    const userId = Number(req.params.userId);
    const moduleIds = Array.isArray(req.body?.moduleIds) ? req.body.moduleIds : [];
    const promoId = req.body?.promoId;
    const anneeUniversitaire = req.body?.anneeUniversitaire;

    const data = await assignTeacherModulesByAdmin(req.user.id, userId, {
      moduleIds,
      promoId,
      anneeUniversitaire,
    });

    return res.json({
      success: true,
      data,
      message: "Teacher assignment updated successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "ASSIGN_TEACHER_MODULES_FAILED",
        message: error.message,
      },
    });
  }
};

export const updateUserRolesByAdminHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const routeUserId = Number(req.params.userId);
    const bodyUserId = Number(req.body?.userId);
    const userId = Number.isInteger(routeUserId) && routeUserId > 0
      ? routeUserId
      : (Number.isInteger(bodyUserId) && bodyUserId > 0 ? bodyUserId : null);
    const { roleNames } = req.body;

    if (!userId || !Array.isArray(roleNames)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Valid userId and roleNames are required",
        },
      });
    }

    const result = await updateUserRolesByAdmin(req.user.id, userId, roleNames);

    return res.json({
      success: true,
      data: result,
      message: "User roles updated successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "UPDATE_ROLES_FAILED",
        message: error.message,
      },
    });
  }
};

export const updateUserStatusByAdminHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        },
      });
    }

    const routeUserId = Number(req.params.userId);
    const bodyUserId = Number(req.body?.userId);
    const userId = Number.isInteger(routeUserId) && routeUserId > 0
      ? routeUserId
      : (Number.isInteger(bodyUserId) && bodyUserId > 0 ? bodyUserId : null);
    const { status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Valid userId and status are required",
        },
      });
    }

    const result = await updateUserStatusByAdmin(req.user.id, userId, status);

    return res.json({
      success: true,
      data: result,
      message: "User status updated successfully",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "UPDATE_STATUS_FAILED",
        message: error.message,
      },
    });
  }
};

export const forgotPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_EMAIL",
          message: "Email is required",
        },
      });
    }

    await requestPasswordReset(email);

    return res.json({
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PASSWORD_RESET_REQUEST_FAILED",
        message: error.message,
      },
    });
  }
};

export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Token and newPassword are required",
        },
      });
    }

    await resetPasswordWithToken(token, newPassword);

    return res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: "PASSWORD_RESET_WITH_TOKEN_FAILED",
        message: error.message,
      },
    });
  }
};
