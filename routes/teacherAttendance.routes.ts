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
  "/api/attendance/teacher/list",
  authJwt.verifyToken,
    authJwt.isAdmin || authJwt.isPrincipal,
  teacherAttendanceControllers
    .getTeachersForAttendance
);



app.get(
  "/api/attendance/student/my-sections",
    authJwt.verifyToken,
    authJwt.isTeacher,
  teacherAttendanceControllers.getTeacherAssignedSections
);

app.get(
  "/api/teacher-attendance/my-sections",
    authJwt.verifyToken,
    authJwt.isTeacher,
  teacherAttendanceControllers.getTeacherAssignedSections
);

/* ============================================================
   MARK / UPDATE TEACHER ATTENDANCE
============================================================ */

/*
 * POST
 * /attendance/teacher/mark
 */
app.post(
  "/api/attendance/teacher/mark",
  authJwt.verifyToken,
  authJwt.isAdmin || authJwt.isPrincipal,
  teacherAttendanceControllers
    .markTeacherAttendance
);


app.get(
  "/api/attendance/student/my-section-students",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers
    .getTeacherSectionStudents
);


app.get(
  "/api/attendance/student/my-section-attendance",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers.getTeacherSectionAttendance
);

app.post(
  "/api/attendance/student/my-section-attendance",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers.saveTeacherSectionAttendance
);


app.get(
  "/api/attendance/student/my-student-attendance-history",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers.getTeacherStudentAttendanceHistory
);

app.get(
  "/api/attendance/student/my-students",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers.getTeacherMyStudents
);

app.get(
  "/api/teacher-attendance/my-attendance",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers.getMyTeacherAttendance
);

app.get(
  "/api/teacher-attendance/my-attendance/today",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherAttendanceControllers.getMyTeacherAttendanceToday
);
/* ============================================================
   DAILY REPORT
============================================================ */

/*
 * GET
 * /attendance/teacher/daily?date=27/08/2026
 */
app.get(
  "/api/attendance/teacher/daily",
  authJwt.verifyToken,
  authJwt.isAdmin || authJwt.isPrincipal,
  teacherAttendanceControllers
    .getDailyTeacherAttendance
);
}