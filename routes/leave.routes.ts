import { Express } from "express";

import {
  leaveControllers,
} from "../controllers";

import {
  authJwt,
} from "../middlewares";


export const useLeaveRoutes = (
  app: Express
) => {

  /* ============================================================
     TEACHER / USER
  ============================================================ */

  app.post(
    "/leave/request",

    authJwt.verifyToken,

    leaveControllers
      .createLeaveRequest
  );


  app.get(
    "/leave/my",

    authJwt.verifyToken,

    leaveControllers
      .getMyLeaveRequests
  );


  /* ============================================================
     ADMIN
  ============================================================ */

  app.get(
    "/leave/pending",

    authJwt.verifyToken,

    authJwt.isAdmin,

    leaveControllers
      .getPendingLeaveRequests
  );


  app.patch(
    "/leave/update",

    authJwt.verifyToken,

    authJwt.isAdmin,

    leaveControllers
      .updateLeaveRequest
  );


  app.get(
    "/leave/history",

    authJwt.verifyToken,

    authJwt.isAdmin,

    leaveControllers
      .getLeaveHistory
  );

};