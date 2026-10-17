import { Express } from "express";
import { subjectControllers } from "../controllers/subject.controller";
import { authJwt } from "../middlewares";

export const useSubjectRoutes = (app: Express) => {
  app.get(
    "/api/subjects/classes",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    subjectControllers.getSubjectClasses,
  );

  app.get(
    "/api/subjects",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    subjectControllers.getSubjects,
  );

  app.post(
    "/api/subjects",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    subjectControllers.createSubject,
  );

  app.put(
    "/api/subjects/:subjectId",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    subjectControllers.updateSubject,
  );

  app.delete(
    "/api/subjects/:subjectId",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    subjectControllers.deleteSubject,
  );
};
