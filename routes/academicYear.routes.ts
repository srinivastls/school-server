import { Express } from "express";

import {
  academicYearControllers,
} from "../controllers";

import {
  authJwt,
} from "../middlewares";


export const useAcademicYearRoutes = (
  app: Express
) => {

  /* ==========================================================
     GET ALL
     
     GET /academic-year
  ========================================================== */

  app.get(
    "/api/academic-year",
    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
    academicYearControllers.getAcademicYears
  );


  /* ==========================================================
     GET CURRENT
     
     GET /academic-year/current
  ========================================================== */

  app.get(
    "/api/academic-year/current",
    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
    academicYearControllers.getCurrentAcademicYear
  );


  /* ==========================================================
     GET BY ID
     
     GET /academic-year/:academicYearId
  ========================================================== */

  app.get(
    "/academic-year/:academicYearId",
    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
    academicYearControllers.getAcademicYearById
  );


  /* ==========================================================
     CREATE
     
     POST /academic-year
  ========================================================== */

  app.post(
    "/api/academic-year",
    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
    academicYearControllers.createAcademicYear
  );


  /* ==========================================================
     SET CURRENT
     
     PATCH /academic-year/:academicYearId/current
  ========================================================== */

  app.patch(
    "/api/academic-year/:academicYearId/current",
    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
    academicYearControllers.setCurrentAcademicYear
  );

  app.post(
  "/api/academic-year/populate",
  authJwt.verifyToken,
  authJwt.isPrincipal || authJwt.isAdmin,
  academicYearControllers.populateAcademicYear
);

};