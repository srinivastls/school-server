"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaveControllers = void 0;
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
const parseDate = (value) => {
    if (!value) {
        return null;
    }
    const parsed = (0, dayjs_1.default)(value, "DD/MM/YYYY", true);
    if (!parsed.isValid()) {
        return null;
    }
    return parsed.startOf("day").toDate();
};
/* ============================================================
   CREATE LEAVE REQUEST
============================================================ */
const createLeaveRequest = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const requesterId = req.user?.id;
        if (!schoolId || !requesterId) {
            return res.status(401).json({
                message: "Authenticated user not found",
            });
        }
        const { fromDate, toDate, leaveType, reason, } = req.body;
        /* ------------------------------------------------------
           VALIDATE DATES
        ------------------------------------------------------ */
        const startDate = parseDate(String(fromDate ?? ""));
        const endDate = parseDate(String(toDate ?? ""));
        if (!startDate || !endDate) {
            return res.status(400).json({
                message: "Invalid dates. Use DD/MM/YYYY",
            });
        }
        if ((0, dayjs_1.default)(startDate).isAfter((0, dayjs_1.default)(endDate))) {
            return res.status(400).json({
                message: "From date cannot be after to date",
            });
        }
        /* ------------------------------------------------------
           VALIDATE LEAVE TYPE
        ------------------------------------------------------ */
        const validLeaveTypes = [
            "CL",
            "SL",
            "EL",
            "LWP",
        ];
        if (!validLeaveTypes.includes(leaveType)) {
            return res.status(400).json({
                message: "Invalid leave type",
            });
        }
        /* ------------------------------------------------------
           CHECK USER
        ------------------------------------------------------ */
        const user = await config_1.prisma.user.findFirst({
            where: {
                id: requesterId,
                schoolId,
                isActive: true,
            },
            select: {
                id: true,
                role: true,
            },
        });
        if (!user) {
            return res.status(403).json({
                message: "User is not authorized",
            });
        }
        /* ------------------------------------------------------
           CHECK EXISTING PENDING LEAVE
        ------------------------------------------------------ */
        const existing = await config_1.prisma.leaveRequest.findFirst({
            where: {
                schoolId,
                teacherUserId: requesterId,
                status: "PENDING",
                OR: [
                    {
                        fromDate: {
                            lte: endDate,
                        },
                        toDate: {
                            gte: startDate,
                        },
                    },
                ],
            },
        });
        if (existing) {
            return res.status(409).json({
                message: "You already have a pending leave request for these dates",
            });
        }
        /* ------------------------------------------------------
           CREATE
        ------------------------------------------------------ */
        const leave = await config_1.prisma.leaveRequest.create({
            data: {
                schoolId,
                teacherUserId: requesterId,
                fromDate: startDate,
                toDate: endDate,
                leaveType,
                reason: reason?.trim() ||
                    null,
                status: "PENDING",
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeId: true,
                        role: true,
                    },
                },
            },
        });
        return res.status(201).json({
            message: "Leave request submitted successfully",
            leave,
        });
    }
    catch (error) {
        console.error("CREATE LEAVE REQUEST ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET MY LEAVE REQUESTS
============================================================ */
const getMyLeaveRequests = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const requesterId = req.user?.id;
        if (!schoolId || !requesterId) {
            return res.status(401).json({
                message: "Authenticated user not found",
            });
        }
        const leaves = await config_1.prisma.leaveRequest.findMany({
            where: {
                schoolId,
                teacherUserId: requesterId,
            },
            include: {
                approvedByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: {
                appliedAt: "desc",
            },
        });
        return res.status(200).json({
            leaves,
        });
    }
    catch (error) {
        console.error("GET MY LEAVE REQUESTS ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET PENDING LEAVE REQUESTS
============================================================ */
const getPendingLeaveRequests = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const leaves = await config_1.prisma.leaveRequest.findMany({
            where: {
                schoolId,
                status: "PENDING",
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        employeeId: true,
                        designation: true,
                        department: true,
                        role: true,
                    },
                },
            },
            orderBy: [
                {
                    appliedAt: "asc",
                },
            ],
        });
        return res.status(200).json({
            total: leaves.length,
            leaves,
        });
    }
    catch (error) {
        console.error("GET PENDING LEAVE REQUESTS ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   APPROVE / REJECT LEAVE
============================================================ */
const updateLeaveRequest = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const approverId = req.user?.id;
        if (!schoolId || !approverId) {
            return res.status(401).json({
                message: "Authenticated user not found",
            });
        }
        const { id, status, } = req.body;
        if (!id) {
            return res.status(400).json({
                message: "Leave request id is required",
            });
        }
        if (status !== "APPROVED" &&
            status !== "REJECTED") {
            return res.status(400).json({
                message: "Status must be APPROVED or REJECTED",
            });
        }
        /* ------------------------------------------------------
           VERIFY APPROVER
        ------------------------------------------------------ */
        const approver = await config_1.prisma.user.findFirst({
            where: {
                id: approverId,
                schoolId,
                isActive: true,
                role: {
                    in: [
                        "ADMIN",
                        "PRINCIPAL",
                    ],
                },
            },
            select: {
                id: true,
                role: true,
            },
        });
        if (!approver) {
            return res.status(403).json({
                message: "You are not authorized to approve leave requests",
            });
        }
        /* ------------------------------------------------------
           FIND REQUEST
        ------------------------------------------------------ */
        const leave = await config_1.prisma.leaveRequest.findFirst({
            where: {
                id,
                schoolId,
            },
        });
        if (!leave) {
            return res.status(404).json({
                message: "Leave request not found",
            });
        }
        if (leave.status !==
            "PENDING") {
            return res.status(409).json({
                message: "This leave request has already been processed",
            });
        }
        /* ------------------------------------------------------
           UPDATE
        ------------------------------------------------------ */
        const updated = await config_1.prisma.leaveRequest.update({
            where: {
                id: leave.id,
            },
            data: {
                status,
                approvedByUserId: approverId,
                updatedAt: new Date(),
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeId: true,
                        role: true,
                    },
                },
                approvedByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
        });
        /* ======================================================
           AUTOMATICALLY CREATE TEACHER ATTENDANCE
           
           Only when leave is APPROVED.
        ====================================================== */
        if (status === "APPROVED" &&
            leave.teacherUserId) {
            const requester = await config_1.prisma.user.findFirst({
                where: {
                    id: leave.teacherUserId,
                    schoolId,
                    role: "TEACHER",
                },
                select: {
                    id: true,
                },
            });
            if (requester) {
                let current = (0, dayjs_1.default)(leave.fromDate);
                const end = (0, dayjs_1.default)(leave.toDate);
                while (current.isSame(end, "day")) {
                    await config_1.prisma.teacherAttendance.upsert({
                        where: {
                            schoolId_teacherUserId_date: {
                                schoolId,
                                teacherUserId: requester.id,
                                date: current
                                    .startOf("day")
                                    .toDate(),
                            },
                        },
                        create: {
                            schoolId,
                            teacherUserId: requester.id,
                            date: current
                                .startOf("day")
                                .toDate(),
                            status: "ON_LEAVE",
                            leaveType: leave.leaveType,
                            markedByUserId: approverId,
                        },
                        update: {
                            status: "ON_LEAVE",
                            leaveType: leave.leaveType,
                            markedByUserId: approverId,
                        },
                    });
                    current =
                        current.add(1, "day");
                }
            }
        }
        return res.status(200).json({
            message: status === "APPROVED"
                ? "Leave approved successfully"
                : "Leave rejected successfully",
            leave: updated,
        });
    }
    catch (error) {
        console.error("UPDATE LEAVE REQUEST ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET LEAVE HISTORY
============================================================ */
const getLeaveHistory = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { status, leaveType, requesterId, from, to, } = req.query;
        const where = {
            schoolId,
        };
        if (status) {
            where.status =
                String(status);
        }
        if (leaveType) {
            where.leaveType =
                String(leaveType);
        }
        if (requesterId) {
            where.requesterId =
                String(requesterId);
        }
        if (from && to) {
            const range = parseDateRange(String(from), String(to));
            if (!range) {
                return res.status(400).json({
                    message: "Invalid date range",
                });
            }
            where.fromDate = {
                lte: range.lte,
            };
            where.toDate = {
                gte: range.gte,
            };
        }
        const leaves = await config_1.prisma.leaveRequest.findMany({
            where,
            include: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeId: true,
                        designation: true,
                        department: true,
                        role: true,
                    },
                },
                approvedByUser: {
                    select: {
                        id: true,
                        name: true,
                        role: true,
                    },
                },
            },
            orderBy: {
                fromDate: "desc",
            },
        });
        return res.status(200).json({
            total: leaves.length,
            leaves,
        });
    }
    catch (error) {
        console.error("GET LEAVE HISTORY ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   DATE RANGE HELPER
============================================================ */
const parseDateRange = (from, to) => {
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    if (!fromDate || !toDate) {
        return null;
    }
    if ((0, dayjs_1.default)(fromDate).isAfter((0, dayjs_1.default)(toDate))) {
        return null;
    }
    return {
        gte: fromDate,
        lte: (0, dayjs_1.default)(toDate)
            .endOf("day")
            .toDate(),
    };
};
/* ============================================================
   EXPORT
============================================================ */
exports.leaveControllers = {
    createLeaveRequest,
    getMyLeaveRequests,
    getPendingLeaveRequests,
    updateLeaveRequest,
    getLeaveHistory,
};
