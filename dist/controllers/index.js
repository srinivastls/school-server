"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./auth.controller"), exports);
__exportStar(require("./user.controller"), exports);
__exportStar(require("./class.controller"), exports);
__exportStar(require("./coupon.controller"), exports);
__exportStar(require("./student.controller"), exports);
__exportStar(require("./transaction.controller"), exports);
__exportStar(require("./report.controller"), exports);
__exportStar(require("./academicYear.controller"), exports);
__exportStar(require("./platform.controller"), exports);
__exportStar(require("./principal.controller"), exports);
__exportStar(require("./attendance.controller"), exports);
__exportStar(require("./teacherAttendance.controller"), exports);
__exportStar(require("./attendanceReports.controller"), exports);
__exportStar(require("./leave.controller"), exports);
__exportStar(require("./attendanceDashboard.controller"), exports);
__exportStar(require("./studentPromotion.controller"), exports);
__exportStar(require("./classTeacher.controller"), exports);
__exportStar(require("./teacherStudentMapping.controller"), exports);
__exportStar(require("./teacher.controller"), exports);
__exportStar(require("./teacherMarks.controllers"), exports);
__exportStar(require("./teacherLeave.controllers"), exports);
__exportStar(require("./teacherProfile.controllers"), exports);
__exportStar(require("./teacherTimetable.controllers"), exports);
__exportStar(require("./adminDashboard.controller"), exports);
__exportStar(require("./adminTeacherAttendance.controller"), exports);
__exportStar(require("./adminLeave.controller"), exports);
