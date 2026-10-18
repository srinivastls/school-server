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
    authJwt.isPrincipalOrAdmin,
    teacherSubjectMappingControllers
      .getTeachersForMapping
  );


  /* ==========================================================
     GET CLASSES / SUBJECTS / SECTIONS
  ========================================================== */

  app.get(
    "/api/teacher-subject/options",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    teacherSubjectMappingControllers
      .getSubjectsForMapping
  );


  /* ==========================================================
     GET MAPPINGS
  ========================================================== */

  app.get(
    "/api/teacher-subject",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    teacherSubjectMappingControllers
      .getTeacherSubjectMappings
  );


  /* ==========================================================
     ASSIGN
  ========================================================== */

  app.post(
    "/api/teacher-subject",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    teacherSubjectMappingControllers
      .assignTeacherSubject
  );


  /* ==========================================================
     DELETE
  ========================================================== */

  app.delete(
    "/api/teacher-subject/:mappingId",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    teacherSubjectMappingControllers
      .deleteTeacherSubjectMapping
  );

};