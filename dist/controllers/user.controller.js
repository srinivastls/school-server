"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getAllUsers = async (req, res) => {
    try {
        const users = await config_1.prisma.user.findMany({
            include: {
                roles: true,
            },
        });
        const usersList = users.map((user) => ({
            name: user.name,
            designation: user.designation,
            adminId: user.adminId,
            email: user.email,
            roles: user.roles.map((role) => role.name),
        }));
        return res.status(200).json({ users: usersList });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.userController = { getAllUsers };
