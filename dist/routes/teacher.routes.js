"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeacherRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
/* ============================================================
   TEACHER ROUTES
============================================================ */
const useTeacherRoutes = (app) => {
    /* ==========================================================
       GET MY CLASSES
       
       GET /teacher/my-classes
       
       Optional:
       GET /teacher/my-classes?academicYearId=...
    ========================================================== */
    app.get("/teacher/my-classes", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isTeacher, controllers_1.teacherControllers.getMyClasses);
};
exports.useTeacherRoutes = useTeacherRoutes;
