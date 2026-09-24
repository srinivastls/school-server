import { Express } from "express";
import { classTeacherControllers } from "../controllers";
import { authJwt } from "../middlewares";

export const useClassTeacherRoutes = (
  app: Express
) => {
  app.get(
    "/api/class-teacher",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    classTeacherControllers.getClassTeacherAssignments
  );

  app.get(
    "/api/class-teacher/available",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    classTeacherControllers.getAvailableClassTeachers
  );
  app.get(
    "/api/class-teacher/class/:classId",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    classTeacherControllers.getClassTeacherAssignments
  );

  app.post(
    "/api/class-teacher/assign",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    classTeacherControllers.assignClassTeacher
  );
};