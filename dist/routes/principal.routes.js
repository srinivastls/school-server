"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { verifyToken, isPrincipal, isAdmin, isPrincipalOrAdmin, } = middlewares_1.authJwt;
const { getTeachers, getParents, getAdmins, getMyProfile, } = controllers_1.principalController;
const usePrincipalRoutes = (app) => {
    app.get("/api/principal/teachers", [
        verifyToken,
        isPrincipalOrAdmin,
    ], getTeachers);
    app.get("/api/principal/parents", [
        verifyToken,
        isPrincipalOrAdmin,
    ], getParents);
    app.get("/api/principal/parents/:parentId", [
        verifyToken,
        isPrincipalOrAdmin,
    ], getParents);
    app.get("/api/principal/admins", [
        verifyToken,
        isPrincipal,
    ], getAdmins);
    app.get("/api/principal/admins/:adminId", [
        verifyToken,
        isPrincipal,
    ], getAdmins);
    app.get('/api/principal/profile', [
        verifyToken,
        isPrincipal,
    ], controllers_1.principalController.getMyProfile);
};
exports.usePrincipalRoutes = usePrincipalRoutes;
