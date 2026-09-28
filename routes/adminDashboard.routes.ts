import { Express } from "express";

import {
  getAdminDashboard,
} from "../controllers/adminDashboard.controller";

import { authJwt } from "../middlewares";


export const   useAdminDashboardRoutes = (app: Express) => {
  app.get(
    "/api/admin/dashboard",
    authJwt.verifyToken,
  authJwt.isAdmin,
  getAdminDashboard
    
  );
}
/**
 * GET /api/v1/admin/dashboard
 */
