"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeacherReportCardRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const teacherReportCardControllers_1 = require("../controllers/teacherReportCardControllers");
const useTeacherReportCardRoutes = (app) => {
    app.get("/api/teacher-report-cards/options", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isTeacher, teacherReportCardControllers_1.getTeacherReportCardOptions);
    app.get("/api/teacher-report-cards/preview", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isTeacher, teacherReportCardControllers_1.getTeacherReportCardPreview);
};
exports.useTeacherReportCardRoutes = useTeacherReportCardRoutes;
