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
    "/api/leave/pending",

    authJwt.verifyToken,

 
    authJwt.isPrincipalOrAdmin,

    leaveControllers
      .getPendingLeaveRequests
  );


  app.patch(
    "/api/leave/update",

    authJwt.verifyToken,

    authJwt.isPrincipalOrAdmin,

    leaveControllers
      .updateLeaveRequest
  );


  app.get(
    "/api/leave/history",

    authJwt.verifyToken,

    authJwt.isPrincipalOrAdmin,

    leaveControllers
      .getLeaveHistory
  );

};