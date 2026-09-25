import { Express, NextFunction, Request, Response } from "express";
import multer from "multer";
import { authJwt } from "../middlewares";
import { bulkImportController } from "../controllers/bulkImport.controller";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

export const useBulkImportRoutes = (app: Express) => {
  app.post(
  "/api/admin/bulk/:module/preview",
  [
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    upload.single("file"),
  ],
  (req: Request, res: Response, next: NextFunction) => {
    console.log("=== BULK UPLOAD DEBUG ===");
    console.log("Module:", req.params.module);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("File:", req.file
      ? {
          fieldname: req.file.fieldname,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          bufferLength: req.file.buffer?.length,
        }
      : undefined
    );

    next();
  },
  bulkImportController.preview
);
  app.post("/api/admin/bulk/:module/commit", [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], bulkImportController.commit);
};
