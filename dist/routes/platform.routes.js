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
};
exports.usePlatformRoutes = usePlatformRoutes;
