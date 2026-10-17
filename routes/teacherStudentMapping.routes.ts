import { Express } from "express";

import {
  teacherSubjectMappingControllers,
} from "../controllers";

import {
  authJwt,
} from "../middlewares";


export const useTeacherSubjectMappingRoutes = (
  app: Express
) => {

  /* ==========================================================
     GET TEACHERS
  ========================================================== */

  app.get(
    "/api/teacher-subject/teachers",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .getTeachersForMapping
  );


  /* ==========================================================
     GET CLASSES / SUBJECTS / SECTIONS
  ========================================================== */

  app.get(
    "/api/teacher-subject/options",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .getSubjectsForMapping
  );


  /* ==========================================================
     GET MAPPINGS
  ========================================================== */

  app.get(
    "/api/teacher-subject",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .getTeacherSubjectMappings
  );


  /* ==========================================================
     ASSIGN
  ========================================================== */

  app.post(
    "/api/teacher-subject",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .assignTeacherSubject
  );


  /* ==========================================================
     DELETE
  ========================================================== */

  app.delete(
    "/api/teacher-subject/:mappingId",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .deleteTeacherSubjectMapping
  );

};