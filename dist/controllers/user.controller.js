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
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield config_1.prisma.user.findMany({
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
});
exports.userController = { getAllUsers };
