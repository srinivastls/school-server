"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const config_1 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
const signup = async (req, res) => {
    try {
        const { name, email, password, roles, designation, adminId } = req.body;
        if (!name || !email || !password || !designation || !adminId) {
            return res
                .status(400)
                .json({ message: "Some fields are missing in request body" });
        }
        // Find requested roles, or use admin by default
        let roleRecords;
        if (roles && roles.length > 0) {
            roleRecords = await config_1.prisma.role.findMany({
                where: {
                    name: {
                        in: roles,
                    },
                },
            });
        }
        else {
            roleRecords = await config_1.prisma.role.findMany({
                where: {
                    name: types_1.Roles.admin,
                },
            });
        }
        if (roleRecords.length === 0) {
            return res.status(400).json({
                message: "Role not found. Please create roles first.",
            });
        }
        await config_1.prisma.user.create({
            data: {
                name,
                email,
                designation,
                adminId,
                password: bcrypt_1.default.hashSync(password, 8),
                roles: {
                    connect: roleRecords.map((role) => ({
                        id: role.id,
                    })),
                },
            },
        });
        return res.json({
            message: "User created successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const signin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await config_1.prisma.user.findUnique({
            where: {
                email,
            },
            include: {
                roles: true,
            },
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found!",
            });
        }
        const isPasswordValid = bcrypt_1.default.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Password incorrect",
            });
        }
        const isSuperAdmin = user.roles.some((role) => role.name === types_1.Roles.superadmin);
        const token = jsonwebtoken_1.default.sign({ id: user.id }, config_1.authConfig.secret, {
            expiresIn: 86400,
        });
        const ttl = isSuperAdmin ? 86400 : 0;
        return res.status(200).json({
            id: user.id,
            accessToken: token,
            accessTokenTTL: ttl,
            name: user.name,
            email: user.email,
            roles: user.roles.map((role) => role.name),
            designation: user.designation,
            adminId: user.adminId,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const deleteUser = async (req, res) => {
    try {
        if (!req.body.email) {
            return res.status(400).json({
                message: "Email field missing in request body",
            });
        }
        await config_1.prisma.user.delete({
            where: {
                email: req.body.email,
            },
        });
        return res.status(200).json({
            message: "User deleted successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const createSuperAdmin = async (req, res) => {
    try {
        const { name, email, password, designation, adminId } = req.body;
        if (!name || !email || !password || !designation || !adminId) {
            return res
                .status(400)
                .json({ message: "Some fields are missing in request body" });
        }
        const superAdminRole = await config_1.prisma.role.findUnique({
            where: {
                name: types_1.Roles.superadmin,
            },
        });
        if (!superAdminRole) {
            return res.status(400).json({
                message: "Superadmin role not found. Please create it first.",
            });
        }
        await config_1.prisma.user.create({
            data: {
                name,
                email,
                password: bcrypt_1.default.hashSync(password, 8),
                designation,
                adminId,
                roles: {
                    connect: {
                        id: superAdminRole.id,
                    },
                },
            },
        });
        return res.json({
            message: "User created successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.authController = {
    signin,
    signup,
    delete: deleteUser,
    createSuperAdmin,
};
