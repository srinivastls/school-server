import { Express } from "express";

import { authJwt } from "../middlewares";
import * as teacherProfileControllers from "../controllers";

export const useTeacherProfileRoutes = (app: Express) => {

app.get(
  "/api/teacher/profile",
  authJwt.verifyToken,
    authJwt.isTeacher,
  teacherProfileControllers.getTeacherProfile
);

app.patch(
  "/api/teacher/profile",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherProfileControllers.updateTeacherProfile
);
}