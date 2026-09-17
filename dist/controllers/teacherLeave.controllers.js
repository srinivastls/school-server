"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelLeaveRequest = exports.applyForLeave = exports.getMyLeaveRequests = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const VALID_LEAVE_TYPES = [
    "CL",
    "SL",
    "EL",
    "LWP",
];
const parseDateOnly = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    /*
     * Accept YYYY-MM-DD.
     */
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) {
        return null;
    }
    return date;
};
/**
 * GET /api/v1/teacher-leave/my-leaves
 */
const getMyLeaveRequests = async (req, res) => {
    try {
        const teacherUserId = req.user?.id;
        const schoolId = req.user?.schoolId;
        if (!teacherUserId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!schoolId) {
            return res.status(400).json({
                message: "School information is missing",
            });
        }
        const status = typeof req.query.status === "string"
            ? req.query.status
            : undefined;
        const where = {
            schoolId,
            teacherUserId,
        };
        if (status) {
            if (![
                "PENDING",
                "APPROVED",
                "REJECTED",
            ].includes(status)) {
                return res.status(400).json({
                    message: "Invalid leave status",
                });
            }
            where.status = status;
        }
        const requests = await config_1.prisma.leaveRequest.findMany({
            where,
            orderBy: {
                appliedAt: "desc",
            },
            select: {
                id: true,
                fromDate: true,
                toDate: true,
                leaveType: true,
                reason: true,
                status: true,
                appliedAt: true,
                updatedAt: true,
                approvedByUserId: true,
                approvedByUser: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        const summary = {
            total: requests.length,
            pending: 0,
            approved: 0,
            rejected: 0,
        };
        requests.forEach((request) => {
            switch (request.status) {
                case "PENDING":
                    summary.pending++;
                    break;
                case "APPROVED":
                    summary.approved++;
                    break;
                case "REJECTED":
                    summary.rejected++;
                    break;
            }
        });
        return res.status(200).json({
            summary,
            totalRequests: requests.length,
            requests,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getMyLeaveRequests = getMyLeaveRequests;
/**
 * POST /api/v1/teacher-leave
 *
 * Body:
 * {
 *   fromDate: "2026-09-20",
 *   toDate: "2026-09-22",
 *   leaveType: "CL",
 *   reason: "Personal work"
 * }
 */
const applyForLeave = async (req, res) => {
    try {
        const teacherUserId = req.user?.id;
        const schoolId = req.user?.schoolId;
        if (!teacherUserId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!schoolId) {
            return res.status(400).json({
                message: "School information is missing",
            });
        }
        const { fromDate, toDate, leaveType, reason, } = req.body || {};
        if (typeof fromDate !== "string" ||
            typeof toDate !== "string") {
            return res.status(400).json({
                message: "fromDate and toDate are required",
            });
        }
        const startDate = parseDateOnly(fromDate);
        const endDate = parseDateOnly(toDate);
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: "Dates must be valid and use YYYY-MM-DD format",
            });
        }
        if (endDate < startDate) {
            return res.status(400).json({
                message: "toDate cannot be before fromDate",
            });
        }
        if (typeof leaveType !== "string" ||
            !VALID_LEAVE_TYPES.includes(leaveType)) {
            return res.status(400).json({
                message: "Invalid leave type",
            });
        }
        if (typeof reason !== "string" ||
            !reason.trim()) {
            return res.status(400).json({
                message: "Leave reason is required",
            });
        }
        if (reason.trim().length > 1000) {
            return res.status(400).json({
                message: "Leave reason cannot exceed 1000 characters",
            });
        }
        /**
         * Current academic year.
         */
        const academicYear = await config_1.prisma.academicYear.findFirst({
            where: {
                schoolId,
                isCurrent: true,
            },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
            },
        });
        if (!academicYear) {
            return res.status(404).json({
                message: "Current academic year not found",
            });
        }
        /**
         * Leave must fall inside the academic year.
         */
        if (startDate < academicYear.startDate ||
            endDate > academicYear.endDate) {
            return res.status(400).json({
                message: "Leave dates must fall within the current academic year",
            });
        }
        /**
         * Don't allow another pending/approved
         * request for an overlapping period.
         */
        const overlapping = await config_1.prisma.leaveRequest.findFirst({
            where: {
                schoolId,
                teacherUserId,
                status: {
                    in: ["PENDING", "APPROVED"],
                },
                fromDate: {
                    lte: endDate,
                },
                toDate: {
                    gte: startDate,
                },
            },
            select: {
                id: true,
                fromDate: true,
                toDate: true,
                status: true,
            },
        });
        if (overlapping) {
            return res.status(409).json({
                message: "You already have a pending or approved leave request overlapping these dates.",
                existingRequest: overlapping,
            });
        }
        const leaveRequest = await config_1.prisma.leaveRequest.create({
            data: {
                schoolId,
                teacherUserId,
                fromDate: startDate,
                toDate: endDate,
                leaveType: leaveType,
                reason: reason.trim(),
            },
            select: {
                id: true,
                fromDate: true,
                toDate: true,
                leaveType: true,
                reason: true,
                status: true,
                appliedAt: true,
                updatedAt: true,
            },
        });
        return res.status(201).json({
            message: "Leave request submitted successfully",
            leaveRequest,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.applyForLeave = applyForLeave;
/**
 * DELETE /api/v1/teacher-leave/:id
 *
 * Only PENDING requests can be cancelled.
 */
const cancelLeaveRequest = async (req, res) => {
    try {
        const teacherUserId = req.user?.id;
        const schoolId = req.user?.schoolId;
        const leaveId = req.params.id;
        if (!teacherUserId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!schoolId) {
            return res.status(400).json({
                message: "School information is missing",
            });
        }
        if (!leaveId) {
            return res.status(400).json({
                message: "Leave request ID is required",
            });
        }
        const request = await config_1.prisma.leaveRequest.findFirst({
            where: {
                id: leaveId,
                schoolId,
                teacherUserId,
            },
        });
        if (!request) {
            return res.status(404).json({
                message: "Leave request not found",
            });
        }
        if (request.status !== "PENDING") {
            return res.status(400).json({
                message: "Only pending leave requests can be cancelled",
            });
        }
        await config_1.prisma.leaveRequest.delete({
            where: {
                id: request.id,
            },
        });
        return res.status(200).json({
            message: "Leave request cancelled successfully",
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.cancelLeaveRequest = cancelLeaveRequest;
