"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeacherAttendanceRoutes = void 0;
const controllers_1 = require("../controllers/");
const middlewares_1 = require("../middlewares");
/* ============================================================
   GET TEACHERS + EXISTING ATTENDANCE
============================================================ */
/*
 * GET
 * /attendance/teacher/list?date=27/08/2026
 */
const useTeacherAttendanceRoutes = (app) => {
    app.get("/list", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .getTeachersForAttendance);
    app.get("/api/attendance/student/my-sections", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getTeacherAssignedSections);
    app.get("/api/teacher-attendance/my-sections", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getTeacherAssignedSections);
    /* ============================================================
       MARK / UPDATE TEACHER ATTENDANCE
    ============================================================ */
    /*
     * POST
     * /attendance/teacher/mark
     */
    app.post("/mark", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .markTeacherAttendance);
    app.get("/api/attendance/student/my-section-students", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers
        .getTeacherSectionStudents);
    app.get("/api/attendance/student/my-section-attendance", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getTeacherSectionAttendance);
    app.post("/api/attendance/student/my-section-attendance", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.saveTeacherSectionAttendance);
    app.get("/api/attendance/student/my-student-attendance-history", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getTeacherStudentAttendanceHistory);
    app.get("/api/attendance/student/my-students", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getTeacherMyStudents);
    app.get("/api/teacher-attendance/my-attendance", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getMyTeacherAttendance);
    app.get("/api/teacher-attendance/my-attendance/today", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers.getMyTeacherAttendanceToday);
    /* ============================================================
       DAILY REPORT
    ============================================================ */
    /*
     * GET
     * /attendance/teacher/daily?date=27/08/2026
     */
    app.get("/daily", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .getDailyTeacherAttendance);
};
exports.useTeacherAttendanceRoutes = useTeacherAttendanceRoutes;
