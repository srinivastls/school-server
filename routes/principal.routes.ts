import { Express } from "express";

import { principalController } from "../controllers";
import { authJwt } from "../middlewares";

const {
  verifyToken,
  isPrincipal,
  isAdmin,
  isPrincipalOrAdmin,
} = authJwt;

const {
  getTeachers,
  getParents,
  getAdmins,
  getMyProfile,
} = principalController;

export const usePrincipalRoutes = (
  app: Express
) => {
  app.get(
    "/api/principal/teachers",
    [
      verifyToken,
      isPrincipalOrAdmin,
    ],
    getTeachers
  );

  app.get(
    "/api/principal/parents",
    [
      verifyToken,
      isPrincipalOrAdmin,
    ],
    getParents
  );

  app.get(
    "/api/principal/parents/:parentId",
    [
      verifyToken,
      isPrincipalOrAdmin,
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

  app.get(
    "/api/principal/admins/:adminId",
    [
      verifyToken,
      isPrincipal,
    ],
    getAdmins
  );

  app.get('/api/principal/profile', [
    verifyToken,
    isPrincipal,
  ], principalController.getMyProfile);
};