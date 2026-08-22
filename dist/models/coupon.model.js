"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Coupon = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const types_1 = require("../types");
const models_1 = require("./models");
const couponSchema = new mongoose_1.default.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
    },
    classNumber: { type: mongoose_1.default.Schema.Types.ObjectId, ref: models_1.Models.Class },
    discount: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: [types_1.CouponStatus.ACTIVE, types_1.CouponStatus.APPLIED],
    },
    createdAt: {
        type: String,
        required: true,
    },
}, { timestamps: true });
exports.Coupon = mongoose_1.default.model(models_1.Models.Coupon, couponSchema);
