import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { getReportCardOptions, getReportCardPreview, publishReportCards } from "../controllers/principalReportCardControllers";


export const usePrincipalReportCardRoutes = (app: Express) => {
  app.get("/api/principal-report-cards/options", authJwt.verifyToken, authJwt.isPrincipalOrAdmin, getReportCardOptions);
  app.get("/api/principal-report-cards/preview", authJwt.verifyToken, authJwt.isPrincipal, getReportCardPreview);
  app.patch("/api/principal-report-cards/:examId/publish", authJwt.verifyToken, authJwt.isPrincipal, publishReportCards);
  
};

