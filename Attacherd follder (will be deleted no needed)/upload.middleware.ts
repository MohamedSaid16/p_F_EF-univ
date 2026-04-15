import fs from "fs";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";

const uploadPath = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// FIX 1 — Types de fichiers autorisés uniquement (PDF et DOCX)
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },
  // FIX 2 — Nom de fichier lisible, sécurisé et unique
  filename: (_req, file, cb) => {
    const safeName = file.originalname
      .replace(/\.[^/.]+$/, "")            // retirer l'extension
      .replace(/[^a-zA-Z0-9\-_]/g, "_")   // caractères spéciaux → underscore
      .substring(0, 60);                   // limiter la longueur
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${safeName}${ext}`;
    cb(null, uniqueName);
  },
});

// FIX 1 — Rejette tout fichier hors PDF/DOC/DOCX
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Type de fichier non autorisé. Seuls PDF et DOCX sont acceptés."));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter,
});

export default upload;
