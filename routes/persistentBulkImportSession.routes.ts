
import { Express } from "express";
import { authJwt } from "../middlewares";
import {
  getBulkImportSessionStatus,
} from "../controllers/persistentBulkImportSession.controller";

export const usePersistentBulkImportSessionRoutes = (app: Express) => {
  app.get(
    "/api/admin/bulk/sessions/:sessionId",
    authJwt.verifyToken,
    authJwt.isAdmin,
    getBulkImportSessionStatus
  );
};
