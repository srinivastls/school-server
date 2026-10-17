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
                code: "TOKEN_MISSING",
            });
        }
        jsonwebtoken_1.default.verify(token, config_1.authConfig.secret, (err, decoded) => {
            if (err) {
                // This is the important distinction for automatic refresh.
                if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
                    return res.status(401).json({
                        message: "Access token expired",
                        code: "TOKEN_EXPIRED",
                    });
                }
                console.error("JWT verification error:", err.name, err.message);
                return res.status(401).json({
                    message: "Invalid access token",
                    code: "INVALID_TOKEN",
                });
            }
            if (typeof decoded !== "object" ||
                decoded === null) {
                return res.status(401).json({
                    message: "Invalid access token",
                    code: "INVALID_TOKEN",
                });
            }
            const payload = decoded;
            if (!payload.id) {
                return res.status(401).json({
                    message: "Invalid auth token",
                    code: "INVALID_TOKEN",
                });
            }
            req.userId = payload.id;
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
            where: { id: userId },
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
const getAuthenticatedSchoolUser = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        res.status(401).json({
            message: "Unauthorized",
        });
        return null;
    }
    const user = await config_1.prisma.user.findUnique({
        where: { id: userId },
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
    req.user = {
        id: user.id,
        schoolId: user.schoolId,
        schoolCode: req.user?.schoolCode,
        role: user.role,
        type: "SCHOOL_USER",
    };
    return user;
};
const isPrincipal = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user)
            return;
        if (user.role !== client_1.RoleName.PRINCIPAL) {
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
const isPrincipalOrAdmin = (req, res, next) => {
    const role = req.user?.role;
    if (role !== client_1.RoleName.PRINCIPAL &&
        role !== client_1.RoleName.ADMIN) {
        return res.status(403).json({
            message: "Access denied. Principal or Admin role required.",
        });
    }
    next();
};
const isOwner = isPrincipal;
const isAdmin = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user)
            return;
        if (user.role !== client_1.RoleName.ADMIN &&
            user.role !== client_1.RoleName.PRINCIPAL) {
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
const isTeacher = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user)
            return;
        if (user.role !== client_1.RoleName.TEACHER) {
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
const isParent = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user)
            return;
        if (user.role !== client_1.RoleName.PARENT) {
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
const isSchoolUser = async (req, res, next) => {
    try {
        const user = await getAuthenticatedSchoolUser(req, res);
        if (!user)
            return;
        if (req.user?.type === "PLATFORM_ADMIN") {
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
exports.authJwt = {
    verifyToken,
    isSuperAdmin,
    isSchoolUser,
    isPrincipal,
    isAdmin,
    isTeacher,
    isParent,
    isPrincipalOrAdmin,
    isOwner,
};
