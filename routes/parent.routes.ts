import { Express } from "express";

import {
  parentController,
} from "../controllers/parent.controller";

import {
  authJwt,
} from "../middlewares";




/* ============================================================
   PARENT DASHBOARD
============================================================ */
const {
  verifyToken,
  isPrincipal,
  isParent,
} = authJwt;


export const useParentRoutes = (
  app: Express
) => {
  app.get(
    "/api/parent/dashboard",
    [
      verifyToken,
      isParent,
    ],
    parentController.getParentDashboard
  );
};

