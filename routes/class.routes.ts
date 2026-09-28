import { Express } from "express";
import { classControllers } from "../controllers";
import { authJwt, classMiddleWares } from "../middlewares";
import { sectionControllers } from "../controllers/section.controller";

export const useClassRoutes = (app: Express) => {
  app.post(
    "/api/class/create",
    [authJwt.verifyToken, classMiddleWares.checkDuplicateClass],
    classControllers.createClass
  );

  app.get(
    "/api/class/getAll",
    [authJwt.verifyToken, authJwt.isPrincipalOrAdmin],
    classControllers.getAllClasses
  );

  app.post(
    "/api/class/delete",
    [authJwt.verifyToken, authJwt.isSuperAdmin || authJwt.isPrincipalOrAdmin],
    classControllers.deleteClass
  );

  app.get(
    "/api/class/get",
    [authJwt.verifyToken, authJwt.isPrincipalOrAdmin],
    classControllers.getClassDetails
  );

  app.post(
    "/api/class/edit",
    [
      authJwt.verifyToken,
      authJwt.isSuperAdmin || authJwt.isPrincipalOrAdmin,
      classMiddleWares.checkClassExists,
    ],
    classControllers.editClassDetails
  );

  app.post(
    "/api/class/markAsCompleted",
    [authJwt.verifyToken, authJwt.isPrincipalOrAdmin],
    classControllers.markClassAsCompleted
  );


  app.post(
  "/api/class/copy-to-academic-year",
  authJwt.verifyToken,
  authJwt.isPrincipalOrAdmin,
  classControllers.copyClassesToAcademicYear
);


app.post(

    "/api/section/copy",

    authJwt.verifyToken,

    authJwt.isPrincipalOrAdmin,

    sectionControllers
      .copySectionsToAcademicYear

  );

  app.post(
  "/api/section/create",
  authJwt.verifyToken,
  authJwt.isPrincipalOrAdmin,
  sectionControllers.createSection
);


  /* ==========================================================
     GET SECTIONS OF CLASS
  ========================================================== */

  app.get(

    "/api/section/class",

    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,

    sectionControllers
      .getSectionsByClass

  );

  app.post(
    "/api/section/copy",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    sectionControllers
      .copySectionsToAcademicYear
  );


  app.get(
    "/api/section/students",
    authJwt.verifyToken,
    sectionControllers.getStudentsBySection
  );

  /* ==========================================================
     GET SECTIONS
  ========================================================== */

  


  /* ==========================================================
     GET AVAILABLE TEACHERS
  ========================================================== */

  app.get(
    "/api/section/available-teachers",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    sectionControllers
      .getAvailableClassTeachers
  );


  /* ==========================================================
     ASSIGN CLASS TEACHER
  ========================================================== */

  app.put(
    "/api/section/class-teacher",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    sectionControllers
      .assignClassTeacher
  );


  app.delete(
    "/api/section/delete",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    sectionControllers
      .deleteSection
  );


  /* ==========================================================
     REMOVE CLASS TEACHER
  ========================================================== */

  app.delete(
    "/api/section/remove-class-teacher",
    authJwt.verifyToken,
    authJwt.isPrincipalOrAdmin,
    sectionControllers
      .removeClassTeacher
  );


};
