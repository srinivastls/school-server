"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useAuthRoutes = (app) => {
    app.post("/api/auth/createSuperAdmin", [middlewares_1.verifySignup.checkDuplicateEmail, middlewares_1.verifySignup.checkDuplicateAdminId], controllers_1.authController.createSuperAdmin);
    //signup
    app.post("/api/auth/signup", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.verifySignup.checkDuplicateEmail,
        middlewares_1.verifySignup.checkDuplicateAdminId,
        middlewares_1.verifySignup.checkRolesExist,
    ], controllers_1.authController.signup);
    //signin
    app.post("/api/auth/signin", controllers_1.authController.signin);
    //delete
    app.post("/api/auth/delete", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isSuperAdmin], controllers_1.authController.delete);
    //delete superadmin
    app.post("/api/auth/deleteSuperAdmin", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isSuperAdmin, middlewares_1.authJwt.isOwner], controllers_1.authController.delete);
};
exports.useAuthRoutes = useAuthRoutes;
