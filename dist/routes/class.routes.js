"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useClassRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const section_controller_1 = require("../controllers/section.controller");
const useClassRoutes = (app) => {
    app.post("/api/class/create", [middlewares_1.authJwt.verifyToken, middlewares_1.classMiddleWares.checkDuplicateClass], controllers_1.classControllers.createClass);
    app.get("/api/class/getAll", [middlewares_1.authJwt.verifyToken], controllers_1.classControllers.getAllClasses);
    app.post("/api/class/delete", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isSuperAdmin], controllers_1.classControllers.deleteClass);
    app.get("/api/class/get", [middlewares_1.authJwt.verifyToken], controllers_1.classControllers.getClassDetails);
    app.post("/api/class/edit", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isSuperAdmin,
        middlewares_1.classMiddleWares.checkClassExists,
    ], controllers_1.classControllers.editClassDetails);
    app.post("/api/class/markAsCompleted", [middlewares_1.authJwt.verifyToken], controllers_1.classControllers.markClassAsCompleted);
    app.post("/api/class/copy-to-academic-year", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.classControllers.copyClassesToAcademicYear);
    app.post("/api/section/copy", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, section_controller_1.sectionControllers
        .copySectionsToAcademicYear);
    app.post("/api/section/create", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, section_controller_1.sectionControllers.createSection);
    /* ==========================================================
       GET SECTIONS OF CLASS
    ========================================================== */
    app.get("/api/section/class", middlewares_1.authJwt.verifyToken, section_controller_1.sectionControllers
        .getSectionsByClass);
    app.post("/api/section/copy", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, section_controller_1.sectionControllers
        .copySectionsToAcademicYear);
    app.get("/api/section/students", middlewares_1.authJwt.verifyToken, section_controller_1.sectionControllers.getStudentsBySection);
    /* ==========================================================
       GET SECTIONS
    ========================================================== */
    /* ==========================================================
       GET AVAILABLE TEACHERS
    ========================================================== */
    app.get("/api/section/available-teachers", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, section_controller_1.sectionControllers
        .getAvailableClassTeachers);
    /* ==========================================================
       ASSIGN CLASS TEACHER
    ========================================================== */
    app.put("/api/section/class-teacher", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, section_controller_1.sectionControllers
        .assignClassTeacher);
    /* ==========================================================
       REMOVE CLASS TEACHER
    ========================================================== */
    app.delete("/api/section/class-teacher", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, section_controller_1.sectionControllers
        .removeClassTeacher);
};
exports.useClassRoutes = useClassRoutes;
