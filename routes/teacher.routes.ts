import { Express } from "express";

import {
  teacherControllers,
} from "../controllers";

import {
  authJwt,
} from "../middlewares";

/* ============================================================
   TEACHER ROUTES
============================================================ */

export const useTeacherRoutes = (
  app: Express
) => {

  /* ==========================================================
     GET MY CLASSES
     
     GET /teacher/my-classes
     
     Optional:
     GET /teacher/my-classes?academicYearId=...
  ========================================================== */

  app.get(
    "/teacher/my-classes",

    authJwt.verifyToken,

    authJwt.isTeacher,

    teacherControllers.getMyClasses
  );
};