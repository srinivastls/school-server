import { Express } from "express";

import {
  teacherAttendanceControllers,
} from "../controllers/";

import {
  authJwt,
} from "../middlewares";



/* ============================================================
   GET TEACHERS + EXISTING ATTENDANCE
============================================================ */

/*
 * GET
 * /attendance/teacher/list?date=27/08/2026
 */

export const useTeacherAttendanceRoutes = (
  app: Express
) => {
app.get(
  "/list",
  authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
  teacherAttendanceControllers
    .getTeachersForAttendance
);


/* ============================================================
   MARK / UPDATE TEACHER ATTENDANCE
============================================================ */

/*
 * POST
 * /attendance/teacher/mark
 */
app.post(
  "/mark",
  authJwt.verifyToken,
  authJwt.isAdmin || authJwt.isPrincipal,
  teacherAttendanceControllers
    .markTeacherAttendance
);


/* ============================================================
   DAILY REPORT
============================================================ */

/*
 * GET
 * /attendance/teacher/daily?date=27/08/2026
 */
app.get(
  "/daily",
  authJwt.verifyToken,
  authJwt.isAdmin || authJwt.isPrincipal,
  teacherAttendanceControllers
    .getDailyTeacherAttendance
);
}