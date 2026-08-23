"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const client_1 = require("@prisma/client");
const utils_1 = require("../utils");
/* ============================================================
   VERIFY TOKEN
============================================================ */
const verifyToken = (req, res, next) => {
    try {
        const header = req.headers["x-access-token"];
        const token = typeof header === "string"
            ? header
            : header?.length
                ? header[0]
                : undefined;
        if (!token) {
            return res.status(403).json({
                message: "No auth token provided",
            });
        }
        jsonwebtoken_1.default.verify(token, config_1.authConfig.secret, (err, decoded) => {
            if (err ||
                typeof decoded !== "object" ||
                decoded === null) {
                return res.status(401).json({
                    message: "Unauthorized",
                });
            }
            const payload = decoded;
            if (!payload.id) {
                return res.status(401).json({
                    message: "Invalid auth token",
                });
            }
            /*
             * Keep backward compatibility.
             */
            req.userId = payload.id;
            /*
             * New multi-tenant request context.
             */
            req.user = {
                id: payload.id,
                schoolId: payload.schoolId,
                role: payload.role,
            };
            next();
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   SUPER ADMIN / PLATFORM ADMIN
============================================================ */
/*
 * Platform admins are NOT stored in User.
 *
 * They are stored in:
 *
 *   PlatformAdmin
 *
 * Therefore this middleware must verify against
 * prisma.platformAdmin.
 */
const isSuperAdmin = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const platformAdmin = await config_1.prisma.platformAdmin.findUnique({
            where: {
                id: userId,
            },
        });
        if (!platformAdmin) {
            return res.status(403).json({
                message: "Require superadmin access",
            });
        }
        /*
         * Verify actual PlatformAdmin role.
         */
        if (platformAdmin.role !==
            client_1.PlatformAdminRole.PLATFORM_ADMIN) {
            return res.status(403).json({
                message: "Require superadmin access",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   PRINCIPAL
============================================================ */
const isPrincipal = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        if (user.role !==
            client_1.RoleName.PRINCIPAL) {
            return res.status(403).json({
                message: "Require principal role",
            });
        }
        /*
         * Make sure request context matches
         * the actual database user.
         */
        req.user = {
            id: user.id,
            schoolId: user.schoolId,
            role: user.role,
        };
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   OWNER
============================================================ */
/*
 * New schema has:
 *
 * PRINCIPAL
 * ADMIN
 * TEACHER
 * PARENT
 *
 * There is no OWNER role.
 *
 * Existing routes still reference isOwner,
 * therefore keep this alias for compatibility.
 *
 * OWNER -> PRINCIPAL
 */
const isOwner = isPrincipal;
/* ============================================================
   ADMIN
============================================================ */
/*
 * ADMIN-level operations are allowed for:
 *
 *   PRINCIPAL
 *   ADMIN
 */
const isAdmin = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        if (user.role !== client_1.RoleName.ADMIN &&
            user.role !== client_1.RoleName.PRINCIPAL) {
            return res.status(403).json({
                message: "Require admin role",
            });
        }
        req.user = {
            id: user.id,
            schoolId: user.schoolId,
            role: user.role,
        };
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   TEACHER
============================================================ */
const isTeacher = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        if (user.role !== client_1.RoleName.TEACHER) {
            return res.status(403).json({
                message: "Require teacher role",
            });
        }
        req.user = {
            id: user.id,
            schoolId: user.schoolId,
            role: user.role,
        };
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   PARENT
============================================================ */
const isParent = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        if (user.role !== client_1.RoleName.PARENT) {
            return res.status(403).json({
                message: "Require parent role",
            });
        }
        req.user = {
            id: user.id,
            schoolId: user.schoolId,
            role: user.role,
        };
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   SCHOOL USER
============================================================ */
/*
 * Allows any authenticated school user.
 *
 * PRINCIPAL
 * ADMIN
 * TEACHER
 * PARENT
 */
const isSchoolUser = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const user = await config_1.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                message: "User account is inactive",
            });
        }
        req.user = {
            id: user.id,
            schoolId: user.schoolId,
            role: user.role,
        };
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORTS
============================================================ */
exports.authJwt = {
    verifyToken,
    /*
     * Platform level
     */
    isSuperAdmin,
    /*
     * School level
     */
    isPrincipal,
    isAdmin,
    isTeacher,
    isParent,
    isSchoolUser,
    /*
     * Backward compatibility.
     */
    isOwner,
};
