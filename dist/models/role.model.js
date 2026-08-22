"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const types_1 = require("../types");
const models_1 = require("./models");
const roleSchema = new mongoose_1.default.Schema({
    name: String,
    enum: [types_1.Roles.admin, types_1.Roles.superadmin, types_1.Roles.owner],
}, { timestamps: true });
exports.Role = mongoose_1.default.model(models_1.Models.Role, roleSchema);
