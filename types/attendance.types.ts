import {
  AttendanceStatus,
  TeacherAttendanceStatus,
  LeaveType,
} from "@prisma/client";

/* ============================================================
   STUDENT ATTENDANCE
============================================================ */

export type MarkStudentAttendanceItem = {
  studentId: string;
  status: AttendanceStatus;
  remark?: string;
};

export type MarkStudentAttendanceRequest = {
  classId: string;
  sectionId: string;
  academicYearId: string;
  date: string;

  attendance: MarkStudentAttendanceItem[];
};


/* ============================================================
   STUDENT ATTENDANCE RESPONSE
============================================================ */

export type StudentAttendanceResponse = {
  id: string;

  studentId: string;
  classId: string;
  sectionId: string;
  academicYearId: string;

  date: string;

  status: AttendanceStatus;

  remark?: string | null;

  markedByUserId: string;

  createdAt: Date;
  updatedAt: Date;
};


/* ============================================================
   TEACHER ATTENDANCE
============================================================ */

export type MarkTeacherAttendanceItem = {
  teacherUserId: string;

  status: TeacherAttendanceStatus;

  leaveType?: LeaveType;
};

export type MarkTeacherAttendanceRequest = {
  date: string;

  attendance: MarkTeacherAttendanceItem[];
};


/* ============================================================
   TEACHER ATTENDANCE RESPONSE
============================================================ */

export type TeacherAttendanceResponse = {
  id: string;

  teacherUserId: string;

  date: string;

  status: TeacherAttendanceStatus;

  leaveType?: LeaveType | null;

  markedByUserId: string;

  createdAt: Date;
  updatedAt: Date;
};


/* ============================================================
   ATTENDANCE SUMMARY
============================================================ */

export type AttendanceSummary = {
  totalDays: number;

  present: number;

  absent: number;

  late: number;

  halfDay: number;

  holiday: number;

  attendancePercentage: number;
};


/* ============================================================
   CLASS ATTENDANCE SUMMARY
============================================================ */

export type ClassAttendanceSummary = {
  classId: string;

  className: string;

  sectionId: string;

  sectionName: string;

  date: string;

  totalStudents: number;

  present: number;

  absent: number;

  late: number;

  halfDay: number;

  holiday: number;

  attendancePercentage: number;
};


/* ============================================================
   API ERROR
============================================================ */

export type AttendanceErrorResponse = {
  message: string;
};