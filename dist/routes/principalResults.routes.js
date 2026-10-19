"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalResultsRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const principalResults_controller_1 = require("../controllers/principalResults.controller");
const usePrincipalResultsRoutes = (app) => {
    app.get("/api/principal-results", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalResults_controller_1.getPrincipalResultsOptions);
    app.get("/api/principal-results/:examId", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalResults_controller_1.getPrincipalExamResults);
    app.patch("/api/principal-results/:examId/publish", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalResults_controller_1.setPrincipalExamResultsPublished);
};
exports.usePrincipalResultsRoutes = usePrincipalResultsRoutes;
