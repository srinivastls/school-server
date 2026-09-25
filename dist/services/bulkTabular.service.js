"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitPreview = exports.createPreview = exports.validateRows = exports.requiredFields = exports.parseTabularBuffer = void 0;
const xlsx_1 = __importDefault(require("xlsx"));
const config_1 = require("../config");
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
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
const sessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000;
const cleanup = () => {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, session] of sessions)
        if (session.createdAt < cutoff)
            sessions.delete(id);
};
const createPreview = (schoolId, userId, module, rows) => {
    cleanup();
    const summary = (0, exports.validateRows)(module, rows);
    const id = crypto_1.default.randomUUID();
    sessions.set(id, { id, schoolId, userId, module, rows, summary, createdAt: Date.now() });
    return { previewId: id, summary, sample: rows.slice(0, 20) };
};
exports.createPreview = createPreview;
const getSession = (previewId, schoolId, module) => {
    cleanup();
    const session = sessions.get(previewId);
    if (!session || session.schoolId !== schoolId || session.module !== module)
        throw new Error("Preview session is invalid or expired");
    if (session.summary.invalidRows > 0)
        throw new Error("Resolve validation errors before committing");
    return session;
};
const money = (value) => String(Number(value || 0).toFixed(2));
const commitPreview = async (previewId, schoolId, userId, module) => {
    const session = getSession(previewId, schoolId, module);
    if (session.userId !== userId) {
        throw new Error("Preview belongs to another user");
    }
    /*
     * ----------------------------------------------------
     * STUDENTS IMPORT
     * ----------------------------------------------------
     *
     * Load all required reference data BEFORE starting
     * the transaction.
     *
     * This prevents unnecessary database queries inside
     * the interactive Prisma transaction.
     */
    if (module === "students") {
        const academicYear = await config_1.prisma.academicYear.findFirst({
            where: {
                schoolId,
                isCurrent: true,
            },
        });
        if (!academicYear) {
            throw new Error("Create a current academic year before importing students");
        }
        // Load all classes for this school and academic year.
        const classes = await config_1.prisma.class.findMany({
            where: {
                schoolId,
                academicYearId: academicYear.id,
            },
        });
        // Load all sections belonging to the classes.
        const sections = await config_1.prisma.section.findMany({
            where: {
                schoolId,
                classId: {
                    in: classes.map((item) => item.id),
                },
            },
        });
        /*
         * Build lookup maps so we don't repeatedly query
         * the database for every row.
         */
        const classMap = new Map();
        for (const item of classes) {
            classMap.set(String(item.classNumber).trim(), item);
        }
        const sectionMap = new Map();
        for (const item of sections) {
            const klass = classes.find((classItem) => classItem.id === item.classId);
            if (!klass)
                continue;
            const key = `${String(klass.classNumber).trim()}::${String(item.sectionName)
                .trim()
                .toLowerCase()}`;
            sectionMap.set(key, item);
        }
        /*
         * Validate all rows before starting the transaction.
         * This avoids opening a transaction that will fail
         * because of a missing class or section.
         */
        const preparedRows = session.rows.map((row, index) => {
            const classNumber = String(row.class_number ?? "").trim();
            const sectionName = String(row.section_name ?? "")
                .trim()
                .toLowerCase();
            const klass = classMap.get(classNumber);
            if (!klass) {
                throw new Error(`Row ${index + 2}: Class not found: ${classNumber}`);
            }
            const sectionKey = `${classNumber}::${sectionName}`;
            const section = sectionMap.get(sectionKey);
            if (!section) {
                throw new Error(`Row ${index + 2}: Section not found: ${row.section_name}`);
            }
            return {
                row,
                classId: klass.id,
                sectionId: section.id,
            };
        });
        /*
         * Only the required INSERT operations are performed
         * inside the transaction.
         */
        const result = await config_1.prisma.$transaction(async (tx) => {
            let imported = 0;
            for (const item of preparedRows) {
                const row = item.row;
                await tx.student.create({
                    data: {
                        schoolId,
                        classId: item.classId,
                        sectionId: item.sectionId,
                        admissionNo: row.admission_no,
                        name: row.name,
                        fatherName: row.father_name,
                        motherName: row.mother_name || null,
                        dob: row.dob,
                        doj: row.doj,
                        gender: row.gender || null,
                        bloodGroup: row.blood_group || null,
                        aadhaar: row.aadhaar || null,
                        category: row.category || null,
                        religion: row.religion || null,
                        phone: row.phone || null,
                        emergencyContact: row.emergency_contact || null,
                        previousSchool: row.previous_school || null,
                        rollNumber: row.roll_number || null,
                        tieAmount: money(row.tie_amount),
                        tiePendingAmount: money(row.tie_pending_amount),
                        beltAmount: money(row.belt_amount),
                        beltPendingAmount: money(row.belt_pending_amount),
                        arrearsAmount: money(row.arrears_amount),
                        arrearsPendingAmount: money(row.arrears_pending_amount),
                        pendingTuitionFee: money(row.pending_tuition_fee),
                        pendingTextbookFee: money(row.pending_textbook_fee),
                        pendingNotebookFee: money(row.pending_notebook_fee),
                        pendingDiaryAmount: money(row.pending_diary_amount),
                        pendingAmount: money(row.pending_amount),
                        siblings: [],
                        createdByAdminId: userId,
                    },
                });
                imported += 1;
            }
            return {
                imported,
            };
        }, {
            maxWait: 15000,
            timeout: 120000,
        });
        sessions.delete(previewId);
        return result;
    }
    /*
     * ----------------------------------------------------
     * TEACHERS AND PARENTS IMPORT
     * ----------------------------------------------------
     */
    if (module === "teachers" || module === "parents") {
        const role = module === "teachers" ? "TEACHER" : "PARENT";
        /*
         * Hash passwords before opening the transaction.
         * bcrypt can be expensive and should not unnecessarily
         * consume interactive transaction time.
         */
        const preparedRows = await Promise.all(session.rows.map(async (row) => {
            const passwordHash = await bcryptjs_1.default.hash(row.password || "ChangeMe@123", 12);
            return {
                row,
                passwordHash,
            };
        }));
        const result = await config_1.prisma.$transaction(async (tx) => {
            let imported = 0;
            for (const item of preparedRows) {
                const row = item.row;
                const existingUser = await tx.user.findFirst({
                    where: {
                        schoolId,
                        email: row.email,
                    },
                });
                const user = existingUser ??
                    (await tx.user.create({
                        data: {
                            schoolId,
                            name: row.name,
                            email: row.email,
                            phone: row.phone || null,
                            role,
                            passwordHash: item.passwordHash,
                            designation: row.designation || null,
                            department: row.department || null,
                            employeeId: row.employee_id || null,
                            mustChangePassword: true,
                        },
                    }));
                if (module === "parents") {
                    const student = await tx.student.findFirst({
                        where: {
                            schoolId,
                            admissionNo: row.student_admission_no,
                        },
                    });
                    if (!student) {
                        throw new Error(`Student not found: ${row.student_admission_no}`);
                    }
                    await tx.studentParentLink.upsert({
                        where: {
                            studentId_parentUserId: {
                                studentId: student.id,
                                parentUserId: user.id,
                            },
                        },
                        update: {
                            relationship: row.relationship,
                            isPrimary: row.is_primary?.toLowerCase() === "true",
                        },
                        create: {
                            studentId: student.id,
                            parentUserId: user.id,
                            relationship: row.relationship,
                            isPrimary: row.is_primary?.toLowerCase() === "true",
                        },
                    });
                }
                imported += 1;
            }
            return {
                imported,
            };
        }, {
            maxWait: 15000,
            timeout: 120000,
        });
        sessions.delete(previewId);
        return result;
    }
    /*
     * ----------------------------------------------------
     * TRANSACTIONS IMPORT
     * ----------------------------------------------------
     */
    if (module === "transactions") {
        /*
         * Validate referenced students before opening
         * the transaction.
         */
        const preparedRows = [];
        for (let index = 0; index < session.rows.length; index += 1) {
            const row = session.rows[index];
            const student = await config_1.prisma.student.findFirst({
                where: {
                    schoolId,
                    admissionNo: row.student_admission_no,
                },
            });
            if (!student) {
                throw new Error(`Row ${index + 2}: Student not found: ${row.student_admission_no}`);
            }
            preparedRows.push({
                row,
                student,
            });
        }
        const result = await config_1.prisma.$transaction(async (tx) => {
            let imported = 0;
            for (const item of preparedRows) {
                const row = item.row;
                const student = item.student;
                await tx.transaction.create({
                    data: {
                        schoolId,
                        studentId: student.id,
                        date: row.date,
                        amount: row.amount,
                        pendingAmount: row.pending_amount || student.pendingAmount,
                        paymentMode: row.payment_mode.toUpperCase(),
                        transactionId: row.transaction_id || null,
                        receiptNumber: row.receipt_number,
                        classNumber: row.class_number,
                        recordedByUserId: userId,
                        tieAmount: money(row.tie_amount),
                        diaryAmount: money(row.diary_amount),
                        beltAmount: money(row.belt_amount),
                        arrearsAmount: money(row.arrears_amount),
                        tuitionFeeAmount: money(row.tuition_fee_amount),
                        textBookFeeAmount: money(row.text_book_fee_amount),
                        noteBookFeeAmount: money(row.note_book_fee_amount),
                    },
                });
                imported += 1;
            }
            return {
                imported,
            };
        }, {
            maxWait: 15000,
            timeout: 120000,
        });
        sessions.delete(previewId);
        return result;
    }
    throw new Error(`Unsupported import module: ${module}`);
};
exports.commitPreview = commitPreview;
