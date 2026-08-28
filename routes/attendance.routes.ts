import { Express } from "express";

import {
  attendanceControllers,
  attendanceReportControllers,
  teacherAttendanceControllers,
  attendanceDashboardControllers,
} from "../controllers";

import { authJwt } from "../middlewares";


export const useAttendanceRoutes = (
  app: Express
) => {

  /* ============================================================
     STUDENT ATTENDANCE
  ============================================================ */

  app.get(
    "/api/attendance/student/list",

    authJwt.verifyToken,

    authJwt.isTeacher || authJwt.isAdmin || authJwt.isPrincipal,

    attendanceControllers
      .getStudentsForAttendance
  );


  app.post(
    "/api/attendance/student/mark",

    authJwt.verifyToken,

    authJwt.isTeacher || authJwt.isAdmin || authJwt.isPrincipal,

    attendanceControllers
      .markStudentAttendance
  );


   app.get(
    "/student/my-sections",

    authJwt.verifyToken,

    authJwt.isTeacher,

    teacherAttendanceControllers
      .getTeacherAssignedSections
  );


  /* ============================================================
     STUDENT ATTENDANCE REPORTS
  ============================================================ */

  app.get(
    "/api/attendance/report/student/daily",

    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,

    attendanceReportControllers
      .getDailyStudentAttendance
  );


  app.get(
    "/api/attendance/report/student",

    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,

    attendanceReportControllers
      .getStudentAttendanceReport
  );


  app.get(
    "/api/attendance/student/attendance",

    authJwt.verifyToken,

    authJwt.isTeacher,

    attendanceControllers
      .getStudentsForAttendance
  );

  app.get(
    "/api/attendance/report/student/detail",

    authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,

    attendanceReportControllers
      .getStudentAttendance
  );


  /* ============================================================
     TEACHER ATTENDANCE
  ============================================================ */

  app.get(
    "/api/attendance/teacher/list",

    authJwt.verifyToken,

    authJwt.isAdmin || authJwt.isPrincipal,

    teacherAttendanceControllers
      .getTeachersForAttendance
  );


  app.post(
    "/api/attendance/teacher/mark",

    authJwt.verifyToken,

    authJwt.isAdmin || authJwt.isPrincipal,

    teacherAttendanceControllers
      .markTeacherAttendance
  );

  app.get(
  "/api/attendance/dashboard",

  authJwt.verifyToken,
  authJwt.isPrincipal,

  attendanceDashboardControllers
    .getAttendanceDashboard
);

/* ==========================================================
     STUDENT ATTENDANCE HISTORY
  ========================================================== */

  app.get(
    "/api/attendance/student/history",

    authJwt.verifyToken,

    attendanceReportControllers
      .getStudentAttendanceHistory
  );


  /* ==========================================================
     CLASS ATTENDANCE REPORT
  ========================================================== */

  app.get(
    "/api/attendance/report/class",

    authJwt.verifyToken,

    attendanceReportControllers
      .getClassAttendanceReport
  );


  
  app.get(
    "/api/attendance/teacher/daily",

    authJwt.verifyToken,

    authJwt.isAdmin || authJwt.isPrincipal,

    teacherAttendanceControllers
      .getDailyTeacherAttendance
  );


  /* ============================================================
     TEACHER ATTENDANCE REPORT
  ============================================================ */

  app.get(
    "/api/attendance/report/teacher",

    authJwt.verifyToken,

    authJwt.isAdmin || authJwt.isPrincipal,

    attendanceReportControllers
      .getTeacherAttendanceReport
  );

};