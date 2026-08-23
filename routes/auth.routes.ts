import { Express } from "express";

import {
  authController,
} from "../controllers";

import {
  authJwt,
} from "../middlewares";

/* ============================================================
   AUTH ROUTES
============================================================ */

export const useAuthRoutes = (
  app: Express
) => {

  /* ==========================================================
     PLATFORM ADMIN SIGN IN
     
     Platform admins are global.
     
     Login:
       email
       password
     
     They do NOT use schoolCode.
  ========================================================== */

  app.post(
    "/api/auth/platform/signin",
    authController.platformAdminSignin
  );


  /* ==========================================================
     SCHOOL USER SIGN IN
     
     One application for everyone.
     
     Login:
       schoolCode
       email
       password
     
     Response contains:
       role
       schoolId
       schoolCode
       schoolName
     
     Frontend decides which interface to show
     based on role.
  ========================================================== */

  app.post(
    "/api/auth/signin",
    authController.signin
  );


  /* ==========================================================
     CREATE PRINCIPAL
     
     ONLY PLATFORM ADMIN
     
     Platform Admin
          ↓
       School
          ↓
      Principal
     
     URL:
       /api/platform/schools/:schoolId/principal
  ========================================================== */

  app.post(
    "/api/platform/schools/:schoolId/principal",
    [
      authJwt.verifyToken,
      authJwt.isSuperAdmin,
    ],
    authController.createPrincipal
  );


  /* ==========================================================
     CREATE SCHOOL ADMIN
     
     ONLY PRINCIPAL
     
     Principal
          ↓
        Admin
     
     schoolId comes from JWT.
     
     NEVER accept schoolId from request body.
  ========================================================== */

  app.post(
    "/api/auth/admin",
    [
      authJwt.verifyToken,
      authJwt.isPrincipal,
    ],
    authController.createAdmin
  );


  /* ==========================================================
     CREATE TEACHER
     
     PRINCIPAL / ADMIN
     
     Both are allowed because isAdmin allows:
     
       PRINCIPAL
       ADMIN
  ========================================================== */

  app.post(
    "/api/auth/teacher",
    [
      authJwt.verifyToken,
      authJwt.isAdmin,
    ],
    authController.createTeacher
  );


  /* ==========================================================
     CREATE PARENT
     
     PRINCIPAL / ADMIN
     
     "Student account" in the application means
     the PARENT login account.
  ========================================================== */

  app.post(
    "/api/auth/parent",
    [
      authJwt.verifyToken,
      authJwt.isAdmin,
    ],
    authController.createParent
  );


  /* ==========================================================
     DELETE SCHOOL USER
     
     ONLY PRINCIPAL
     
     Principal can delete:
       ADMIN
       TEACHER
       PARENT
     
     Principal itself cannot be deleted here.
     Platform Admin manages Principal.
  ========================================================== */

  app.post(
    "/api/auth/delete",
    [
      authJwt.verifyToken,
      authJwt.isPrincipal,
    ],
    authController.delete
  );
};