"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImportMetadata = getImportMetadata;
exports.stageImport = stageImport;
exports.commitImport = commitImport;
exports.createIndividualStaff = createIndividualStaff;
exports.exportRows = exportRows;
const crypto_1 = require("crypto");
const bcrypt = __importStar(require("bcryptjs"));
const bulkAdapters_1 = require("./bulkAdapters");
const config_1 = require("../config");
const getSchoolId = (req) => req.user?.schoolId;
const getUserId = (req) => req.user?.id;
const safeModel = (key) => {
    const adapter = bulkAdapters_1.ADAPTERS[key];
    if (!adapter)
        throw new Error(`Unsupported module: ${key}`);
    return config_1.prisma[adapter.model];
};
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
function convertValue(adapter, field, value) {
    if (isBlank(value))
        return undefined; // empty spreadsheet cells are omitted, never erase on update
    if (adapter.dates?.includes(field)) {
        const d = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(d.getTime()))
            throw new Error(`${field} must be a valid date`);
        return d;
    }
    if (adapter.numbers?.includes(field)) {
        const n = Number(value);
        if (!Number.isFinite(n))
            throw new Error(`${field} must be numeric`);
        return n;
    }
    if (adapter.booleans?.includes(field)) {
        if (typeof value === 'boolean')
            return value;
        const s = String(value).trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(s))
            return true;
        if (['false', '0', 'no', 'n'].includes(s))
            return false;
        throw new Error(`${field} must be true/false`);
    }
    if (field === 'siblings' && typeof value === 'string') {
        try {
            return JSON.parse(value);
        }
        catch {
            throw new Error('siblings must contain valid JSON');
        }
    }
    return typeof value === 'string' ? value.trim() : value;
}
function scopedData(key, row, schoolId, adapter) {
    const data = {};
    for (const field of adapter.fields)
        if (Object.prototype.hasOwnProperty.call(row, field)) {
            const v = convertValue(adapter, field, row[field]);
            if (v !== undefined)
                data[field] = v;
        }
    if (key !== 'examSubjects')
        data.schoolId = schoolId;
    if (key === 'classes') {
        const year = row.academicYearId;
        if (year)
            data.academicYearId = String(year);
    }
    if (key === 'exams') {
        const year = row.academicYearId;
        if (year)
            data.academicYearId = String(year);
    }
    return data;
}
function whereFor(key, row, schoolId, adapter) {
    if (adapter.key.includes('+')) {
        const parts = adapter.key.split('+');
        const where = key === 'examSubjects' ? { exam: { schoolId } } : { schoolId };
        for (const p of parts) {
            if (isBlank(row[p])) {
                if (p === 'academicYearId' && ['classes', 'exams'].includes(key))
                    continue;
                throw new Error(`Missing unique key: ${p}`);
            }
            where[p] = p === 'date' ? new Date(row[p]) : row[p];
        }
        if (['classes', 'exams'].includes(key) && !where.academicYearId)
            throw new Error('academicYearId is required to identify this record');
        return where;
    }
    if (adapter.key === 'id') {
        if (isBlank(row.id))
            return null;
        return key === 'examSubjects' ? { id: String(row.id), exam: { schoolId } } : { id: String(row.id), schoolId };
    }
    if (isBlank(row[adapter.key]))
        return null;
    const where = key === 'examSubjects' ? { [adapter.key]: row[adapter.key], exam: { schoolId } } : { schoolId, [adapter.key]: row[adapter.key] };
    if (key === 'classes') {
        if (!row.academicYearId)
            throw new Error('academicYearId is required to identify a class');
        where.academicYearId = String(row.academicYearId);
    }
    return where;
}
async function validateRelations(key, row, schoolId) {
    const check = async (model, id, label) => {
        if (!id)
            return;
        const found = await config_1.prisma[model].findFirst({ where: { id: String(id), schoolId }, select: { id: true } });
        if (!found)
            throw new Error(`${label} does not exist in this school`);
    };
    if (key === 'students') {
        await check('class', row.classId, 'classId');
        await check('section', row.sectionId, 'sectionId');
    }
    if (key === 'sections')
        await check('class', row.classId, 'classId');
    if (key === 'subjects')
        await check('class', row.classId, 'classId');
    if (key === 'examSubjects') {
        await check('exam', row.examId, 'examId');
        await check('class', row.classId, 'classId');
        await check('subject', row.subjectId, 'subjectId');
    }
    if (key === 'examTimetables') {
        await check('exam', row.examId, 'examId');
        await check('class', row.classId, 'classId');
        await check('subject', row.subjectId, 'subjectId');
    }
    if (key === 'marks') {
        await check('student', row.studentId, 'studentId');
        const s = await config_1.prisma.examSubject.findFirst({ where: { id: String(row.examSubjectId), exam: { schoolId } }, select: { id: true } });
        if (!s)
            throw new Error('examSubjectId does not exist in this school');
    }
    if (key === 'attendance') {
        await check('student', row.studentId, 'studentId');
        await check('class', row.classId, 'classId');
        await check('section', row.sectionId, 'sectionId');
    }
}
async function getImportMetadata() { const { IMPORT_MODULES, EXPORT_MODULES } = await Promise.resolve().then(() => __importStar(require('./bulkAdapters'))); return { importModules: IMPORT_MODULES, exportModules: EXPORT_MODULES }; }
async function stageImport(req, moduleKey, originalFileName, rows, fieldMap = {}) {
    const schoolId = getSchoolId(req), userId = getUserId(req), adapter = bulkAdapters_1.ADAPTERS[moduleKey];
    if (!schoolId || !userId)
        throw new Error('Authenticated school and user are required');
    if (!adapter?.writable)
        throw new Error('This module is export-only or unsupported for import');
    if (!Array.isArray(rows) || !rows.length)
        throw new Error('The uploaded file contains no data rows');
    if (rows.length > 10000)
        throw new Error('Maximum 10,000 rows per import');
    const headers = Object.keys(rows[0] || {});
    if (!headers.length)
        throw new Error('No column headers found');
    const normalize = (h) => h.trim().replace(/[\s_-]+/g, '').toLowerCase();
    const autoField = (h) => { const direct = adapter.fields.find(f => normalize(f) === normalize(h)); if (direct)
        return direct; const aliases = { studentname: 'name', fullname: 'name', admissionnumber: 'admissionNo', admissionno: 'admissionNo', fathername: 'fatherName', mothername: 'motherName', class: 'classId', section: 'sectionId', subjectcode: 'code', subjectname: 'name', examname: 'name', dateofbirth: 'dob', dateofjoining: 'doj', phonenumber: 'phone', rollno: 'rollNumber', staffname: 'name', emailaddress: 'email', employeeid: 'employeeId', jobtitle: 'designation' }; const alias = aliases[normalize(h)]; return alias && adapter.fields.includes(alias) ? alias : undefined; };
    const resolvedMap = {};
    for (const h of headers) {
        const target = Object.prototype.hasOwnProperty.call(fieldMap, h) ? fieldMap[h] : autoField(h);
        if (target && (adapter.fields.includes(target) || ['id', 'academicYearId'].includes(target)))
            resolvedMap[h] = target;
    }
    const recognized = Object.keys(resolvedMap);
    const mappedFields = Object.values(resolvedMap);
    const missing = adapter.requiredOnCreate.filter(f => !mappedFields.includes(f));
    const normalized = [], errors = [];
    for (let i = 0; i < rows.length; i++) {
        const raw = rows[i] || {}, rowErrors = [];
        const row = {};
        for (const [header, value] of Object.entries(raw)) {
            const field = resolvedMap[String(header)];
            if (field)
                row[field] = value;
        }
        // Required fields are enforced only for new records; existing rows may be partial updates.
        try {
            const where = whereFor(moduleKey, row, schoolId, adapter);
            const existing = where ? await safeModel(moduleKey).findFirst({ where }) : null;
            if (!existing)
                for (const f of adapter.requiredOnCreate)
                    if (isBlank(row[f]))
                        rowErrors.push(`Missing required field for new record: ${f}`);
            if (!recognized.length)
                rowErrors.push('No recognized columns found');
            if (moduleKey === 'exams' && row.type && !['UNIT_TEST', 'MID_TERM', 'FINAL', 'OTHER'].includes(String(row.type)))
                rowErrors.push('type must be UNIT_TEST, MID_TERM, FINAL, or OTHER');
            if (moduleKey === 'attendance' && row.status && !['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'HOLIDAY'].includes(String(row.status)))
                rowErrors.push('Invalid attendance status');
            if (moduleKey === 'students' && row.status && !['ACTIVE', 'TRANSFERRED', 'GRADUATED', 'DROPPED'].includes(String(row.status)))
                rowErrors.push('Invalid student status');
            if (moduleKey === 'teachers') {
                if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email)))
                    rowErrors.push('email must be a valid email address');
                if (row.role && !['TEACHER', 'ADMIN'].includes(String(row.role).toUpperCase()))
                    rowErrors.push('role must be TEACHER or ADMIN');
            }
            if (moduleKey === 'marks' && row.marksObtained !== undefined && row.marksObtained !== '' && (!Number.isFinite(Number(row.marksObtained)) || Number(row.marksObtained) < 0))
                rowErrors.push('marksObtained must be a non-negative number');
            await validateRelations(moduleKey, row, schoolId);
            // Run field conversion during validation.
            for (const field of adapter.fields)
                if (Object.prototype.hasOwnProperty.call(row, field))
                    convertValue(adapter, field, row[field]);
        }
        catch (e) {
            rowErrors.push(e.message || 'Validation failed');
        }
        normalized.push(row);
        if (rowErrors.length)
            errors.push({ rowNumber: i + 2, errors: rowErrors, values: row });
    }
    const id = (0, crypto_1.randomUUID)();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await config_1.prisma.bulk_import_sessions.create({ data: { id, school_id: schoolId, created_by_user_id: userId, module: moduleKey, status: errors.length ? 'UPLOADED' : 'READY', original_file_name: originalFileName, row_count: rows.length, valid_rows: rows.length - errors.length, invalid_rows: errors.length, payload: { rows: normalized, headers, recognizedHeaders: recognized, fieldMap: resolvedMap, availableFields: [...adapter.fields, ...(['id', 'academicYearId'].filter(f => !adapter.fields.includes(f)))], ignoredHeaders: headers.filter(h => !recognized.includes(h)), missingRequiredHeaders: missing }, errors: errors.length ? errors : null, expires_at: expiresAt, updated_at: new Date() } });
    return { sessionId: id, module: moduleKey, totalRows: rows.length, validRows: rows.length - errors.length, invalidRows: errors.length, headers, recognizedHeaders: recognized, fieldMap: resolvedMap, availableFields: [...adapter.fields, ...(['id', 'academicYearId'].filter(f => !adapter.fields.includes(f)))], ignoredHeaders: headers.filter(h => !recognized.includes(h)), missingRequiredHeaders: missing, errors, preview: normalized.slice(0, 20) };
}
async function commitImport(req, sessionId, mode) {
    const schoolId = getSchoolId(req), userId = getUserId(req);
    if (!schoolId || !userId)
        throw new Error('Authenticated school and user are required');
    const session = await config_1.prisma.bulk_import_sessions.findFirst({ where: { id: sessionId, school_id: schoolId, created_by_user_id: userId } });
    if (!session)
        throw new Error('Import session not found');
    if (session.expires_at < new Date())
        throw new Error('Import session expired; upload again');
    if (session.status === 'COMMITTED')
        throw new Error('This import has already been committed');
    const payload = session.payload, rows = payload.rows, adapter = bulkAdapters_1.ADAPTERS[session.module];
    if (!adapter?.writable)
        throw new Error('Unsupported import module');
    const rowErrors = Array.isArray(session.errors) ? session.errors : [];
    const invalidNumbers = new Set(rowErrors.map((e) => e.rowNumber));
    let created = 0, updated = 0, skipped = 0;
    const failures = [];
    const credentials = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (invalidNumbers.has(i + 2)) {
            skipped++;
            continue;
        }
        try {
            const where = whereFor(session.module, row, schoolId, adapter);
            const existing = where ? await safeModel(session.module).findFirst({ where }) : null;
            if (existing && mode === 'create') {
                skipped++;
                continue;
            }
            if (!existing && mode === 'update') {
                skipped++;
                continue;
            }
            const data = scopedData(session.module, row, schoolId, adapter);
            if (session.module === 'marks') {
                data.enteredByUserId = userId;
            }
            if (session.module === 'teachers') {
                data.role = String(data.role || '').toUpperCase();
                if (!['TEACHER', 'ADMIN'].includes(data.role))
                    throw new Error('role must be TEACHER or ADMIN');
            }
            if (session.module === 'attendance') {
                data.markedByUserId = userId;
            }
            if (existing) {
                delete data.schoolId;
                if (session.module === 'marks') {
                    delete data.enteredByUserId;
                    if (existing.isFinalized)
                        throw new Error('Finalized marks cannot be overwritten');
                }
                await safeModel(session.module).update({ where: { id: existing.id }, data });
                updated++;
            }
            else {
                if (session.module === 'teachers') {
                    const temporaryPassword = (0, crypto_1.randomBytes)(12).toString('base64url');
                    data.passwordHash = await bcrypt.hash(temporaryPassword, 12);
                    data.isActive = data.isActive ?? true;
                    const account = await safeModel(session.module).create({ data });
                    credentials.push({ name: account.name, email: account.email, temporaryPassword });
                    created++;
                    continue;
                }
                if (session.module === 'classes' || session.module === 'exams') {
                    if (!row.academicYearId)
                        throw new Error('academicYearId is required for new records');
                    data.academicYearId = String(row.academicYearId);
                }
                if (session.module === 'marks' && row.isFinalized)
                    throw new Error('Import cannot finalize marks');
                await safeModel(session.module).create({ data });
                created++;
            }
        }
        catch (e) {
            failures.push({ rowNumber: i + 2, error: e.message || 'Commit failed' });
            skipped++;
        }
    }
    await config_1.prisma.bulk_import_sessions.update({ where: { id: session.id }, data: { status: failures.length ? 'FAILED' : 'COMMITTED', committed_at: new Date(), errors: failures.length ? failures : session.errors, updated_at: new Date() } });
    return { created, updated, skipped, failures, ...(session.module === 'teachers' ? { credentials } : {}) };
}
async function createIndividualStaff(req, input) {
    const schoolId = getSchoolId(req), userId = getUserId(req);
    if (!schoolId || !userId)
        throw new Error('Authenticated school and user are required');
    const name = String(input?.name || '').trim(), email = String(input?.email || '').trim().toLowerCase(), role = String(input?.role || '').trim().toUpperCase();
    if (!name || !email || !role)
        throw new Error('name, email, and role are required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('email must be a valid email address');
    if (!['TEACHER', 'ADMIN'].includes(role))
        throw new Error('role must be TEACHER or ADMIN');
    const existing = await config_1.prisma.user.findFirst({ where: { schoolId, email }, select: { id: true } });
    if (existing)
        throw new Error('An account with this email already exists in this school');
    const temporaryPassword = (0, crypto_1.randomBytes)(12).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const account = await config_1.prisma.user.create({ data: { schoolId, name, email, role, passwordHash, phone: input.phone ? String(input.phone).trim() : undefined, designation: input.designation ? String(input.designation).trim() : undefined, department: input.department ? String(input.department).trim() : undefined, employeeId: input.employeeId ? String(input.employeeId).trim() : undefined, isActive: input.isActive === false ? false : true } });
    return { staff: { id: account.id, name: account.name, email: account.email, role: account.role, phone: account.phone, designation: account.designation, department: account.department, employeeId: account.employeeId, isActive: account.isActive }, temporaryPassword };
}
async function exportRows(req, moduleKey, filters = {}) {
    const schoolId = getSchoolId(req), adapter = bulkAdapters_1.ADAPTERS[moduleKey];
    if (!schoolId)
        throw new Error('Authenticated school is required');
    if (!adapter)
        throw new Error('Unsupported module');
    const where = moduleKey === 'examSubjects' ? { exam: { schoolId } } : { schoolId };
    if (filters.academicYearId && ['classes', 'exams'].includes(moduleKey))
        where.academicYearId = String(filters.academicYearId);
    if (filters.classId && ['students', 'sections', 'subjects', 'examSubjects', 'examTimetables', 'attendance'].includes(moduleKey))
        where.classId = String(filters.classId);
    if (filters.sectionId && ['students', 'attendance'].includes(moduleKey))
        where.sectionId = String(filters.sectionId);
    if (filters.status && moduleKey === 'students')
        where.status = String(filters.status);
    if (moduleKey === 'teachers') {
        if (filters.role && ['TEACHER', 'ADMIN', 'PARENT', 'PRINCIPAL'].includes(String(filters.role).toUpperCase()))
            where.role = String(filters.role).toUpperCase();
        if (filters.isActive !== undefined && ['true', 'false'].includes(String(filters.isActive).toLowerCase()))
            where.isActive = String(filters.isActive).toLowerCase() === 'true';
    }
    if (moduleKey === 'transactions') {
        // Transaction.date is a String in the supplied schema. Date-range filters expect ISO-like YYYY-MM-DD values.
        const dateFrom = String(filters.dateFrom || '').trim(), dateTo = String(filters.dateTo || '').trim(), month = String(filters.month || '').trim();
        if (month && !/^\d{4}-\d{2}$/.test(month))
            throw new Error('month must use YYYY-MM format');
        if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom))
            throw new Error('dateFrom must use YYYY-MM-DD format');
        if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo))
            throw new Error('dateTo must use YYYY-MM-DD format');
        if (dateFrom && dateTo && dateFrom > dateTo)
            throw new Error('dateFrom must be on or before dateTo');
        if (month)
            where.date = { startsWith: month };
        else if (dateFrom || dateTo)
            where.date = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo + '\uffff' } : {}) };
        if (filters.classId || filters.sectionId || filters.studentId) {
            const studentWhere = { schoolId };
            if (filters.classId)
                studentWhere.classId = String(filters.classId);
            if (filters.sectionId)
                studentWhere.sectionId = String(filters.sectionId);
            if (filters.studentId)
                studentWhere.id = String(filters.studentId);
            where.student = { is: studentWhere };
        }
        if (filters.paymentMode)
            where.paymentMode = String(filters.paymentMode);
    }
    // Include related display names so exports are useful to school staff without requiring UUID lookups.
    const includeByModule = {
        students: { class: { select: { classNumber: true, displayName: true } }, section: { select: { sectionName: true } } },
        marks: { student: { select: { admissionNo: true, name: true, fatherName: true, classId: true, sectionId: true, class: { select: { classNumber: true, displayName: true } }, section: { select: { sectionName: true } } } }, examSubject: { select: { maxMarks: true, passingMarks: true, subject: { select: { name: true, code: true } }, class: { select: { classNumber: true, displayName: true } }, exam: { select: { name: true, academicYearId: true, academicYear: { select: { name: true } } } } } } },
        attendance: { student: { select: { admissionNo: true, name: true, fatherName: true, rollNumber: true } }, class: { select: { classNumber: true, displayName: true } }, section: { select: { sectionName: true } }, academicYear: { select: { name: true } } },
        examSubjects: { exam: { select: { name: true, academicYearId: true, academicYear: { select: { name: true } } } }, subject: { select: { name: true, code: true } }, class: { select: { classNumber: true, displayName: true } } },
        examTimetables: { exam: { select: { name: true, academicYearId: true, academicYear: { select: { name: true } } } }, subject: { select: { name: true, code: true } }, class: { select: { classNumber: true, displayName: true } } },
        sections: { class: { select: { classNumber: true, displayName: true } } },
        subjects: { class: { select: { classNumber: true, displayName: true } } },
        exams: { academicYear: { select: { name: true } } },
        classes: { academicYear: { select: { name: true } } },
        teachers: {},
        transactions: { student: { select: { admissionNo: true, name: true, fatherName: true, rollNumber: true, classId: true, sectionId: true, class: { select: { classNumber: true, displayName: true } }, section: { select: { sectionName: true } } } }, recordedByUser: { select: { name: true, email: true, role: true } } }
    };
    const orderBy = moduleKey === 'students' ? { name: 'asc' } : moduleKey === 'transactions' ? [{ date: 'asc' }, { receiptNumber: 'asc' }] : moduleKey === 'teachers' ? { name: 'asc' } : { id: 'asc' };
    const rows = await safeModel(moduleKey).findMany({ where, orderBy, take: 50000, include: includeByModule[moduleKey] || undefined });
    const iso = (v) => v instanceof Date ? v.toISOString() : v;
    return rows.map((r) => {
        const out = {};
        for (const f of adapter.fields)
            if (Object.prototype.hasOwnProperty.call(r, f))
                out[f] = iso(r[f]);
        if (moduleKey === 'students')
            Object.assign(out, { className: r.class?.displayName || r.class?.classNumber || '', sectionName: r.section?.sectionName || '' });
        if (moduleKey === 'marks')
            Object.assign(out, { admissionNo: r.student?.admissionNo || '', studentName: r.student?.name || '', fatherName: r.student?.fatherName || '', rollNumber: r.student?.rollNumber || '', className: r.student?.class?.displayName || r.student?.class?.classNumber || '', sectionName: r.student?.section?.sectionName || '', examName: r.examSubject?.exam?.name || '', academicYearName: r.examSubject?.exam?.academicYear?.name || '', subjectName: r.examSubject?.subject?.name || '', subjectCode: r.examSubject?.subject?.code || '', maxMarks: r.examSubject?.maxMarks ?? '', passingMarks: r.examSubject?.passingMarks ?? '' });
        if (moduleKey === 'attendance')
            Object.assign(out, { admissionNo: r.student?.admissionNo || '', studentName: r.student?.name || '', fatherName: r.student?.fatherName || '', rollNumber: r.student?.rollNumber || '', className: r.class?.displayName || r.class?.classNumber || '', sectionName: r.section?.sectionName || '', academicYearName: r.academicYear?.name || '' });
        if (moduleKey === 'examSubjects')
            Object.assign(out, { examName: r.exam?.name || '', academicYearName: r.exam?.academicYear?.name || r.exam?.academicYearId || '', subjectName: r.subject?.name || '', subjectCode: r.subject?.code || '', className: r.class?.displayName || r.class?.classNumber || '' });
        if (moduleKey === 'examTimetables')
            Object.assign(out, { examName: r.exam?.name || '', academicYearName: r.exam?.academicYear?.name || r.exam?.academicYearId || '', subjectName: r.subject?.name || '', subjectCode: r.subject?.code || '', className: r.class?.displayName || r.class?.classNumber || '' });
        if (moduleKey === 'sections')
            Object.assign(out, { className: r.class?.displayName || r.class?.classNumber || '' });
        if (moduleKey === 'subjects')
            Object.assign(out, { className: r.class?.displayName || r.class?.classNumber || '' });
        if (moduleKey === 'exams')
            Object.assign(out, { academicYearName: r.academicYear?.name || '' });
        if (moduleKey === 'classes')
            Object.assign(out, { academicYearName: r.academicYear?.name || '' });
        if (moduleKey === 'teachers')
            Object.assign(out, { staffName: r.name || '', accountStatus: r.isActive ? 'ACTIVE' : 'INACTIVE' }); // never export password hashes
        if (moduleKey === 'transactions')
            Object.assign(out, { admissionNo: r.student?.admissionNo || '', studentName: r.student?.name || '', fatherName: r.student?.fatherName || '', rollNumber: r.student?.rollNumber || '', studentClassName: r.student?.class?.displayName || r.student?.class?.classNumber || '', sectionName: r.student?.section?.sectionName || '', recordedByName: r.recordedByUser?.name || '', recordedByEmail: r.recordedByUser?.email || '', recordedByRole: r.recordedByUser?.role || '' });
        return out;
    });
}
