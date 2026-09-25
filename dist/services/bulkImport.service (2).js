"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commitPreview = exports.createPreview = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
const bulkTabular_service_1 = require("./bulkTabular.service");
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
    const summary = (0, bulkTabular_service_1.validateRows)(module, rows);
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
    if (session.userId !== userId)
        throw new Error("Preview belongs to another user");
    const result = await config_1.prisma.$transaction(async (tx) => {
        let imported = 0;
        for (const row of session.rows) {
            if (module === "students") {
                const academicYear = await tx.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
                if (!academicYear)
                    throw new Error("Create a current academic year before importing students");
                const klass = await tx.class.findFirst({ where: { schoolId, academicYearId: academicYear.id, classNumber: row.class_number } });
                if (!klass)
                    throw new Error(`Class not found: ${row.class_number}`);
                const section = await tx.section.findFirst({ where: { schoolId, classId: klass.id, sectionName: row.section_name } });
                if (!section)
                    throw new Error(`Section not found: ${row.section_name}`);
                await tx.student.create({ data: { schoolId, classId: klass.id, sectionId: section.id, admissionNo: row.admission_no, name: row.name, fatherName: row.father_name, motherName: row.mother_name || null, dob: row.dob, doj: row.doj, gender: row.gender || null, bloodGroup: row.blood_group || null, aadhaar: row.aadhaar || null, category: row.category || null, religion: row.religion || null, phone: row.phone || null, emergencyContact: row.emergency_contact || null, previousSchool: row.previous_school || null, rollNumber: row.roll_number || null, tieAmount: money(row.tie_amount), tiePendingAmount: money(row.tie_pending_amount), beltAmount: money(row.belt_amount), beltPendingAmount: money(row.belt_pending_amount), arrearsAmount: money(row.arrears_amount), arrearsPendingAmount: money(row.arrears_pending_amount), pendingTuitionFee: money(row.pending_tuition_fee), pendingTextbookFee: money(row.pending_textbook_fee), pendingNotebookFee: money(row.pending_notebook_fee), pendingDiaryAmount: money(row.pending_diary_amount), pendingAmount: money(row.pending_amount), siblings: [], createdByAdminId: userId } });
            }
            else if (module === "teachers" || module === "parents") {
                const role = module === "teachers" ? "TEACHER" : "PARENT";
                const existing = await tx.user.findFirst({ where: { schoolId, email: row.email } });
                const user = existing ?? await tx.user.create({ data: { schoolId, name: row.name, email: row.email, phone: row.phone || null, role, passwordHash: await bcryptjs_1.default.hash(row.password || "ChangeMe@123", 12), designation: row.designation || null, department: row.department || null, employeeId: row.employee_id || null, mustChangePassword: true } });
                if (module === "parents") {
                    const student = await tx.student.findFirst({ where: { schoolId, admissionNo: row.student_admission_no } });
                    if (!student)
                        throw new Error(`Student not found: ${row.student_admission_no}`);
                    await tx.studentParentLink.upsert({ where: { studentId_parentUserId: { studentId: student.id, parentUserId: user.id } }, update: { relationship: row.relationship, isPrimary: row.is_primary?.toLowerCase() === "true" }, create: { studentId: student.id, parentUserId: user.id, relationship: row.relationship, isPrimary: row.is_primary?.toLowerCase() === "true" } });
                }
            }
            else if (module === "transactions") {
                const student = await tx.student.findFirst({ where: { schoolId, admissionNo: row.student_admission_no } });
                if (!student)
                    throw new Error(`Student not found: ${row.student_admission_no}`);
                await tx.transaction.create({ data: { schoolId, studentId: student.id, date: row.date, amount: row.amount, pendingAmount: row.pending_amount || student.pendingAmount, paymentMode: row.payment_mode.toUpperCase(), transactionId: row.transaction_id || null, receiptNumber: row.receipt_number, classNumber: row.class_number, recordedByUserId: userId, tieAmount: money(row.tie_amount), diaryAmount: money(row.diary_amount), beltAmount: money(row.belt_amount), arrearsAmount: money(row.arrears_amount), tuitionFeeAmount: money(row.tuition_fee_amount), textBookFeeAmount: money(row.text_book_fee_amount), noteBookFeeAmount: money(row.note_book_fee_amount) } });
            }
            imported += 1;
        }
        return { imported };
    });
    sessions.delete(previewId);
    return result;
};
exports.commitPreview = commitPreview;
