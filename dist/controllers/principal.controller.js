"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.principalController = void 0;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   AUTHENTICATED SCHOOL
============================================================ */
const getAuthenticatedSchoolId = (req) => {
    return req.user?.schoolId;
};
/* ============================================================
   GET TEACHERS
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */
const getTeachers = async (req, res) => {
    try {
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "Authenticated school is missing",
            });
        }
        const teachers = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                role: client_1.RoleName.TEACHER,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                department: true,
                employeeId: true,
                profilePhotoUrl: true,
                isActive: true,
                mustChangePassword: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                name: "asc",
            },
        });
        return res.status(200).json({
            teachers,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET PARENTS
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */
const getParents = async (req, res) => {
    try {
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "Authenticated school is missing",
            });
        }
        const parents = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                role: client_1.RoleName.PARENT,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                isActive: true,
                mustChangePassword: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                parentLinks: {
                    select: {
                        relationship: true,
                        isPrimary: true,
                        student: {
                            select: {
                                id: true,
                                admissionNo: true,
                                name: true,
                                status: true,
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
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });
        const formattedParents = parents.map((parent) => ({
            id: parent.id,
            name: parent.name,
            email: parent.email,
            phone: parent.phone,
            isActive: parent.isActive,
            mustChangePassword: parent.mustChangePassword,
            lastLogin: parent.lastLogin,
            createdAt: parent.createdAt,
            updatedAt: parent.updatedAt,
            children: parent.parentLinks.map((link) => ({
                id: link.student.id,
                admissionNo: link.student.admissionNo,
                name: link.student.name,
                status: link.student.status,
                relationship: link.relationship,
                isPrimary: link.isPrimary,
                class: link.student.class,
                section: link.student.section,
            })),
        }));
        return res.status(200).json({
            parents: formattedParents,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET ADMINS
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */
const getAdmins = async (req, res) => {
    try {
        const schoolId = getAuthenticatedSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "Authenticated school is missing",
            });
        }
        /* ========================================================
           FIND SCHOOL ADMIN USERS
        ======================================================== */
        const admins = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                role: client_1.RoleName.ADMIN,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                department: true,
                employeeId: true,
                profilePhotoUrl: true,
                isActive: true,
                mustChangePassword: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                name: "asc",
            },
        });
        /* ========================================================
           RESPONSE
        ======================================================== */
        return res.status(200).json({
            admins,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.principalController = {
    getTeachers,
    getParents,
    getAdmins,
};
