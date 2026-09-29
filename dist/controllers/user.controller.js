"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getAllUsers = async (req, res) => {
    try {
        const users = await config_1.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                designation: true,
                role: true,
                schoolId: true,
            },
        });
        const usersList = users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            designation: user.designation,
            role: user.role,
            schoolId: user.schoolId,
        }));
        return res.status(200).json({
            users: usersList,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const getProfile = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(400).json({
                message: "Authenticated user is missing",
            });
        }
        console.log("PROFILE userId:", userId);
        const user = await config_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
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
        });
        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }
        return res.status(200).json({
            profile: user,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const getPlatformAdminProfile = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(400).json({
                message: "Authenticated user is missing",
            });
        }
        console.log("PLATFORM ADMIN PROFILE userId:", userId);
        const platformAdmin = await config_1.prisma.platformAdmin.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!platformAdmin) {
            return res.status(404).json({
                message: "Platform admin not found",
            });
        }
        return res.status(200).json({
            profile: {
                id: platformAdmin.id,
                schoolId: "",
                name: platformAdmin.name,
                email: platformAdmin.email,
                phone: null,
                role: platformAdmin.role,
                designation: "Platform Admin",
                department: null,
                employeeId: null,
                profilePhotoUrl: null,
                isActive: platformAdmin.isActive,
                mustChangePassword: false,
                lastLogin: platformAdmin.lastLogin,
                createdAt: platformAdmin.createdAt,
                updatedAt: platformAdmin.updatedAt,
            },
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const updatePrincipal = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(400).json({
                message: "Authenticated user is missing",
            });
        }
        const { name, email, phone, designation, department, employeeId } = req.body;
        const principal = await config_1.prisma.user.update({
            where: { id: userId },
            data: {
                name: name?.trim() || null,
                email: email?.trim().toLowerCase() || null,
                phone: phone?.trim() || null,
                designation: designation?.trim() || null,
                department: department?.trim() || null,
                employeeId: employeeId?.trim() || null,
            },
        });
        return res.status(200).json({
            message: "Principal updated successfully",
            principal,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.userController = {
    getAllUsers,
    getProfile,
    getPlatformAdminProfile,
    updatePrincipal,
};
