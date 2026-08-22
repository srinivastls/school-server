"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const class_model_1 = require("./class.model");
const coupon_model_1 = require("./coupon.model");
const role_model_1 = require("./role.model");
const student_model_1 = require("./student.model");
const transaction_model_1 = require("./transaction.model");
const user_model_1 = require("./user.model");
mongoose_1.default.Promise = global.Promise;
const db = {
    mongoose: mongoose_1.default,
    user: user_model_1.User,
    role: role_model_1.Role,
    class: class_model_1.Class,
    coupon: coupon_model_1.Coupon,
    student: student_model_1.Student,
    transaction: transaction_model_1.Transaction,
    ROLES: ["admin", "superadmin"],
};
exports.db = db;
