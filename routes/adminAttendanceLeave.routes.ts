import { Express } from "express";
import {
  getTeachersForAttendance,
  getDailyTeacherAttendance,
  bulkMarkTeacherAttendance,
  getTeachers,
} from "../controllers/adminTeacherAttendance.controller";
import {
  getLeaveRequests,
  decideLeaveRequest,
} from "../controllers/adminLeave.controller";
import { authJwt } from "../middlewares/authJwt";

export const useAdminAttendanceLeaveRoutes = (app: Express) => {
  
  const adminOnly = authJwt.isAdmin || authJwt.isPrincipal;

   app.get("/api/admin/getteachers", authJwt.verifyToken, adminOnly, getTeachers);

  app.get("/api/admin/teachers", authJwt.verifyToken, adminOnly, getTeachersForAttendance);
  app.get("/api/admin/teacher-attendance", authJwt.verifyToken, adminOnly, getDailyTeacherAttendance);
  app.post("/api/admin/teacher-attendance/bulk", authJwt.verifyToken, adminOnly, bulkMarkTeacherAttendance);

  app.get("/api/admin/leave-requests", authJwt.verifyToken, adminOnly, getLeaveRequests);
  app.patch("/api/admin/leave-requests/:leaveId/decision", authJwt.verifyToken, adminOnly, decideLeaveRequest);
};



