import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { getTeacherReportCardOptions, getTeacherReportCardPreview } from "../controllers/teacherReportCardControllers";

export const useTeacherReportCardRoutes = (app: Express) => {
  app.get("/api/teacher-report-cards/options", authJwt.verifyToken, authJwt.isTeacher, getTeacherReportCardOptions);
  app.get("/api/teacher-report-cards/preview", authJwt.verifyToken, authJwt.isTeacher, getTeacherReportCardPreview);
};

