"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalReportCardAnalyticsRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const principalReportCardAnalyticsControllers_1 = require("../controllers/principalReportCardAnalyticsControllers");
const usePrincipalReportCardAnalyticsRoutes = (app) => {
    app.get("/api/principal-report-card-analytics/options", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipalOrAdmin, principalReportCardAnalyticsControllers_1.getReportCardAnalyticsOptions);
    app.get("/api/principal-report-card-analytics", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipalOrAdmin, principalReportCardAnalyticsControllers_1.getReportCardAnalytics);
};
exports.usePrincipalReportCardAnalyticsRoutes = usePrincipalReportCardAnalyticsRoutes;
