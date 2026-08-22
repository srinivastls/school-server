"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const config_2 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
const verifyToken = (req, res, next) => {
    const header = req.headers["x-access-token"];
    const token = typeof header === "string"
        ? header
        : (header === null || header === void 0 ? void 0 : header.length)
            ? header[0]
            : undefined;
    if (!token) {
        return res.status(403).json({ message: "No auth token provided" });
    }
    jsonwebtoken_1.default.verify(token, config_1.authConfig.secret, (err, decoded) => {
        if (err || typeof decoded !== "object") {
            return res.status(401).json({ message: "Unauthorized" });
        }
        //@ts-ignore
        req.userId = decoded.id;
        next();
    });
};
const isSuperAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        //@ts-ignore
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = yield config_2.prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true },
        });
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const hasRole = user.roles.some((role) => role.name === types_1.Roles.superadmin);
        if (!hasRole) {
            return res.status(403).json({ message: "Require superadmin role" });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
});
const isOwner = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        //@ts-ignore
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = yield config_2.prisma.user.findUnique({
            where: { id: userId },
            include: { roles: true },
        });
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const hasRole = user.roles.some((role) => role.name === types_1.Roles.owner);
        if (!hasRole) {
            return res.status(403).json({ message: "Require owner role" });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
});
exports.authJwt = { verifyToken, isSuperAdmin, isOwner };
