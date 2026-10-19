"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalReportCardRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const principalReportCardControllers_1 = require("../controllers/principalReportCardControllers");
const usePrincipalReportCardRoutes = (app) => {
    app.get("/api/principal-report-cards/options", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipalOrAdmin, principalReportCardControllers_1.getReportCardOptions);
    app.get("/api/principal-report-cards/preview", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalReportCardControllers_1.getReportCardPreview);
    app.patch("/api/principal-report-cards/:examId/publish", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalReportCardControllers_1.publishReportCards);
};
exports.usePrincipalReportCardRoutes = usePrincipalReportCardRoutes;
