"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classMiddleWares = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const checkDuplicateClass = (req, res, next) => {
    config_1.prisma.class
        .findUnique({ where: { classNumber: req.body.classNumber } })
        .then((oldClass) => {
        if (oldClass) {
            return res.status(400).json({ message: "Class already exists" });
        }
        next();
    })
        .catch((err) => (0, utils_1.handleErr)(err, res));
};
const checkClassExists = (req, res, next) => {
    config_1.prisma.class
        .findUnique({ where: { classNumber: req.body.classNumber } })
        .then((oldClass) => {
        if (!oldClass) {
            return res.status(400).json({ message: "Class doesn't exist" });
        }
        next();
    })
        .catch((err) => (0, utils_1.handleErr)(err, res));
};
exports.classMiddleWares = { checkDuplicateClass, checkClassExists };
