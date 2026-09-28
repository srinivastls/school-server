"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideLeaveRequest = exports.getLeaveRequests = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const config_1 = require("../config");
const utils_1 = require("../utils");
const getSchoolId = (req) => req.user?.schoolId;
const getUserId = (req) => req.user?.id;
const parseDate = (value) => {
    if (typeof value !== "string" || !value.trim())
        return null;
    const parsed = (0, dayjs_1.default)(value, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
    return parsed.isValid() ? parsed.startOf("day").toDate() : null;
};
const getLeaveRequests = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const status = req.query?.status;
        if (!schoolId)
            return res.status(401).json({ message: "School context missing" });
        if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) {
            return res.status(400).json({ message: "Invalid leave status" });
        }
        const requests = await config_1.prisma.leaveRequest.findMany({
            where: { schoolId, status },
            include: {
                teacher: {
                    select: { id: true, name: true, email: true, employeeId: true, designation: true, department: true },
                },
                approvedByUser: { select: { id: true, name: true, role: true } },
            },
            orderBy: [{ status: "asc" }, { appliedAt: "desc" }],
        });
        return res.status(200).json({ requests });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getLeaveRequests = getLeaveRequests;
const decideLeaveRequest = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const approverId = getUserId(req);
        const leaveId = String(req.params?.leaveId ?? "");
        const decision = req.body?.decision;
        const remarks = typeof req.body?.remarks === "string" ? req.body.remarks.trim() : undefined;
        if (!schoolId || !approverId)
            return res.status(401).json({ message: "Authenticated school user is required" });
        if (!leaveId)
            return res.status(400).json({ message: "leaveId is required" });
        if (!["APPROVED", "REJECTED"].includes(decision)) {
            return res.status(400).json({ message: "decision must be APPROVED or REJECTED" });
        }
        const existing = await config_1.prisma.leaveRequest.findFirst({
            where: { id: leaveId, schoolId },
            select: { id: true, status: true, teacherUserId: true, fromDate: true, toDate: true },
        });
        if (!existing)
            return res.status(404).json({ message: "Leave request not found" });
        if (existing.status !== "PENDING") {
            return res.status(409).json({ message: `Leave request is already ${existing.status.toLowerCase()}` });
        }
        const updated = await config_1.prisma.$transaction(async (tx) => {
            const result = await tx.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status: decision,
                    approvedByUserId: approverId,
                    // Add a remarks column to the Prisma model if remarks must be persisted.
                },
                include: {
                    teacher: { select: { id: true, name: true, email: true, employeeId: true } },
                    approvedByUser: { select: { id: true, name: true, role: true } },
                },
            });
            // When approved, synchronize attendance for each date in the approved range.
            if (decision === "APPROVED") {
                const dates = [];
                let cursor = (0, dayjs_1.default)(existing.fromDate).startOf("day");
                const end = (0, dayjs_1.default)(existing.toDate).startOf("day");
                while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
                    dates.push(cursor.toDate());
                    cursor = cursor.add(1, "day");
                }
                for (const date of dates) {
                    await tx.teacherAttendance.upsert({
                        where: {
                            schoolId_teacherUserId_date: {
                                schoolId,
                                teacherUserId: existing.teacherUserId,
                                date,
                            },
                        },
                        create: {
                            schoolId,
                            teacherUserId: existing.teacherUserId,
                            date,
                            status: "ON_LEAVE",
                            leaveType: (await tx.leaveRequest.findUnique({ where: { id: leaveId }, select: { leaveType: true } })).leaveType,
                            markedByUserId: approverId,
                        },
                        update: {
                            status: "ON_LEAVE",
                            leaveType: (await tx.leaveRequest.findUnique({ where: { id: leaveId }, select: { leaveType: true } })).leaveType,
                            markedByUserId: approverId,
                        },
                    });
                }
            }
            return result;
        });
        return res.status(200).json({ message: `Leave request ${decision.toLowerCase()}`, request: updated });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.decideLeaveRequest = decideLeaveRequest;
