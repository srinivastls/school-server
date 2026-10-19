import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { getParentResultChildren, getParentStudentResults } from "../controllers/parentResults.controller";


export const useParentResultsRoutes = (app: Express) => {

  app.get("/api/parent/results/children",authJwt.verifyToken, authJwt.isParent, getParentResultChildren);
  app.get("/api/parent/results", authJwt.verifyToken, authJwt.isParent, getParentStudentResults);
};


