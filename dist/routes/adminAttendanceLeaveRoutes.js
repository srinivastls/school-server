"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAdminAttendanceLeaveRoutes = void 0;
const adminTeacherAttendance_controller_1 = require("../controllers/adminTeacherAttendance.controller");
const adminLeave_controller_1 = require("../controllers/adminLeave.controller");
const authJwt_1 = require("../middlewares/authJwt");
const useAdminAttendanceLeaveRoutes = (app) => {
    const adminOnly = authJwt_1.authJwt.isAdmin || authJwt_1.authJwt.isPrincipal;
    app.get("/api/admin/teachers", authJwt_1.authJwt.verifyToken, adminOnly, adminTeacherAttendance_controller_1.getTeachersForAttendance);
    app.get("/api/admin/teacher-attendance", authJwt_1.authJwt.verifyToken, adminOnly, adminTeacherAttendance_controller_1.getDailyTeacherAttendance);
    app.post("/api/admin/teacher-attendance/bulk", authJwt_1.authJwt.verifyToken, adminOnly, adminTeacherAttendance_controller_1.bulkMarkTeacherAttendance);
    app.get("/api/admin/leave-requests", authJwt_1.authJwt.verifyToken, adminOnly, adminLeave_controller_1.getLeaveRequests);
    app.patch("/api/admin/leave-requests/:leaveId/decision", authJwt_1.authJwt.verifyToken, adminOnly, adminLeave_controller_1.decideLeaveRequest);
};
exports.useAdminAttendanceLeaveRoutes = useAdminAttendanceLeaveRoutes;
