import { Express } from "express";
import { userController } from "../controllers";
import { authJwt } from "../middlewares";

export const useUserRoutes = (app: Express) => {
  app.get(
    "/api/users/getAll",
    [authJwt.verifyToken, authJwt.isSuperAdmin],
    userController.getAllUsers
  );
};
