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
                console.log("JWT verification error:", token, err);
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
             * Backward compatibility.
             */
            req.userId =
                payload.id;
            /*
             * Store complete authentication
             * context.
             */
            req.user = {
                id: payload.id,
                schoolId: payload.schoolId,
                schoolCode: payload.schoolCode,
                role: payload.role,
                type: payload.type,
            };
            next();
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   PLATFORM ADMIN
============================================================ */
const isSuperAdmin = async (req, res, next) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        if (req.user?.type !== "PLATFORM_ADMIN") {
            return res.status(403).json({
                message: "Invalid platform authentication",
            });
        }
        const platformAdmin = await config_1.prisma.platformAdmin.findUnique({
            where: {
                id: userId,
            },
        });
        if (!platformAdmin) {
            return res.status(403).json({
                message: "Require platform admin access",
            });
        }
        if (!platformAdmin.isActive) {
            return res.status(403).json({
                message: "Platform admin account is inactive",
            });
        }
        if (platformAdmin.role !==
            client_1.PlatformAdminRole.PLATFORM_ADMIN) {
            return res.status(403).json({
                message: "Require platform admin access",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   LOAD SCHOOL USER
============================================================ */
const getAuthenticatedSchoolUser = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({
            message: "Unauthorized ser ",
        });
        return null;
    }
    const user = await config_1.prisma.user.findUnique({
        where: {
            id: userId,
        },
    });
    if (!user) {
        res.status(401).json({
            message: "Unauthorized",
        });
        return null;
    }
    if (!user.isActive) {
        res.status(403).json({
            message: "User account is inactive",
        });
        return null;
    }
    /*
     * The school from the database is
     * the authoritative tenant.
     */
    req.user = {
        id: user.id,
        schoolId: user.schoolId,
        schoolCode: req.user?.schoolCode,
        role: user.role,
        type: "SCHOOL_USER",
    };
    return user;
};
/* ============================================================
   PRINCIPAL
============================================================ */
const isPrincipal = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user) {
            return;
        }
        if (user.role !==
            client_1.RoleName.PRINCIPAL) {
            return res.status(403).json({
                message: "Require principal role",
            });
        }
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
 * Old application used OWNER.
 *
 * New schema uses PRINCIPAL.
 *
 * Keep alias so existing routes
 * don't immediately break.
 */
const isOwner = isPrincipal;
/* ============================================================
   ADMIN
============================================================ */
const isAdmin = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user) {
            return;
        }
        /*
         * Principal has all admin permissions.
         */
        if (user.role !==
            client_1.RoleName.ADMIN &&
            user.role !==
                client_1.RoleName.PRINCIPAL) {
            return res.status(403).json({
                message: "Require admin role",
            });
        }
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
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user) {
            return;
        }
        if (user.role !==
            client_1.RoleName.TEACHER) {
            return res.status(403).json({
                message: "Require teacher role",
            });
        }
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
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user) {
            return;
        }
        if (user.role !==
            client_1.RoleName.PARENT) {
            return res.status(403).json({
                message: "Require parent role",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   SCHOOL USER
============================================================ */
const isSchoolUser = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user) {
            return;
        }
        /*
         * Ensure this is not a platform
         * administrator token.
         */
        if (req.user?.type ===
            "PLATFORM_ADMIN") {
            return res.status(403).json({
                message: "School user authentication required",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.authJwt = {
    verifyToken,
    /* Platform */
    isSuperAdmin,
    /* School */
    isSchoolUser,
    isPrincipal,
    isAdmin,
    isTeacher,
    isParent,
    /* Compatibility */
    isOwner,
};
