"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Class = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("./models");
const classSchema = new mongoose_1.default.Schema({
    classNumber: {
        type: String,
        required: true,
    },
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
    diary: {
        type: String,
        required: true,
    },
    year: {
        type: String,
        required: true,
    },
}, { timestamps: true });
exports.Class = mongoose_1.default.model(models_1.Models.Class, classSchema);
