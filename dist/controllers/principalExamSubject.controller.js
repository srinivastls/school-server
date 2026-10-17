"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.principalExamSubjectControllers = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const schoolIdOf = (req) => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const bad = (res, message) => res.status(400).json({ message });
function parseBody(body, partial = false) {
    const data = {};
    for (const key of ["examId", "classId", "subjectId"]) {
        if (!partial || body[key] !== undefined) {
            if (typeof body[key] !== "string" || !body[key].trim())
                throw new Error(`${key} is required.`);
            data[key] = body[key].trim();
        }
    }
    for (const key of ["maxMarks", "passingMarks"]) {
        if (!partial || body[key] !== undefined) {
            const value = Number(body[key]);
            if (!Number.isFinite(value) || value < 0 || (key === "maxMarks" && value === 0))
                throw new Error(`${key} must be a valid ${key === "maxMarks" ? "positive" : "non-negative"} number.`);
            data[key] = value;
        }
    }
    if (!partial || body.weightage !== undefined) {
        if (body.weightage === "" || body.weightage === null)
            data.weightage = null;
        else if (body.weightage !== undefined) {
            const value = Number(body.weightage);
            if (!Number.isFinite(value) || value < 0)
                throw new Error("weightage must be a non-negative number.");
            data.weightage = value;
        }
    }
    const max = data.maxMarks;
    const passing = data.passingMarks;
    if (max !== undefined && passing !== undefined && passing > max)
        throw new Error("passingMarks cannot exceed maxMarks.");
    return data;
}
const includeDetails = {
    exam: { select: { id: true, name: true, type: true, termNumber: true, academicYearId: true } },
    class: { select: { id: true, classNumber: true, displayName: true, academicYearId: true } },
    subject: { select: { id: true, name: true, code: true, classId: true } },
};
async function validateReferences(schoolId, data) {
    const examId = data.examId;
    const classId = data.classId;
    const subjectId = data.subjectId;
    const [exam, classRow, subject] = await Promise.all([
        config_1.prisma.exam.findFirst({ where: { id: examId, schoolId }, select: { id: true, academicYearId: true } }),
        config_1.prisma.class.findFirst({ where: { id: classId }, select: { id: true, academicYearId: true } }),
        config_1.prisma.subject.findFirst({ where: { id: subjectId }, select: { id: true, classId: true } }),
    ]);
    if (!exam)
        return { error: "Exam not found for this school." };
    if (!classRow)
        return { error: "Class not found." };
    if (!subject)
        return { error: "Subject not found." };
    if (classRow.academicYearId !== exam.academicYearId)
        return { error: "The selected class does not belong to the exam's academic year." };
    if (subject.classId !== classId)
        return { error: "The selected subject does not belong to the selected class." };
    return { exam, classRow, subject };
}
exports.principalExamSubjectControllers = {
    getOptions: async (req, res) => {
        try {
            const schoolId = schoolIdOf(req);
            const academicYearId = req.query?.academicYearId?.toString();
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!academicYearId)
                return res.status(400).json({ message: "academicYearId is required." });
            const [academicYear, exams] = await Promise.all([
                config_1.prisma.academicYear.findUnique({
                    where: { id: academicYearId },
                    select: { id: true, name: true, startDate: true, endDate: true },
                }),
                config_1.prisma.exam.findMany({
                    where: { schoolId, academicYearId },
                    select: { id: true, name: true, type: true, termNumber: true, startDate: true, endDate: true, isPublished: true },
                    orderBy: [{ termNumber: "asc" }, { startDate: "asc" }],
                }),
            ]);
            if (!academicYear)
                return res.status(404).json({ message: "Academic year not found." });
            return res.status(200).json({ academicYear, exams });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    getAll: async (req, res) => {
        try {
            const schoolId = schoolIdOf(req);
            const academicYearId = req.query?.academicYearId?.toString();
            const examId = req.query?.examId?.toString();
            const classId = req.query?.classId?.toString();
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!academicYearId)
                return res.status(400).json({ message: "academicYearId is required." });
            const examSubjects = await config_1.prisma.examSubject.findMany({
                where: {
                    exam: { schoolId, academicYearId, ...(examId ? { id: examId } : {}) },
                    ...(classId ? { classId } : {}),
                },
                include: includeDetails,
                orderBy: [{ exam: { termNumber: "asc" } }, { subject: { name: "asc" } }],
            });
            return res.status(200).json({ examSubjects, total: examSubjects.length });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    create: async (req, res) => {
        try {
            const schoolId = schoolIdOf(req);
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            let data;
            try {
                data = parseBody(req.body);
                if (data.passingMarks > data.maxMarks)
                    throw new Error("passingMarks cannot exceed maxMarks.");
            }
            catch (err) {
                return bad(res, err.message || "Invalid assignment.");
            }
            const refs = await validateReferences(schoolId, data);
            if ("error" in refs)
                return res.status(400).json({ message: refs.error });
            const examSubject = await config_1.prisma.examSubject.create({ data: data, include: includeDetails });
            return res.status(201).json({ message: "Subject assigned to exam.", examSubject });
        }
        catch (err) {
            if (err?.code === "P2002")
                return res.status(409).json({ message: "This subject is already assigned to this exam and class." });
            return (0, utils_1.handleErr)(err, res);
        }
    },
    update: async (req, res) => {
        try {
            const schoolId = schoolIdOf(req);
            const id = req.params.examSubjectId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            const existing = await config_1.prisma.examSubject.findFirst({
                where: { id, exam: { schoolId } },
                include: { exam: { select: { academicYearId: true } } },
            });
            if (!existing)
                return res.status(404).json({ message: "Exam subject assignment not found." });
            let data;
            try {
                data = parseBody(req.body, true);
                const max = data.maxMarks ?? existing.maxMarks;
                const passing = data.passingMarks ?? existing.passingMarks;
                if (passing > max)
                    throw new Error("passingMarks cannot exceed maxMarks.");
            }
            catch (err) {
                return bad(res, err.message || "Invalid assignment.");
            }
            if (!Object.keys(data).length)
                return bad(res, "At least one field must be provided.");
            const refsData = {
                examId: data.examId ?? existing.examId,
                classId: data.classId ?? existing.classId,
                subjectId: data.subjectId ?? existing.subjectId,
            };
            const refs = await validateReferences(schoolId, refsData);
            if ("error" in refs)
                return res.status(400).json({ message: refs.error });
            const examSubject = await config_1.prisma.examSubject.update({ where: { id }, data: data, include: includeDetails });
            return res.status(200).json({ message: "Exam subject updated.", examSubject });
        }
        catch (err) {
            if (err?.code === "P2002")
                return res.status(409).json({ message: "This subject is already assigned to this exam and class." });
            return (0, utils_1.handleErr)(err, res);
        }
    },
    delete: async (req, res) => {
        try {
            const schoolId = schoolIdOf(req);
            const id = req.params.examSubjectId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            const existing = await config_1.prisma.examSubject.findFirst({ where: { id, exam: { schoolId } }, select: { id: true } });
            if (!existing)
                return res.status(404).json({ message: "Exam subject assignment not found." });
            await config_1.prisma.examSubject.delete({ where: { id } });
            return res.status(200).json({ message: "Exam subject assignment deleted." });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
};
