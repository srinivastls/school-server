"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRows = exports.requiredFields = exports.parseTabularBuffer = void 0;
const xlsx_1 = __importDefault(require("xlsx"));
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10000;
const normaliseHeader = (value) => String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
const parseTabularBuffer = (buffer, filename) => {
    if (buffer.length > MAX_FILE_BYTES)
        throw new Error("File exceeds the 10 MB limit");
    const workbook = xlsx_1.default.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
        throw new Error("The workbook has no worksheet");
    const sheet = workbook.Sheets[sheetName];
    const raw = xlsx_1.default.utils.sheet_to_json(sheet, { defval: "" });
    if (raw.length > MAX_ROWS)
        throw new Error(`Maximum ${MAX_ROWS} data rows are allowed`);
    return raw.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normaliseHeader(key), String(value ?? "").trim()])));
};
exports.parseTabularBuffer = parseTabularBuffer;
exports.requiredFields = {
    students: ["admission_no", "name", "class_number", "section_name", "father_name", "dob", "doj"],
    teachers: ["name", "email"],
    parents: ["name", "email", "student_admission_no", "relationship"],
    transactions: ["receipt_number", "student_admission_no", "date", "amount", "payment_mode", "class_number"],
};
const validateRows = (module, rows) => {
    const required = exports.requiredFields[module];
    const seen = new Set();
    const errors = [];
    rows.forEach((row, index) => {
        for (const field of required) {
            if (!row[field])
                errors.push({ row: index + 2, field, message: `Missing required field: ${field}` });
        }
        const duplicateKey = row[module === "students" ? "admission_no" : module === "transactions" ? "receipt_number" : "email"];
        if (duplicateKey) {
            const key = duplicateKey.toLowerCase();
            if (seen.has(key))
                errors.push({ row: index + 2, message: "Duplicate key inside upload" });
            seen.add(key);
        }
        if (module === "transactions" && row.amount && (!/^\d+(\.\d{1,2})?$/.test(row.amount) || Number(row.amount) <= 0)) {
            errors.push({ row: index + 2, field: "amount", message: "Amount must be a positive number" });
        }
        if (module === "transactions" && row.payment_mode && !["CASH", "WALLET", "ONLINE"].includes(row.payment_mode.toUpperCase())) {
            errors.push({ row: index + 2, field: "payment_mode", message: "Payment mode must be CASH, WALLET, or ONLINE" });
        }
    });
    return { totalRows: rows.length, validRows: rows.length - new Set(errors.map((e) => e.row)).size, invalidRows: new Set(errors.map((e) => e.row)).size, errors };
};
exports.validateRows = validateRows;
