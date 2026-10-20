import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import {
  getPrincipalExamResults,
  getPrincipalResultsOptions,
  setPrincipalExamResultsPublished,
} from "../controllers/principalResults.controller";

export const usePrincipalResultsRoutes = (app: Express) => {

  app.get("/api/principal-results", authJwt.verifyToken, authJwt.isPrincipal, getPrincipalResultsOptions);
  app.get("/api/principal-results/:examId", authJwt.verifyToken, authJwt.isPrincipal, getPrincipalExamResults);
  app.patch("/api/principal-results/:examId/publish", authJwt.verifyToken, authJwt.isPrincipal, setPrincipalExamResultsPublished);
  
};
