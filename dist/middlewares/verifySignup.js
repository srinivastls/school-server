"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignup = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const VALID_ROLES = ["owner", "admin", "superadmin"];
const checkDuplicateEmail = (req, res, next) => {
    config_1.prisma.user
        .findUnique({ where: { email: req.body.email } })
        .then((user) => {
        if (user) {
            return res.status(400).json({ message: "Email ID is already in use!" });
        }
        next();
    })
        .catch((err) => (0, utils_1.handleErr)(err, res));
};
const checkDuplicateAdminId = (req, res, next) => {
    config_1.prisma.user
        .findUnique({ where: { adminId: req.body.adminId } })
        .then((user) => {
        if (user) {
            return res.status(400).json({ message: "Admin ID is already in use!" });
        }
        next();
    })
        .catch((err) => (0, utils_1.handleErr)(err, res));
};
const checkRolesExist = (req, res, next) => {
    if (!req.body.roles) {
        next();
        return;
    }
    for (const role of req.body.roles) {
        if (!VALID_ROLES.includes(role)) {
            res.status(400).json({ message: `ERROR: Role ${role} does not exist` });
            return;
        }
    }
    next();
};
exports.verifySignup = {
    checkDuplicateEmail,
    checkRolesExist,
    checkDuplicateAdminId,
};
