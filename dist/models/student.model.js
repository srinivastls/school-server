"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Student = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("./models");
const studentSchema = new mongoose_1.default.Schema({
    admissionNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    aadhaar: { type: String, required: true, unique: true },
    fatherName: { type: String, required: true },
    dob: { type: String, required: true },
    doj: { type: String, required: true },
    phoneNo: { type: String, required: true },
    classNumber: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: models_1.Models.Class,
        required: true,
    },
    tie: {
        amount: { type: String, required: true },
        pendingAmount: { type: String, required: true },
    },
    belt: {
        amount: { type: String, required: true },
        pendingAmount: { type: String, required: true },
    },
    arrears: {
        amount: { type: String, required: true },
        pendingAmount: { type: String, required: true },
    },
    pendingTuitionFee: { type: String, required: true },
    pendingTextbookFee: { type: String, required: true },
    pendingNotebookFee: { type: String, required: true },
    pendingDiaryAmount: { type: String, required: true },
    pendingAmount: { type: String, required: true },
    couponCode: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: models_1.Models.Coupon,
    },
    tcNo: { type: String },
    adminId: { type: String, required: true },
    siblings: [
        {
            admissionNo: { type: String, required: true },
            name: { type: String, required: true },
        },
    ],
}, { timestamps: true });
exports.Student = mongoose_1.default.model(models_1.Models.Student, studentSchema);
