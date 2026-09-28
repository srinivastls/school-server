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
exports.userController = {
    getAllUsers,
    getProfile,
};
