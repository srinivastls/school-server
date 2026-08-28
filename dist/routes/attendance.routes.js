"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAttendanceRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useAttendanceRoutes = (app) => {
    /* ============================================================
       STUDENT ATTENDANCE
    ============================================================ */
    app.get("/api/attendance/student/list", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher || middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.attendanceControllers
        .getStudentsForAttendance);
    app.post("/api/attendance/student/mark", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher || middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.attendanceControllers
        .markStudentAttendance);
    app.get("/student/my-sections", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherAttendanceControllers
        .getTeacherAssignedSections);
    /* ============================================================
       STUDENT ATTENDANCE REPORTS
    ============================================================ */
    app.get("/api/attendance/report/student/daily", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.attendanceReportControllers
        .getDailyStudentAttendance);
    app.get("/api/attendance/report/student", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.attendanceReportControllers
        .getStudentAttendanceReport);
    app.get("/api/attendance/student/attendance", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.attendanceControllers
        .getStudentsForAttendance);
    app.get("/api/attendance/report/student/detail", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.attendanceReportControllers
        .getStudentAttendance);
    /* ============================================================
       TEACHER ATTENDANCE
    ============================================================ */
    app.get("/api/attendance/teacher/list", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .getTeachersForAttendance);
    app.post("/api/attendance/teacher/mark", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .markTeacherAttendance);
    app.get("/api/attendance/dashboard", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.attendanceDashboardControllers
        .getAttendanceDashboard);
    /* ==========================================================
         STUDENT ATTENDANCE HISTORY
      ========================================================== */
    app.get("/api/attendance/student/history", middlewares_1.authJwt.verifyToken, controllers_1.attendanceReportControllers
        .getStudentAttendanceHistory);
    /* ==========================================================
       CLASS ATTENDANCE REPORT
    ========================================================== */
    app.get("/api/attendance/report/class", middlewares_1.authJwt.verifyToken, controllers_1.attendanceReportControllers
        .getClassAttendanceReport);
    app.get("/api/attendance/teacher/daily", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .getDailyTeacherAttendance);
    /* ============================================================
       TEACHER ATTENDANCE REPORT
    ============================================================ */
    app.get("/api/attendance/report/teacher", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.attendanceReportControllers
        .getTeacherAttendanceReport);
};
exports.useAttendanceRoutes = useAttendanceRoutes;
