import { Express } from "express";

import { platformController } from "../controllers";

import { authJwt } from "../middlewares";

const {
  verifyToken,
  isSuperAdmin,
} = authJwt;

const {
  getDashboard,
  getSchools,
  updateSchoolStatus,
  createSchool,
  createPrincipal,
} = platformController;

export const usePlatformRoutes = (
  app: Express
) => {
  /* ========================================================
     PLATFORM ADMIN DASHBOARD
  ======================================================== */

  app.get(
    "/api/platform/dashboard",
    [
      verifyToken,
      isSuperAdmin,
    ],
    getDashboard
  );

  app.get(
    "/api/platform/schools",
    [
      verifyToken,
      isSuperAdmin,
    ],
    getSchools
  );

  app.patch(
  "/api/platform/schools/:schoolId/status",
  [
    verifyToken,
    isSuperAdmin,
  ],
  updateSchoolStatus
);

  app.post(
  "/api/platform/schools",
  [
    verifyToken,
    isSuperAdmin,
  ],
  createSchool
);

app.post(
  "/api/platform/schools/:schoolId/principal",
  [
    verifyToken,
    isSuperAdmin,
  ],
  createPrincipal
);

app.get(
  "/api/platform/schools/:id",
  [
    verifyToken,
    isSuperAdmin,
  ],
  platformController.getSchoolById
);

};