"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const types_1 = require("../types");
const models_1 = require("./models");
const transactionSchema = new mongoose_1.default.Schema({
    date: { type: String, required: true },
    student: { type: mongoose_1.default.Schema.Types.ObjectId, ref: models_1.Models.Student },
    amount: { type: String, required: true },
    amountDetails: {
        tie: { type: String, required: true },
        diary: { type: String, required: true },
        belt: { type: String, required: true },
        arrears: { type: String, required: true },
        tuitionFee: {
            type: String,
            required: true,
        },
        textBookFee: {
            type: String,
            required: true,
        },
        noteBookFee: {
            type: String,
            required: true,
        },
    },
    pendingAmount: { type: String, required: true },
    paymentMode: {
        type: String,
        required: true,
        enum: [types_1.PaymentMode.cash, types_1.PaymentMode.wallet],
    },
    transactionId: { type: String, required: false },
    classNumber: { type: String, required: true },
    adminId: { type: String, required: true },
}, { timestamps: true });
exports.Transaction = mongoose_1.default.model(models_1.Models.Transaction, transactionSchema);
