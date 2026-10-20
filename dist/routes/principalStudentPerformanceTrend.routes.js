"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalStudentPerformanceTrendRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const principalStudentPerformanceTrendControllers_1 = require("../controllers/principalStudentPerformanceTrendControllers");
const usePrincipalStudentPerformanceTrendRoutes = (app) => {
    app.get("/api/principal-student-performance-trends/options", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalStudentPerformanceTrendControllers_1.getStudentPerformanceTrendOptions);
    app.get("/api/principal-student-performance-trends", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal, principalStudentPerformanceTrendControllers_1.getStudentPerformanceTrends);
};
exports.usePrincipalStudentPerformanceTrendRoutes = usePrincipalStudentPerformanceTrendRoutes;
