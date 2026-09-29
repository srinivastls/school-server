import { Express } from "express";

import {
  platformController,
  getAcademicYearDeletionPreviewController,
  exportSchoolController,
  exportAcademicYearController,
  getExportStatusController,
  downloadExportController,
  getSchoolDataOperationsController,
  archiveSchoolController,
  restoreSchoolController,
  deleteAcademicYearController,
  deleteSchoolController,
} from "../controllers";

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


  app.get(
    "/api/platform/schools/:schoolId/academic-years/:academicYearId/deletion-preview",
    [verifyToken, isSuperAdmin],
    getAcademicYearDeletionPreviewController
  );

  app.post(
    "/api/platform/schools/:schoolId/exports/full",
    [verifyToken, isSuperAdmin],
    exportSchoolController
  );

  app.post(
    "/api/platform/schools/:schoolId/exports/academic-year/:academicYearId",
    [verifyToken, isSuperAdmin],
    exportAcademicYearController
  );

  app.get(
    "/api/platform/exports/:operationId",
    [verifyToken, isSuperAdmin],
    getExportStatusController
  );

  app.get(
    "/api/platform/exports/:operationId/download",
    downloadExportController
  );

  app.get(
    "/api/platform/schools/:schoolId/data-operations",
    [verifyToken, isSuperAdmin],
    getSchoolDataOperationsController
  );

  app.post(
    "/api/platform/schools/:schoolId/archive",
    [verifyToken, isSuperAdmin],
    archiveSchoolController
  );

  app.post(
    "/api/platform/schools/:schoolId/restore",
    [verifyToken, isSuperAdmin],
    restoreSchoolController
  );

  app.patch(
    "/api/platform/schools/:schoolId/principal",
    [verifyToken, isSuperAdmin],
    platformController.updatePrincipal
  );

  app.delete(
    "/api/platform/schools/:schoolId/academic-years/:academicYearId",
    [verifyToken, isSuperAdmin],
    deleteAcademicYearController
  );

  app.delete(
    "/api/platform/schools/:schoolId",
    [verifyToken, isSuperAdmin],
    deleteSchoolController
  );

  app.delete(
    "/api/platform/schools/:schoolId/principal",
    [verifyToken, isSuperAdmin],
    platformController.deletePrincipal
  );

};