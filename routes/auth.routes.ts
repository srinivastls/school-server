import { Express } from "express";

import { authController } from "../controllers";
import { authJwt, verifySignup } from "../middlewares";

export const useAuthRoutes = (app: Express) => {
  /* ============================================================
     CREATE PLATFORM ADMIN
     ------------------------------------------------------------
     Platform admin is NOT a normal school User.
     It is stored in PlatformAdmin.
  ============================================================ */

  app.post(
    "/api/auth/createSuperAdmin",
    authController.createSuperAdmin
  );

  /* ============================================================
     SIGN UP SCHOOL USER
     ------------------------------------------------------------
     Expected:
       name
       email
       password
       schoolId
       designation?
       role?

     If signup should only be performed by an authenticated
     principal/admin, add authJwt.verifyToken + isPrincipal
     here.
  ============================================================ */

  app.post(
    "/api/auth/signup",
    [
      verifySignup.checkSchoolExists,
      verifySignup.checkDuplicateEmail,
      verifySignup.checkRole,
    ],
    authController.signup
  );

  /* ============================================================
     SIGN IN
     ------------------------------------------------------------
     Expected:
       email
       password
       schoolId
  ============================================================ */

  app.post(
    "/api/auth/signin",
    authController.signin
  );

  /* ============================================================
     DELETE SCHOOL USER
     ------------------------------------------------------------
     Only authenticated Principal should normally be allowed
     to delete users.
  ============================================================ */

  app.post(
    "/api/auth/delete",
    [
      authJwt.verifyToken,
      authJwt.isPrincipal,
    ],
    authController.delete
  );
};