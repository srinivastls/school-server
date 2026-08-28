"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceReportControllers = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
const config_1 = require("../config");
const utils_1 = require("../utils");
dayjs_1.default.extend(customParseFormat_1.default);
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return req.user?.schoolId;
};
/* ============================================================
   PARSE DATE
============================================================ */
const parseAttendanceDate = (value) => {
    if (!value) {
        return null;
    }
    const parsed = (0, dayjs_1.default)(value, "DD/MM/YYYY", true);
    if (!parsed.isValid()) {
        return null;
    }
    return parsed
        .startOf("day")
        .toDate();
};
const parseDate = (value) => {
    if (!value) {
        return null;
    }
    const parsed = (0, dayjs_1.default)(value, "DD/MM/YYYY", true);
    if (!parsed.isValid()) {
        return null;
    }
    return parsed
        .startOf("day")
        .toDate();
};
/* ============================================================
   DATE RANGE
============================================================ */
const parseDateRange = (from, to) => {
    const fromDate = parseAttendanceDate(from);
    const toDate = parseAttendanceDate(to);
    if (!fromDate || !toDate) {
        return null;
    }
    if ((0, dayjs_1.default)(fromDate).isAfter((0, dayjs_1.default)(toDate))) {
        return null;
    }
    const endDate = (0, dayjs_1.default)(toDate)
        .endOf("day")
        .toDate();
    return {
        gte: fromDate,
        lte: endDate,
    };
};
/* ============================================================
   STUDENT ATTENDANCE DAILY REPORT
============================================================ */
const getDailyStudentAttendance = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { date, classId, sectionId, } = req.query;
        const attendanceDate = parseAttendanceDate(String(date ?? ""));
        if (!attendanceDate) {
            return res.status(400).json({
                message: "Valid date is required. Use DD/MM/YYYY",
            });
        }
        /* ======================================================
           FILTER
        ====================================================== */
        const where = {
            schoolId,
            date: attendanceDate,
        };
        if (classId) {
            where.student = {
                classId: String(classId),
            };
        }
        if (sectionId) {
            where.student = {
                ...(where.student ?? {}),
                sectionId: String(sectionId),
            };
        }
        /* ======================================================
           FETCH
        ====================================================== */
        const attendance = await config_1.prisma.attendance.findMany({
            where,
            include: {
                student: {
                    select: {
                        id: true,
                        admissionNo: true,
                        name: true,
                        rollNumber: true,
                        class: {
                            select: {
                                id: true,
                                classNumber: true,
                                displayName: true,
                            },
                        },
                        section: {
                            select: {
                                id: true,
                                sectionName: true,
                            },
                        },
                    },
                },
                markedByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: [
                {
                    student: {
                        class: {
                            classNumber: "asc",
                        },
                    },
                },
                {
                    student: {
                        rollNumber: "asc",
                    },
                },
                {
                    student: {
                        name: "asc",
                    },
                },
            ],
        });
        /* ======================================================
           SUMMARY
        ====================================================== */
        const summary = {
            total: attendance.length,
            present: attendance.filter(item => item.status ===
                "PRESENT").length,
            absent: attendance.filter(item => item.status ===
                "ABSENT").length,
            late: attendance.filter(item => item.status ===
                "LATE").length,
            halfDay: attendance.filter(item => item.status ===
                "HALF_DAY").length,
            holiday: attendance.filter(item => item.status ===
                "HOLIDAY").length,
        };
        /* ======================================================
           PERCENTAGE
        ====================================================== */
        const marked = summary.total;
        const attendancePercentage = marked > 0
            ? Number(((summary.present +
                summary.late +
                summary.halfDay * 0.5) /
                marked) *
                100).toFixed(2)
            : 0;
        return res.status(200).json({
            date,
            summary: {
                ...summary,
                attendancePercentage,
            },
            attendance,
        });
    }
    catch (error) {
        console.error("GET DAILY STUDENT ATTENDANCE ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   STUDENT ATTENDANCE DATE RANGE REPORT
============================================================ */
const getStudentAttendanceReport = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { from, to, classId, sectionId, studentId, } = req.query;
        if (!from || !to) {
            return res.status(400).json({
                message: "from and to dates are required",
            });
        }
        const dateRange = parseDateRange(String(from), String(to));
        if (!dateRange) {
            return res.status(400).json({
                message: "Invalid date range. Use DD/MM/YYYY",
            });
        }
        /* ======================================================
           STUDENT FILTER
        ====================================================== */
        const studentWhere = {
            schoolId,
        };
        if (classId) {
            studentWhere.classId =
                String(classId);
        }
        if (sectionId) {
            studentWhere.sectionId =
                String(sectionId);
        }
        if (studentId) {
            studentWhere.id =
                String(studentId);
        }
        /* ======================================================
           FETCH STUDENTS
        ====================================================== */
        const students = await config_1.prisma.student.findMany({
            where: studentWhere,
            select: {
                id: true,
                admissionNo: true,
                name: true,
                rollNumber: true,
                class: {
                    select: {
                        id: true,
                        classNumber: true,
                        displayName: true,
                    },
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },
                attendances: {
                    where: {
                        schoolId,
                        date: dateRange,
                    },
                    select: {
                        id: true,
                        date: true,
                        status: true,
                        remark: true,
                        markedByUser: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        date: "asc",
                    },
                },
            },
            orderBy: [
                {
                    class: {
                        classNumber: "asc",
                    },
                },
                {
                    sectionId: "asc",
                },
                {
                    rollNumber: "asc",
                },
                {
                    name: "asc",
                },
            ],
        });
        /* ======================================================
           FORMAT REPORT
        ====================================================== */
        const report = students.map(student => {
            const records = student.attendances;
            const present = records.filter(item => item.status ===
                "PRESENT").length;
            const absent = records.filter(item => item.status ===
                "ABSENT").length;
            const late = records.filter(item => item.status ===
                "LATE").length;
            const halfDay = records.filter(item => item.status ===
                "HALF_DAY").length;
            const holiday = records.filter(item => item.status ===
                "HOLIDAY").length;
            const totalMarked = records.length;
            const effectivePresent = present +
                late +
                halfDay * 0.5;
            const percentage = totalMarked > 0
                ? Number((effectivePresent /
                    totalMarked) *
                    100).toFixed(2)
                : 0;
            return {
                student: {
                    id: student.id,
                    admissionNo: student.admissionNo,
                    name: student.name,
                    rollNumber: student.rollNumber,
                },
                class: student.class,
                section: student.section,
                summary: {
                    totalMarked,
                    present,
                    absent,
                    late,
                    halfDay,
                    holiday,
                    percentage,
                },
                attendance: records,
            };
        });
        /* ======================================================
           OVERALL SUMMARY
        ====================================================== */
        const overall = {
            totalStudents: report.length,
            present: report.reduce((sum, item) => sum +
                item.summary.present, 0),
            absent: report.reduce((sum, item) => sum +
                item.summary.absent, 0),
            late: report.reduce((sum, item) => sum +
                item.summary.late, 0),
            halfDay: report.reduce((sum, item) => sum +
                item.summary.halfDay, 0),
            holiday: report.reduce((sum, item) => sum +
                item.summary.holiday, 0),
        };
        const totalMarked = overall.present +
            overall.absent +
            overall.late +
            overall.halfDay +
            overall.holiday;
        const percentage = totalMarked > 0
            ? Number(((overall.present +
                overall.late +
                overall.halfDay * 0.5) /
                totalMarked) *
                100).toFixed(2)
            : 0;
        return res.status(200).json({
            from,
            to,
            overall: {
                ...overall,
                totalMarked,
                percentage,
            },
            students: report,
        });
    }
    catch (error) {
        console.error("GET STUDENT ATTENDANCE REPORT ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   STUDENT INDIVIDUAL ATTENDANCE
============================================================ */
const getStudentAttendance = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { studentId, from, to, } = req.query;
        if (!studentId) {
            return res.status(400).json({
                message: "studentId is required",
            });
        }
        if (!from || !to) {
            return res.status(400).json({
                message: "from and to dates are required",
            });
        }
        const dateRange = parseDateRange(String(from), String(to));
        if (!dateRange) {
            return res.status(400).json({
                message: "Invalid date range",
            });
        }
        /* ======================================================
           STUDENT
        ====================================================== */
        const student = await config_1.prisma.student.findFirst({
            where: {
                id: String(studentId),
                schoolId,
            },
            select: {
                id: true,
                admissionNo: true,
                name: true,
                rollNumber: true,
                class: {
                    select: {
                        id: true,
                        classNumber: true,
                        displayName: true,
                    },
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({
                message: "Student not found",
            });
        }
        /* ======================================================
           ATTENDANCE
        ====================================================== */
        const attendance = await config_1.prisma.attendance.findMany({
            where: {
                schoolId,
                studentId: student.id,
                date: dateRange,
            },
            include: {
                markedByUser: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                date: "asc",
            },
        });
        /* ======================================================
           SUMMARY
        ====================================================== */
        const present = attendance.filter(item => item.status ===
            "PRESENT").length;
        const absent = attendance.filter(item => item.status ===
            "ABSENT").length;
        const late = attendance.filter(item => item.status ===
            "LATE").length;
        const halfDay = attendance.filter(item => item.status ===
            "HALF_DAY").length;
        const holiday = attendance.filter(item => item.status ===
            "HOLIDAY").length;
        const totalMarked = attendance.length;
        const percentage = totalMarked > 0
            ? Number(((present +
                late +
                halfDay * 0.5) /
                totalMarked) *
                100).toFixed(2)
            : 0;
        return res.status(200).json({
            student,
            from,
            to,
            summary: {
                totalMarked,
                present,
                absent,
                late,
                halfDay,
                holiday,
                percentage,
            },
            attendance,
        });
    }
    catch (error) {
        console.error("GET STUDENT ATTENDANCE ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   TEACHER ATTENDANCE DATE RANGE REPORT
============================================================ */
const getTeacherAttendanceReport = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { from, to, teacherUserId, } = req.query;
        if (!from || !to) {
            return res.status(400).json({
                message: "from and to dates are required",
            });
        }
        const dateRange = parseDateRange(String(from), String(to));
        if (!dateRange) {
            return res.status(400).json({
                message: "Invalid date range",
            });
        }
        /* ======================================================
           TEACHER FILTER
        ====================================================== */
        const teacherWhere = {
            schoolId,
            role: "TEACHER",
            isActive: true,
        };
        if (teacherUserId) {
            teacherWhere.id =
                String(teacherUserId);
        }
        /* ======================================================
           FETCH
        ====================================================== */
        const teachers = await config_1.prisma.user.findMany({
            where: teacherWhere,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                employeeId: true,
                designation: true,
                department: true,
                teacherAttendances: {
                    where: {
                        schoolId,
                        date: dateRange,
                    },
                    select: {
                        id: true,
                        date: true,
                        status: true,
                        leaveType: true,
                        markedByUserId: true,
                        markedByUser: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        date: "asc",
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });
        /* ======================================================
           FORMAT
        ====================================================== */
        const report = teachers.map(teacher => {
            const records = teacher
                .teacherAttendances;
            const present = records.filter(item => item.status ===
                "PRESENT").length;
            const absent = records.filter(item => item.status ===
                "ABSENT").length;
            const halfDay = records.filter(item => item.status ===
                "HALF_DAY").length;
            const onLeave = records.filter(item => item.status ===
                "ON_LEAVE").length;
            const totalMarked = records.length;
            const percentage = totalMarked > 0
                ? Number(((present +
                    halfDay *
                        0.5) /
                    totalMarked) *
                    100).toFixed(2)
                : 0;
            return {
                teacher: {
                    id: teacher.id,
                    name: teacher.name,
                    email: teacher.email,
                    phone: teacher.phone,
                    employeeId: teacher.employeeId,
                    designation: teacher.designation,
                    department: teacher.department,
                },
                summary: {
                    totalMarked,
                    present,
                    absent,
                    halfDay,
                    onLeave,
                    percentage,
                },
                attendance: records,
            };
        });
        /* ======================================================
           OVERALL
        ====================================================== */
        const overall = {
            totalTeachers: report.length,
            present: report.reduce((sum, item) => sum +
                item.summary.present, 0),
            absent: report.reduce((sum, item) => sum +
                item.summary.absent, 0),
            halfDay: report.reduce((sum, item) => sum +
                item.summary.halfDay, 0),
            onLeave: report.reduce((sum, item) => sum +
                item.summary.onLeave, 0),
        };
        const totalMarked = overall.present +
            overall.absent +
            overall.halfDay +
            overall.onLeave;
        const percentage = totalMarked > 0
            ? Number(((overall.present +
                overall.halfDay *
                    0.5) /
                totalMarked) *
                100).toFixed(2)
            : 0;
        return res.status(200).json({
            from,
            to,
            overall: {
                ...overall,
                totalMarked,
                percentage,
            },
            teachers: report,
        });
    }
    catch (error) {
        console.error("GET TEACHER ATTENDANCE REPORT ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
const getStudentAttendanceHistory = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const admissionNo = String(req.query?.admissionNo ??
            "").trim();
        const fromDateString = String(req.query?.fromDate ??
            "");
        const toDateString = String(req.query?.toDate ??
            "");
        if (!admissionNo) {
            return res.status(400).json({
                message: "Admission number is required",
            });
        }
        if (!fromDateString ||
            !toDateString) {
            return res.status(400).json({
                message: "fromDate and toDate are required",
            });
        }
        const fromDate = parseDate(fromDateString);
        const toDate = parseDate(toDateString);
        if (!fromDate || !toDate) {
            return res.status(400).json({
                message: "Invalid date. Use DD/MM/YYYY",
            });
        }
        if (fromDate > toDate) {
            return res.status(400).json({
                message: "fromDate cannot be after toDate",
            });
        }
        /* ======================================================
           FIND STUDENT
        ====================================================== */
        const student = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo,
                },
            },
            select: {
                id: true,
                admissionNo: true,
                name: true,
                class: {
                    select: {
                        id: true,
                        classNumber: true,
                        displayName: true,
                    },
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true,
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({
                message: "Student not found",
            });
        }
        /* ======================================================
           ATTENDANCE
        ====================================================== */
        const attendance = await config_1.prisma.attendance.findMany({
            where: {
                schoolId,
                studentId: student.id,
                date: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            include: {
                markedByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: {
                date: "asc",
            },
        });
        /* ======================================================
           SUMMARY
        ====================================================== */
        const summary = {
            totalDays: attendance.length,
            present: 0,
            absent: 0,
            late: 0,
            halfDay: 0,
            holiday: 0,
        };
        attendance.forEach(item => {
            switch (item.status) {
                case "PRESENT":
                    summary.present++;
                    break;
                case "ABSENT":
                    summary.absent++;
                    break;
                case "LATE":
                    summary.late++;
                    break;
                case "HALF_DAY":
                    summary.halfDay++;
                    break;
                case "HOLIDAY":
                    summary.holiday++;
                    break;
            }
        });
        /* ======================================================
           PERCENTAGE
        ====================================================== */
        const attendanceDays = summary.totalDays -
            summary.holiday;
        const attendedDays = summary.present +
            summary.late +
            summary.halfDay;
        const attendancePercentage = attendanceDays > 0
            ? Number((attendedDays /
                attendanceDays) *
                100).toFixed(2)
            : "0.00";
        /* ======================================================
           RESPONSE
        ====================================================== */
        return res.status(200).json({
            student: {
                id: student.id,
                admissionNo: student.admissionNo,
                name: student.name,
                class: student.class,
                section: student.section,
            },
            period: {
                fromDate: fromDateString,
                toDate: toDateString,
            },
            summary: {
                ...summary,
                attendancePercentage: Number(attendancePercentage),
            },
            attendance: attendance.map(item => ({
                id: item.id,
                date: (0, dayjs_1.default)(item.date).format("DD/MM/YYYY"),
                status: item.status,
                remark: item.remark,
                markedBy: item.markedByUser,
            })),
        });
    }
    catch (error) {
        console.error("GET STUDENT ATTENDANCE HISTORY ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET CLASS ATTENDANCE REPORT
============================================================ */
/**
 * GET
 * /attendance/report/class
 *
 * Query:
 *
 * classId
 * fromDate
 * toDate
 */
const getClassAttendanceReport = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const classId = String(req.query?.classId ??
            "");
        const fromDateString = String(req.query?.fromDate ??
            "");
        const toDateString = String(req.query?.toDate ??
            "");
        if (!classId ||
            !fromDateString ||
            !toDateString) {
            return res.status(400).json({
                message: "classId, fromDate and toDate are required",
            });
        }
        const fromDate = parseDate(fromDateString);
        const toDate = parseDate(toDateString);
        if (!fromDate || !toDate) {
            return res.status(400).json({
                message: "Invalid date. Use DD/MM/YYYY",
            });
        }
        if (fromDate > toDate) {
            return res.status(400).json({
                message: "fromDate cannot be after toDate",
            });
        }
        /* ======================================================
           CLASS
        ====================================================== */
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                id: classId,
                schoolId,
            },
            select: {
                id: true,
                classNumber: true,
                displayName: true,
                students: {
                    where: {
                        schoolId,
                        status: "ACTIVE",
                    },
                    select: {
                        id: true,
                        admissionNo: true,
                        name: true,
                        section: {
                            select: {
                                id: true,
                                sectionName: true,
                            },
                        },
                        attendances: {
                            where: {
                                schoolId,
                                date: {
                                    gte: fromDate,
                                    lte: toDate,
                                },
                            },
                            select: {
                                date: true,
                                status: true,
                            },
                            orderBy: {
                                date: "asc",
                            },
                        },
                    },
                    orderBy: {
                        name: "asc",
                    },
                },
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        /* ======================================================
           STUDENT REPORT
        ====================================================== */
        const students = classDetails.students.map(student => {
            const attendance = student.attendances;
            let present = 0;
            let absent = 0;
            let late = 0;
            let halfDay = 0;
            let holiday = 0;
            attendance.forEach(item => {
                switch (item.status) {
                    case "PRESENT":
                        present++;
                        break;
                    case "ABSENT":
                        absent++;
                        break;
                    case "LATE":
                        late++;
                        break;
                    case "HALF_DAY":
                        halfDay++;
                        break;
                    case "HOLIDAY":
                        holiday++;
                        break;
                }
            });
            const markedDays = attendance.length;
            const workingDays = markedDays -
                holiday;
            const attendedDays = present +
                late +
                halfDay;
            const percentage = workingDays > 0
                ? Number((attendedDays /
                    workingDays) *
                    100).toFixed(2)
                : 0;
            return {
                id: student.id,
                admissionNo: student.admissionNo,
                name: student.name,
                section: student.section,
                totalMarkedDays: markedDays,
                present,
                absent,
                late,
                halfDay,
                holiday,
                attendancePercentage: percentage,
            };
        });
        /* ======================================================
           CLASS SUMMARY
        ====================================================== */
        const summary = {
            totalStudents: students.length,
            studentsWithAttendance: students.filter(student => student.totalMarkedDays >
                0).length,
            totalPresent: students.reduce((sum, student) => sum +
                student.present, 0),
            totalAbsent: students.reduce((sum, student) => sum +
                student.absent, 0),
            totalLate: students.reduce((sum, student) => sum +
                student.late, 0),
            totalHalfDay: students.reduce((sum, student) => sum +
                student.halfDay, 0),
            totalHoliday: students.reduce((sum, student) => sum +
                student.holiday, 0),
        };
        /* ======================================================
           RESPONSE
        ====================================================== */
        return res.status(200).json({
            class: {
                id: classDetails.id,
                classNumber: classDetails.classNumber,
                displayName: classDetails.displayName,
            },
            period: {
                fromDate: fromDateString,
                toDate: toDateString,
            },
            summary,
            students,
        });
    }
    catch (error) {
        console.error("GET CLASS ATTENDANCE REPORT ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.attendanceReportControllers = {
    getDailyStudentAttendance,
    getStudentAttendanceReport,
    getStudentAttendance,
    getTeacherAttendanceReport,
    getStudentAttendanceHistory,
    getClassAttendanceReport,
};
