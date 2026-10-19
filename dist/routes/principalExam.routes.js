"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalExamRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { verifyToken, isPrincipal, isAdmin, isPrincipalOrAdmin, } = middlewares_1.authJwt;
const usePrincipalExamRoutes = (app) => {
    app.get("/api/principal-exams/options", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamControllers.getOptions);
    app.get("/api/principal-exams", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamControllers.getExams);
    app.post("/api/principal-exams", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamControllers.createExam);
    app.put("/api/principal-exams/:examId", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamControllers.updateExam);
    app.patch("/api/principal-exams/:examId/publish", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamControllers.setPublished);
    app.delete("/api/principal-exams/:examId", [verifyToken, isPrincipalOrAdmin], controllers_1.principalExamControllers.deleteExam);
};
exports.usePrincipalExamRoutes = usePrincipalExamRoutes;
