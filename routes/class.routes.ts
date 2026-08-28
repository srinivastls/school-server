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
    [authJwt.verifyToken],
    classControllers.getAllClasses
  );

  app.post(
    "/api/class/delete",
    [authJwt.verifyToken, authJwt.isSuperAdmin],
    classControllers.deleteClass
  );

  app.get(
    "/api/class/get",
    [authJwt.verifyToken],
    classControllers.getClassDetails
  );

  app.post(
    "/api/class/edit",
    [
      authJwt.verifyToken,
      authJwt.isSuperAdmin,
      classMiddleWares.checkClassExists,
    ],
    classControllers.editClassDetails
  );

  app.post(
    "/api/class/markAsCompleted",
    [authJwt.verifyToken],
    classControllers.markClassAsCompleted
  );


  app.post(
  "/api/class/copy-to-academic-year",
  authJwt.verifyToken,
  authJwt.isPrincipal,
  classControllers.copyClassesToAcademicYear
);


app.post(

    "/api/section/copy",

    authJwt.verifyToken,

    authJwt.isPrincipal,

    sectionControllers
      .copySectionsToAcademicYear

  );

  app.post(
  "/api/section/create",
  authJwt.verifyToken,
  authJwt.isPrincipal,
  sectionControllers.createSection
);


  /* ==========================================================
     GET SECTIONS OF CLASS
  ========================================================== */

  app.get(

    "/api/section/class",

    authJwt.verifyToken,

    sectionControllers
      .getSectionsByClass

  );

  app.post(
    "/api/section/copy",
    authJwt.verifyToken,
    authJwt.isPrincipal,
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
    authJwt.isPrincipal,
    sectionControllers
      .getAvailableClassTeachers
  );


  /* ==========================================================
     ASSIGN CLASS TEACHER
  ========================================================== */

  app.put(
    "/api/section/class-teacher",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    sectionControllers
      .assignClassTeacher
  );


  /* ==========================================================
     REMOVE CLASS TEACHER
  ========================================================== */

  app.delete(
    "/api/section/class-teacher",
    authJwt.verifyToken,
    authJwt.isPrincipal,
    sectionControllers
      .removeClassTeacher
  );


};
