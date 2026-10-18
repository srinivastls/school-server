import { Router,Express } from "express";
import { principalExamControllers } from "../controllers";

import { authJwt } from "../middlewares";

const {
  verifyToken,
  isPrincipal,
  isAdmin,
  isPrincipalOrAdmin,
} = authJwt;

export const usePrincipalExamRoutes = (app: Express) => {
  
    app.get("/api/principal-exams/options",[verifyToken, isPrincipalOrAdmin] , principalExamControllers.getOptions);
    app.get("/api/principal-exams",[verifyToken, isPrincipalOrAdmin] , principalExamControllers.getExams);
    app.post("/api/principal-exams", [verifyToken, isPrincipalOrAdmin], principalExamControllers.createExam);
    app.put("/api/principal-exams/:examId", [verifyToken, isPrincipalOrAdmin], principalExamControllers.updateExam);
    app.patch("/api/principal-exams/:examId/publish", [verifyToken, isPrincipalOrAdmin], principalExamControllers.setPublished);
    app.delete("/api/principal-exams/:examId", [verifyToken, isPrincipalOrAdmin], principalExamControllers.deleteExam);
};
