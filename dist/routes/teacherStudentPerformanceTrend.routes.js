"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeacherStudentPerformanceTrendRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const teacherStudentPerformanceTrendControllers_1 = require("../controllers/teacherStudentPerformanceTrendControllers");
const useTeacherStudentPerformanceTrendRoutes = (app) => {
    app.get("/api/teacher-student-performance-trends/options", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isTeacher, teacherStudentPerformanceTrendControllers_1.getTeacherPerformanceTrendOptions);
    app.get("/api/teacher-student-performance-trends", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isTeacher, teacherStudentPerformanceTrendControllers_1.getTeacherPerformanceTrends);
};
exports.useTeacherStudentPerformanceTrendRoutes = useTeacherStudentPerformanceTrendRoutes;
