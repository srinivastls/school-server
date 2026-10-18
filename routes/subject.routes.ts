import { Express } from "express";
import { subjectControllers } from "../controllers/subject.controller";
import { authJwt } from "../middlewares";

export const useSubjectRoutes = (app: Express) => {
  app.get(
    "/api/subjects/classes",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    subjectControllers.getSubjectClasses,
  );

  app.get(
    "/api/subjects",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin  ,
    subjectControllers.getSubjects,
  );

  app.post(
    "/api/subjects",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    subjectControllers.createSubject,
  );

  app.put(
    "/api/subjects/:subjectId",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    subjectControllers.updateSubject,
  );

  app.delete(
    "/api/subjects/:subjectId",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    subjectControllers.deleteSubject,
  );
};
