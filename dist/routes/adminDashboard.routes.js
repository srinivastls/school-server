"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAdminDashboardRoutes = void 0;
const adminDashboard_controller_1 = require("../controllers/adminDashboard.controller");
const middlewares_1 = require("../middlewares");
const useAdminDashboardRoutes = (app) => {
    app.get("/api/admin/dashboard", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin, adminDashboard_controller_1.getAdminDashboard);
};
exports.useAdminDashboardRoutes = useAdminDashboardRoutes;
/**
 * GET /api/v1/admin/dashboard
 */
