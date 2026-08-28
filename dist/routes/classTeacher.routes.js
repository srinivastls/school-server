"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useClassTeacherRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useClassTeacherRoutes = (app) => {
    app.get("/api/class-teacher", middlewares_1.authJwt.verifyToken, controllers_1.classTeacherControllers.getClassTeacherAssignments);
    app.get("/api/class-teacher/available", middlewares_1.authJwt.verifyToken, controllers_1.classTeacherControllers.getAvailableClassTeachers);
    app.get("/api/class-teacher/class/:classId", middlewares_1.authJwt.verifyToken, controllers_1.classTeacherControllers.getClassTeacherAssignments);
    app.post("/api/class-teacher/assign", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.classTeacherControllers.assignClassTeacher);
};
exports.useClassTeacherRoutes = useClassTeacherRoutes;
