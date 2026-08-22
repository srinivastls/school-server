import { Express } from "express";
import { classControllers } from "../controllers";
import { authJwt, classMiddleWares } from "../middlewares";

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
};
