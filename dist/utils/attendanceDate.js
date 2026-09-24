"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAttendanceDate = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
dayjs_1.default.extend(customParseFormat_1.default);
const parseAttendanceDate = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }
    const input = value.trim();
    const acceptedFormats = [
        "YYYY-MM-DD",
        "DD/MM/YYYY",
    ];
    const parsed = (0, dayjs_1.default)(input, acceptedFormats, true);
    if (!parsed.isValid()) {
        return null;
    }
    return parsed.startOf("day").toDate();
};
exports.parseAttendanceDate = parseAttendanceDate;
