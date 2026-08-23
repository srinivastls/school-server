"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignup = void 0;
const config_1 = require("../config");
const client_1 = require("@prisma/client");
const utils_1 = require("../utils");
/* ============================================================
   CHECK DUPLICATE EMAIL
   ------------------------------------------------------------
   Email is unique PER SCHOOL in the new multi-tenant schema.
============================================================ */
const checkDuplicateEmail = async (req, res, next) => {
    try {
        const { email, schoolId, } = req.body;
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                schoolId_email: {
                    schoolId,
                    email,
                },
            },
        });
        if (user) {
            return res.status(400).json({
                message: "Email ID is already in use in this school!",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   CHECK SCHOOL EXISTS
============================================================ */
const checkSchoolExists = async (req, res, next) => {
    try {
        const { schoolId } = req.body;
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const school = await config_1.prisma.school.findUnique({
            where: {
                id: schoolId,
            },
        });
        if (!school) {
            return res.status(404).json({
                message: "School not found",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   CHECK ROLE
   ------------------------------------------------------------
   New roles:
     PRINCIPAL
     ADMIN
     TEACHER
     PARENT
============================================================ */
const checkRole = (req, res, next) => {
    const role = req.body.role;
    /* ----------------------------------------------------------
       Role is optional because auth.controller.ts defaults
       missing role to ADMIN.
    ---------------------------------------------------------- */
    if (!role) {
        next();
        return;
    }
    if (!Object.values(client_1.RoleName).includes(role)) {
        return res.status(400).json({
            message: `Invalid role: ${role}. ` +
                `Allowed roles: ${Object.values(client_1.RoleName).join(", ")}`,
        });
    }
    next();
};
/* ============================================================
   EXPORT
============================================================ */
exports.verifySignup = {
    checkDuplicateEmail,
    checkSchoolExists,
    checkRole,
};
