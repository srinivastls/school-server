import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { getReportCardAnalytics, getReportCardAnalyticsOptions } from "../controllers/principalReportCardAnalyticsControllers";

export const usePrincipalReportCardAnalyticsRoutes = (app: Express) => {
  app.get("/api/principal-report-card-analytics/options", authJwt.verifyToken, authJwt.isPrincipalOrAdmin, getReportCardAnalyticsOptions);
  app.get("/api/principal-report-card-analytics", authJwt.verifyToken, authJwt.isPrincipalOrAdmin, getReportCardAnalytics);
};
