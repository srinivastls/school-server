import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { getStudentPerformanceTrendOptions, getStudentPerformanceTrends } from "../controllers/principalStudentPerformanceTrendControllers";

export const usePrincipalStudentPerformanceTrendRoutes = (app: Express) => {
  app.get("/api/principal-student-performance-trends/options", authJwt.verifyToken, authJwt.isPrincipal, getStudentPerformanceTrendOptions);
  app.get("/api/principal-student-performance-trends", authJwt.verifyToken, authJwt.isPrincipal, getStudentPerformanceTrends);
};

