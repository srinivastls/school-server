"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { verifyToken, isPrincipal, isAdmin, } = middlewares_1.authJwt;
const { getTeachers, getParents, getAdmins, } = controllers_1.principalController;
const usePrincipalRoutes = (app) => {
    app.get("/api/principal/teachers", [
        verifyToken,
        isPrincipal,
    ], getTeachers);
    app.get("/api/principal/parents", [
        verifyToken,
        isPrincipal,
    ], getParents);
    app.get("/api/principal/parents/:parentId", [
        verifyToken,
        isPrincipal,
    ], getParents);
    app.get("/api/principal/admins", [
        verifyToken,
        isPrincipal,
    ], getAdmins);
};
exports.usePrincipalRoutes = usePrincipalRoutes;
