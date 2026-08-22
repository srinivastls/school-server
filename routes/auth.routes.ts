import { Express } from "express";
import { authController } from "../controllers";
import { authJwt, verifySignup } from "../middlewares";

export const useAuthRoutes = (app: Express) => {
  app.post(
    "/api/auth/createSuperAdmin",
    [verifySignup.checkDuplicateEmail, verifySignup.checkDuplicateAdminId],
    authController.createSuperAdmin
  );

  //signup
  app.post(
    "/api/auth/signup",
    [
      authJwt.verifyToken,
      verifySignup.checkDuplicateEmail,
      verifySignup.checkDuplicateAdminId,
      verifySignup.checkRolesExist,
    ],
    authController.signup
  );

  //signin
  app.post("/api/auth/signin", authController.signin);

  //delete
  app.post(
    "/api/auth/delete",
    [authJwt.verifyToken, authJwt.isSuperAdmin],
    authController.delete
  );

  //delete superadmin
  app.post(
    "/api/auth/deleteSuperAdmin",
    [authJwt.verifyToken, authJwt.isSuperAdmin, authJwt.isOwner],
    authController.delete
  );
};
