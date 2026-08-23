"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
/* ============================================================
   AUTH ROUTES
============================================================ */
const useAuthRoutes = (app) => {
    /* ==========================================================
       PLATFORM ADMIN SIGN IN
       
       Platform admins are global.
       
       Login:
         email
         password
       
       They do NOT use schoolCode.
    ========================================================== */
    app.post("/api/auth/platform/signin", controllers_1.authController.platformAdminSignin);
    /* ==========================================================
       SCHOOL USER SIGN IN
       
       One application for everyone.
       
       Login:
         schoolCode
         email
         password
       
       Response contains:
         role
         schoolId
         schoolCode
         schoolName
       
       Frontend decides which interface to show
       based on role.
    ========================================================== */
    app.post("/api/auth/signin", controllers_1.authController.signin);
    /* ==========================================================
       CREATE PRINCIPAL
       
       ONLY PLATFORM ADMIN
       
       Platform Admin
            ↓
         School
            ↓
        Principal
       
       URL:
         /api/platform/schools/:schoolId/principal
    ========================================================== */
    app.post("/api/platform/schools/:schoolId/principal", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isSuperAdmin,
    ], controllers_1.authController.createPrincipal);
    /* ==========================================================
       CREATE SCHOOL ADMIN
       
       ONLY PRINCIPAL
       
       Principal
            ↓
          Admin
       
       schoolId comes from JWT.
       
       NEVER accept schoolId from request body.
    ========================================================== */
    app.post("/api/auth/admin", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isPrincipal,
    ], controllers_1.authController.createAdmin);
    /* ==========================================================
       CREATE TEACHER
       
       PRINCIPAL / ADMIN
       
       Both are allowed because isAdmin allows:
       
         PRINCIPAL
         ADMIN
    ========================================================== */
    app.post("/api/auth/teacher", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isAdmin,
    ], controllers_1.authController.createTeacher);
    /* ==========================================================
       CREATE PARENT
       
       PRINCIPAL / ADMIN
       
       "Student account" in the application means
       the PARENT login account.
    ========================================================== */
    app.post("/api/auth/parent", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isAdmin,
    ], controllers_1.authController.createParent);
    /* ==========================================================
       DELETE SCHOOL USER
       
       ONLY PRINCIPAL
       
       Principal can delete:
         ADMIN
         TEACHER
         PARENT
       
       Principal itself cannot be deleted here.
       Platform Admin manages Principal.
    ========================================================== */
    app.post("/api/auth/delete", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isPrincipal,
    ], controllers_1.authController.delete);
};
exports.useAuthRoutes = useAuthRoutes;
