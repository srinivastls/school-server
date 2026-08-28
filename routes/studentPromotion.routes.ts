import { Express } from "express";

import {
  studentPromotionControllers,
} from "../controllers";

import {
  authJwt,
} from "../middlewares";


/* ============================================================
   STUDENT PROMOTION ROUTES
============================================================ */

export const useStudentPromotionRoutes = (
  app: Express
) => {

  /* ----------------------------------------------------------
     GET STUDENTS FOR PROMOTION
  ---------------------------------------------------------- */

  app.get(
    "/academic-year/promotion/students",

    authJwt.verifyToken,

    authJwt.isPrincipal,

    studentPromotionControllers
      .getPromotionStudents
  );

  app.post(
  "/academic-year/promotion/student",
  authJwt.verifyToken,
  authJwt.isPrincipal,
  studentPromotionControllers
    .processStudentPromotion
);

app.post(
  "/academic-year/promotion/students/bulk",
  authJwt.verifyToken,
  authJwt.isPrincipal,
  studentPromotionControllers
    .processBulkStudentPromotion
);

};