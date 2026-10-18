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
  
    app.get("/api/principal-exams/options",[verifyToken, isPrincipal] , principalExamControllers.getOptions);
    app.get("/api/principal-exams",[verifyToken, isPrincipal] , principalExamControllers.getExams);
    app.post("/api/principal-exams", [verifyToken, isPrincipal], principalExamControllers.createExam);
    app.put("/api/principal-exams/:examId", [verifyToken, isPrincipal], principalExamControllers.updateExam);
    app.patch("/api/principal-exams/:examId/publish", [verifyToken, isPrincipal], principalExamControllers.setPublished);
    app.delete("/api/principal-exams/:examId", [verifyToken, isPrincipal], principalExamControllers.deleteExam);
};
