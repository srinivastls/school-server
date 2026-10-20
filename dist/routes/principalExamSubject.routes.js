"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalExamSubjectRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const controllers_1 = require("../controllers");
const { verifyToken, isPrincipal, isAdmin, isPrincipalOrAdmin, } = authJwt_1.authJwt;
const usePrincipalExamSubjectRoutes = (app) => {
    app.get("/api/principal-exam-subjects/options", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamSubjectControllers.getOptions);
    app.get("/api/principal-exam-subjects", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamSubjectControllers.getAll);
    app.post("/api/principal-exam-subjects", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamSubjectControllers.create);
    app.put("/api/principal-exam-subjects/:examSubjectId", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamSubjectControllers.update);
    app.delete("/api/principal-exam-subjects/:examSubjectId", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamSubjectControllers.delete);
};
exports.usePrincipalExamSubjectRoutes = usePrincipalExamSubjectRoutes;
