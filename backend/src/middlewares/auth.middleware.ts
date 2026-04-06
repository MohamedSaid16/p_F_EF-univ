import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET, ACCESS_TOKEN_COOKIE_NAME } from "../config/auth";
import prisma from "../config/database";
import {
  CoreRoleName,
  getUserAuthorizations,
  hasAnyRole,
  hasAnyPermission,
  hasPermission,
} from "../services/common/rbac.service";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    nom: string;
    prenom: string;
    roles: string[];
    permissions: string[];
    coreRole: CoreRoleName | null;
    extensions: string[];
    firstUse: boolean;
  };
}

type UserRoleRecord = {
  role?: {
    nom: string | null;
  } | null;
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token =
      req.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as unknown as {
      sub: number;
      email: string;
      roles: string[];
    };

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        status: true,
        emailVerified: true,
        firstUse: true,
        userRoles: {
          select: {
            role: {
              select: {
                nom: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== "active") {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "User not found or inactive" },
      });
      return;
    }

    const currentRoles = user.userRoles
      .map((userRole: UserRoleRecord) => userRole.role?.nom)
      .filter((roleName): roleName is string => Boolean(roleName));

    const authorization = await getUserAuthorizations(user.id);

    req.user = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      roles: authorization.roles.length > 0 ? authorization.roles : currentRoles,
      permissions: authorization.permissions,
      coreRole: authorization.coreRole,
      extensions: authorization.extensions,
      firstUse: user.firstUse,
    };

    // Force password change on first use (like friend's mustChangePassword)
    if (user.firstUse) {
      const isChangingPassword =
        req.method === "POST" && req.originalUrl.includes("/change-password");
      const isLoggingOut = req.originalUrl.includes("/logout");
      const isGettingMe = req.method === "GET" && req.originalUrl.includes("/me");
      if (!isChangingPassword && !isLoggingOut && !isGettingMe) {
        res.status(403).json({
          success: false,
          error: {
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "You must change your password before accessing this resource.",
            requiresPasswordChange: true,
          },
        });
        return;
      }
    }

    next();
    return;
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
    return;
  }
};

export const requireEmailVerified = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { emailVerified: true },
    });

    if (!user?.emailVerified) {
      res.status(403).json({
        success: false,
        error: { code: "EMAIL_NOT_VERIFIED", message: "Please verify your email first" },
      });
      return;
    }

    next();
    return;
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "An error occurred while checking email verification" },
    });
    return;
  }
};

/**
 * Check that the authenticated user has at least one of the allowed roles.
 * Usage: requireRole(["admin", "enseignant"])
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      const hasRole = hasAnyRole(req.user.roles || [], allowedRoles);
      if (!hasRole) {
        res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Insufficient permissions" },
        });
        return;
      }

      next();
      return;
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An error occurred while checking permissions" },
      });
      return;
    }
  };
};

/**
 * Alias helper to keep route intent explicit when at least one role is enough.
 */
export const requireAnyRole = (allowedRoles: string[]) => requireRole(allowedRoles);

/**
 * Require a single permission code.
 */
export const requirePermission = (permissionCode: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      if (!hasPermission(req.user.permissions || [], permissionCode)) {
        res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Permission denied" },
        });
        return;
      }

      next();
      return;
    } catch (_error) {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An error occurred while checking permissions" },
      });
      return;
    }
  };
};

/**
 * Require at least one permission from the provided set.
 */
export const requireAnyPermission = (permissionCodes: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        });
        return;
      }

      if (!hasAnyPermission(req.user.permissions || [], permissionCodes)) {
        res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Permission denied" },
        });
        return;
      }

      next();
      return;
    } catch (_error) {
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An error occurred while checking permissions" },
      });
      return;
    }
  };
};
