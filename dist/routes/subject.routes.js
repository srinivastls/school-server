"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSubjectRoutes = void 0;
const subject_controller_1 = require("../controllers/subject.controller");
const middlewares_1 = require("../middlewares");
const useSubjectRoutes = (app) => {
    app.get("/api/subjects/classes", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, subject_controller_1.subjectControllers.getSubjectClasses);
    app.get("/api/subjects", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, subject_controller_1.subjectControllers.getSubjects);
    app.post("/api/subjects", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, subject_controller_1.subjectControllers.createSubject);
    app.put("/api/subjects/:subjectId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, subject_controller_1.subjectControllers.updateSubject);
    app.delete("/api/subjects/:subjectId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, subject_controller_1.subjectControllers.deleteSubject);
};
exports.useSubjectRoutes = useSubjectRoutes;
