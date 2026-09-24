"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkMarkTeacherAttendance = exports.getDailyTeacherAttendance = exports.getTeachersForAttendance = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const config_1 = require("../config");
const utils_1 = require("../utils");
const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY"];
const getSchoolId = (req) => req.user?.schoolId;
const getUserId = (req) => req.user?.id;
const parseDate = (value) => {
    if (typeof value !== "string" || !value.trim())
        return null;
    for (const format of DATE_FORMATS) {
        const parsed = (0, dayjs_1.default)(value, format, true);
        if (parsed.isValid())
            return parsed.startOf("day").toDate();
    }
    return null;
};
const serializeDate = (date) => (0, dayjs_1.default)(date).format("YYYY-MM-DD");
const getTeachersForAttendance = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const dateValue = String(req.query?.date ?? "");
        const date = parseDate(dateValue);
        if (!schoolId)
            return res.status(401).json({ message: "School context missing" });
        if (!date)
            return res.status(400).json({ message: "Valid date is required (YYYY-MM-DD)" });
        const teachers = await config_1.prisma.user.findMany({
            where: { schoolId, role: "TEACHER", isActive: true },
            select: {
                id: true, name: true, email: true, phone: true,
                employeeId: true, designation: true, department: true,
                teacherAttendances: {
                    where: { schoolId, date },
                    select: { id: true, status: true, leaveType: true, markedByUserId: true, createdAt: true, updatedAt: true },
                    take: 1,
                },
            },
            orderBy: { name: "asc" },
        });
        return res.status(200).json({
            date: serializeDate(date),
            totalTeachers: teachers.length,
            teachers: teachers.map((teacher) => ({
                ...teacher,
                attendance: teacher.teacherAttendances[0] ?? null,
                teacherAttendances: undefined,
            })),
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getTeachersForAttendance = getTeachersForAttendance;
const getDailyTeacherAttendance = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const date = parseDate(String(req.query?.date ?? ""));
        if (!schoolId)
            return res.status(401).json({ message: "School context missing" });
        if (!date)
            return res.status(400).json({ message: "Valid date is required (YYYY-MM-DD)" });
        const attendance = await config_1.prisma.teacherAttendance.findMany({
            where: { schoolId, date },
            include: {
                teacher: {
                    select: { id: true, name: true, email: true, employeeId: true, designation: true, department: true },
                },
                markedByUser: { select: { id: true, name: true, role: true } },
            },
            orderBy: { teacher: { name: "asc" } },
        });
        const summary = {
            total: attendance.length,
            present: attendance.filter((x) => x.status === "PRESENT").length,
            absent: attendance.filter((x) => x.status === "ABSENT").length,
            halfDay: attendance.filter((x) => x.status === "HALF_DAY").length,
            onLeave: attendance.filter((x) => x.status === "ON_LEAVE").length,
        };
        return res.status(200).json({ date: serializeDate(date), summary, attendance });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getDailyTeacherAttendance = getDailyTeacherAttendance;
const bulkMarkTeacherAttendance = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const markedByUserId = getUserId(req);
        const date = parseDate(req.body?.date);
        const records = req.body?.records;
        if (!schoolId || !markedByUserId) {
            return res.status(401).json({ message: "Authenticated school user is required" });
        }
        if (!date)
            return res.status(400).json({ message: "Valid date is required (YYYY-MM-DD)" });
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: "records must be a non-empty array" });
        }
        const allowedStatuses = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"];
        const allowedLeaveTypes = ["CL", "SL", "EL", "LWP"];
        const ids = records.map((item) => item.teacherId);
        if (new Set(ids).size !== ids.length) {
            return res.status(400).json({ message: "Duplicate teacherId values are not allowed" });
        }
        for (const item of records) {
            if (!item.teacherId || !allowedStatuses.includes(item.status)) {
                return res.status(400).json({ message: "Each record requires a valid teacherId and status" });
            }
            if (item.status === "ON_LEAVE" && !allowedLeaveTypes.includes(item.leaveType)) {
                return res.status(400).json({ message: `Valid leaveType is required for ${item.teacherId}` });
            }
            if (item.status !== "ON_LEAVE" && item.leaveType != null) {
                return res.status(400).json({ message: "leaveType is only allowed with ON_LEAVE" });
            }
        }
        const teachers = await config_1.prisma.user.findMany({
            where: { id: { in: ids }, schoolId, role: "TEACHER", isActive: true },
            select: { id: true },
        });
        const foundIds = new Set(teachers.map((teacher) => teacher.id));
        const missingId = ids.find((id) => !foundIds.has(id));
        if (missingId)
            return res.status(404).json({ message: `Active teacher not found: ${missingId}` });
        const saved = await config_1.prisma.$transaction(async (tx) => {
            const result = [];
            for (const item of records) {
                result.push(await tx.teacherAttendance.upsert({
                    where: {
                        schoolId_teacherUserId_date: {
                            schoolId,
                            teacherUserId: item.teacherId,
                            date,
                        },
                    },
                    create: {
                        schoolId,
                        teacherUserId: item.teacherId,
                        date,
                        status: item.status,
                        leaveType: item.status === "ON_LEAVE" ? item.leaveType : null,
                        markedByUserId,
                    },
                    update: {
                        status: item.status,
                        leaveType: item.status === "ON_LEAVE" ? item.leaveType : null,
                        markedByUserId,
                    },
                }));
            }
            return result;
        });
        return res.status(200).json({
            message: "Teacher attendance saved successfully",
            date: serializeDate(date),
            count: saved.length,
            attendance: saved,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.bulkMarkTeacherAttendance = bulkMarkTeacherAttendance;
