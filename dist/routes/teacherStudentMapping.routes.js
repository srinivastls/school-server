"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTeacherSubjectMappingRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useTeacherSubjectMappingRoutes = (app) => {
    /* ==========================================================
       GET TEACHERS
    ========================================================== */
    app.get("/teacher-subject/teachers", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.teacherSubjectMappingControllers
        .getTeachersForMapping);
    /* ==========================================================
       GET CLASSES / SUBJECTS / SECTIONS
    ========================================================== */
    app.get("/teacher-subject/options", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.teacherSubjectMappingControllers
        .getSubjectsForMapping);
    /* ==========================================================
       GET MAPPINGS
    ========================================================== */
    app.get("/teacher-subject", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.teacherSubjectMappingControllers
        .getTeacherSubjectMappings);
    /* ==========================================================
       ASSIGN
    ========================================================== */
    app.post("/teacher-subject", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.teacherSubjectMappingControllers
        .assignTeacherSubject);
    /* ==========================================================
       DELETE
    ========================================================== */
    app.delete("/teacher-subject/:mappingId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.teacherSubjectMappingControllers
        .deleteTeacherSubjectMapping);
};
exports.useTeacherSubjectMappingRoutes = useTeacherSubjectMappingRoutes;
