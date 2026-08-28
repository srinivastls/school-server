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
    /* ============================================================
       MARK / UPDATE TEACHER ATTENDANCE
    ============================================================ */
    /*
     * POST
     * /attendance/teacher/mark
     */
    app.post("/mark", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin || middlewares_1.authJwt.isPrincipal, controllers_1.teacherAttendanceControllers
        .markTeacherAttendance);
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
