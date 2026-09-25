import { Express } from "express";
import { getBulkImportSession } from "../controllers/bulkImportSession.controller";
import { authJwt } from "../middlewares";

export const useBulkImportSessionRoutes = (app: Express) => {
  app.get(
    "/api/admin/bulk/sessions/:sessionId",
    authJwt.verifyToken,
    authJwt.isAdmin,
    getBulkImportSession
  );
};
