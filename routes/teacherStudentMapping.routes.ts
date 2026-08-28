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
    "/teacher-subject/teachers",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .getTeachersForMapping
  );


  /* ==========================================================
     GET CLASSES / SUBJECTS / SECTIONS
  ========================================================== */

  app.get(
    "/teacher-subject/options",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .getSubjectsForMapping
  );


  /* ==========================================================
     GET MAPPINGS
  ========================================================== */

  app.get(
    "/teacher-subject",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .getTeacherSubjectMappings
  );


  /* ==========================================================
     ASSIGN
  ========================================================== */

  app.post(
    "/teacher-subject",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .assignTeacherSubject
  );


  /* ==========================================================
     DELETE
  ========================================================== */

  app.delete(
    "/teacher-subject/:mappingId",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    teacherSubjectMappingControllers
      .deleteTeacherSubjectMapping
  );

};