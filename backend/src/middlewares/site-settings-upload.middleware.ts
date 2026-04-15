import fs from "fs";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";

const uploadPath = path.join(process.cwd(), "uploads", "site-settings");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const ALLOWED_MIME_TYPES: Record<string, true> = {
  "image/png": true,
  "image/jpeg": true,
  "image/webp": true,
  "image/gif": true,
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9\-_]/g, "_")
      .substring(0, 60);
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${safeName}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
    return;
  }

  cb(new Error("Invalid file type. Only PNG/JPG/WEBP/GIF are allowed."));
};

const siteSettingsUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter,
});

export default siteSettingsUpload;
