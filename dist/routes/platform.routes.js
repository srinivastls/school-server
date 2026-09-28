"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePlatformRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { verifyToken, isSuperAdmin, } = middlewares_1.authJwt;
const { getDashboard, getSchools, updateSchoolStatus, createSchool, createPrincipal, } = controllers_1.platformController;
const usePlatformRoutes = (app) => {
    /* ========================================================
       PLATFORM ADMIN DASHBOARD
    ======================================================== */
    app.get("/api/platform/dashboard", [
        verifyToken,
        isSuperAdmin,
    ], getDashboard);
    app.get("/api/platform/schools", [
        verifyToken,
        isSuperAdmin,
    ], getSchools);
    app.patch("/api/platform/schools/:schoolId/status", [
        verifyToken,
        isSuperAdmin,
    ], updateSchoolStatus);
    app.post("/api/platform/schools", [
        verifyToken,
        isSuperAdmin,
    ], createSchool);
    app.post("/api/platform/schools/:schoolId/principal", [
        verifyToken,
        isSuperAdmin,
    ], createPrincipal);
    app.get("/api/platform/schools/:id", [
        verifyToken,
        isSuperAdmin,
    ], controllers_1.platformController.getSchoolById);
    app.get("/api/platform/schools/:schoolId/academic-years/:academicYearId/deletion-preview", [verifyToken, isSuperAdmin], controllers_1.getAcademicYearDeletionPreviewController);
    app.post("/api/platform/schools/:schoolId/exports/full", [verifyToken, isSuperAdmin], controllers_1.exportSchoolController);
    app.post("/api/platform/schools/:schoolId/exports/academic-year/:academicYearId", [verifyToken, isSuperAdmin], controllers_1.exportAcademicYearController);
    app.get("/api/platform/exports/:operationId", [verifyToken, isSuperAdmin], controllers_1.getExportStatusController);
    app.get("/api/platform/exports/:operationId/download", controllers_1.downloadExportController);
    app.get("/api/platform/schools/:schoolId/data-operations", [verifyToken, isSuperAdmin], controllers_1.getSchoolDataOperationsController);
    app.post("/api/platform/schools/:schoolId/archive", [verifyToken, isSuperAdmin], controllers_1.archiveSchoolController);
    app.post("/api/platform/schools/:schoolId/restore", [verifyToken, isSuperAdmin], controllers_1.restoreSchoolController);
    app.delete("/api/platform/schools/:schoolId/academic-years/:academicYearId", [verifyToken, isSuperAdmin], controllers_1.deleteAcademicYearController);
    app.delete("/api/platform/schools/:schoolId", [verifyToken, isSuperAdmin], controllers_1.deleteSchoolController);
};
exports.usePlatformRoutes = usePlatformRoutes;
