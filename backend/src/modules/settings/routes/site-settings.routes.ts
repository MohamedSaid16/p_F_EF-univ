import { Router } from "express";
import {
  getPublicSiteSettingsHandler,
  uploadSiteSettingsMediaHandler,
  updateSiteSettingsHandler,
} from "../../../controllers/settings/site-settings.controller";
import { requireAnyPermission, requireAuth, requireRole } from "../../../middlewares/auth.middleware";
import siteSettingsUpload from "../../../middlewares/site-settings-upload.middleware";

const router = Router();

router.get("/", getPublicSiteSettingsHandler);

router.patch(
  "/",
  requireAuth,
  requireRole(["admin", "vice_doyen", "admin_faculte"]),
  requireAnyPermission(["users:manage"]),
  updateSiteSettingsHandler
);

router.post(
  "/media/:kind",
  requireAuth,
  requireRole(["admin", "vice_doyen", "admin_faculte"]),
  requireAnyPermission(["users:manage"]),
  siteSettingsUpload.single("file"),
  uploadSiteSettingsMediaHandler
);

export default router;
