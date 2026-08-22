"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("./models");
const Schema = mongoose_1.default.Schema;
const userSchema = new Schema({
    name: {
        type: String,
        required: [true, "Name not provided"],
    },
    email: {
        type: String,
        unique: [true, "Email already exists."],
        // lowercase: true,
        // trim: true,
        validate: {
            validator: function (v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: "{VALUE} is not a valid email!",
        },
    },
    roles: [
        {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: models_1.Models.Role,
        },
    ],
    password: {
        type: String,
        required: true,
    },
    designation: {
        type: String,
        required: true,
    },
    adminId: {
        type: String,
        required: true,
    },
}, { timestamps: true });
exports.User = mongoose_1.default.model(models_1.Models.User, userSchema);
