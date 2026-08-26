import { Express } from "express";

import { principalController } from "../controllers";
import { authJwt } from "../middlewares";

const {
  verifyToken,
  isPrincipal,
  isAdmin,
} = authJwt;

const {
  getTeachers,
  getParents,
  getAdmins,
} = principalController;

export const usePrincipalRoutes = (
  app: Express
) => {
  app.get(
    "/api/principal/teachers",
    [
      verifyToken,
      isPrincipal,
    ],
    getTeachers
  );

  app.get(
    "/api/principal/parents",
    [
      verifyToken,
      isPrincipal,
    ],
    getParents
  );

  app.get(
    "/api/principal/parents/:parentId",
    [
      verifyToken,
      isPrincipal,
    ],
    getParents
  );

  app.get(
    "/api/principal/admins",
    [
      verifyToken,
      isPrincipal,
    ],
    getAdmins
  );
};