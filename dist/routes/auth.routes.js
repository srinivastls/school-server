"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useAuthRoutes = (app) => {
    /* ============================================================
       CREATE PLATFORM ADMIN
       ------------------------------------------------------------
       Platform admin is NOT a normal school User.
       It is stored in PlatformAdmin.
    ============================================================ */
    app.post("/api/auth/createSuperAdmin", controllers_1.authController.createSuperAdmin);
    /* ============================================================
       SIGN UP SCHOOL USER
       ------------------------------------------------------------
       Expected:
         name
         email
         password
         schoolId
         designation?
         role?
  
       If signup should only be performed by an authenticated
       principal/admin, add authJwt.verifyToken + isPrincipal
       here.
    ============================================================ */
    app.post("/api/auth/signup", [
        middlewares_1.verifySignup.checkSchoolExists,
        middlewares_1.verifySignup.checkDuplicateEmail,
        middlewares_1.verifySignup.checkRole,
    ], controllers_1.authController.signup);
    /* ============================================================
       SIGN IN
       ------------------------------------------------------------
       Expected:
         email
         password
         schoolId
    ============================================================ */
    app.post("/api/auth/signin", controllers_1.authController.signin);
    /* ============================================================
       DELETE SCHOOL USER
       ------------------------------------------------------------
       Only authenticated Principal should normally be allowed
       to delete users.
    ============================================================ */
    app.post("/api/auth/delete", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isPrincipal,
    ], controllers_1.authController.delete);
};
exports.useAuthRoutes = useAuthRoutes;
