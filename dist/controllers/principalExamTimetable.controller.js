"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.principalExamTimetableControllers = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getSchoolId = (req) => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const badRequest = (res, message) => res.status(400).json({ message });
const parseDate = (value) => {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
        return null;
    return new Date(value);
};
const parseInput = (body, partial = false) => {
    const data = {};
    for (const field of ["examId", "classId", "subjectId"]) {
        if (!partial || body[field] !== undefined) {
            if (typeof body[field] !== "string" || !body[field].trim()) {
                throw new Error(`${field} is required.`);
            }
            data[field] = body[field].trim();
        }
    }
    if (!partial || body.examDate !== undefined) {
        const date = parseDate(body.examDate);
        if (!date)
            throw new Error("A valid examDate is required.");
        data.examDate = date;
    }
    for (const field of ["startTime", "endTime"]) {
        if (!partial || body[field] !== undefined) {
            const value = body[field];
            if (value === null || value === "") {
                data[field] = null;
            }
            else if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
                throw new Error(`${field} must use 24-hour HH:mm format, or be blank.`);
            }
            else {
                data[field] = value;
            }
        }
    }
    return data;
};
const validateTimes = (startTime, endTime) => {
    if (typeof startTime === "string" && typeof endTime === "string" && startTime >= endTime) {
        throw new Error("endTime must be later than startTime.");
    }
};
const validateRefs = async (schoolId, data) => {
    const examId = data.examId;
    const classId = data.classId;
    const subjectId = data.subjectId;
    const [exam, classRecord, subject] = await Promise.all([
        config_1.prisma.exam.findFirst({
            where: { id: examId, schoolId },
            select: { id: true, academicYearId: true, startDate: true, endDate: true, name: true },
        }),
        config_1.prisma.class.findFirst({
            where: { id: classId },
            select: { id: true, academicYearId: true, classNumber: true, displayName: true },
        }),
        config_1.prisma.subject.findFirst({
            where: { id: subjectId },
            select: { id: true, classId: true, name: true, code: true },
        }),
    ]);
    if (!exam)
        return { error: "Exam not found for this school." };
    if (!classRecord)
        return { error: "Class not found." };
    if (!subject)
        return { error: "Subject not found." };
    if (classRecord.academicYearId !== exam.academicYearId) {
        return { error: "The selected class does not belong to the exam's academic year." };
    }
    if (subject.classId !== classId) {
        return { error: "The selected subject does not belong to the selected class." };
    }
    const examDate = data.examDate;
    if (examDate && (examDate < new Date(exam.startDate.toDateString()) ||
        examDate > new Date(exam.endDate.toDateString() + " 23:59:59"))) {
        // Dates are additionally checked below using date-only boundaries to avoid time-of-day confusion.
        const dateKey = examDate.toISOString().slice(0, 10);
        const startKey = exam.startDate.toISOString().slice(0, 10);
        const endKey = exam.endDate.toISOString().slice(0, 10);
        if (dateKey < startKey || dateKey > endKey) {
            return { error: "Exam date must fall within the exam's start and end dates." };
        }
    }
    return { exam, classRecord, subject };
};
const details = {
    exam: { select: { id: true, name: true, type: true, termNumber: true, academicYearId: true, startDate: true, endDate: true } },
    class: { select: { id: true, classNumber: true, displayName: true, academicYearId: true } },
    subject: { select: { id: true, name: true, code: true, classId: true } },
};
exports.principalExamTimetableControllers = {
    getOptions: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
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
                    orderBy: [{ termNumber: "asc" }, { startDate: "asc" }, { name: "asc" }],
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
            const schoolId = getSchoolId(req);
            const academicYearId = req.query?.academicYearId?.toString();
            const examId = req.query?.examId?.toString();
            const classId = req.query?.classId?.toString();
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!academicYearId)
                return res.status(400).json({ message: "academicYearId is required." });
            const entries = await config_1.prisma.examTimetable.findMany({
                where: {
                    schoolId,
                    exam: { academicYearId, schoolId, ...(examId ? { id: examId } : {}) },
                    ...(classId ? { classId } : {}),
                },
                include: details,
                orderBy: [{ examDate: "asc" }, { startTime: "asc" }],
            });
            return res.status(200).json({ entries, total: entries.length });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    create: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            let data;
            try {
                data = parseInput(req.body);
                validateTimes(data.startTime, data.endTime);
            }
            catch (err) {
                return badRequest(res, err.message || "Invalid timetable entry.");
            }
            const refs = await validateRefs(schoolId, data);
            if (refs.error)
                return badRequest(res, refs.error);
            const entry = await config_1.prisma.examTimetable.create({
                data: { ...data, schoolId },
                include: details,
            });
            return res.status(201).json({ message: "Exam timetable entry created.", entry });
        }
        catch (err) {
            if (err?.code === "P2002") {
                return res.status(409).json({ message: "A timetable entry already exists for this exam, class, and subject." });
            }
            return (0, utils_1.handleErr)(err, res);
        }
    },
    update: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const id = req.params.timetableId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            const existing = await config_1.prisma.examTimetable.findFirst({
                where: { id, schoolId },
                include: { exam: { select: { academicYearId: true } } },
            });
            if (!existing)
                return res.status(404).json({ message: "Exam timetable entry not found." });
            let data;
            try {
                data = parseInput(req.body, true);
                const start = data.startTime ?? existing.startTime;
                const end = data.endTime ?? existing.endTime;
                validateTimes(start, end);
            }
            catch (err) {
                return badRequest(res, err.message || "Invalid timetable entry.");
            }
            if (!Object.keys(data).length)
                return badRequest(res, "At least one field must be provided.");
            const refsData = {
                examId: data.examId ?? existing.examId,
                classId: data.classId ?? existing.classId,
                subjectId: data.subjectId ?? existing.subjectId,
                examDate: data.examDate ?? existing.examDate,
            };
            const refs = await validateRefs(schoolId, refsData);
            if (refs.error)
                return badRequest(res, refs.error);
            const entry = await config_1.prisma.examTimetable.update({
                where: { id },
                data: data,
                include: details,
            });
            return res.status(200).json({ message: "Exam timetable entry updated.", entry });
        }
        catch (err) {
            if (err?.code === "P2002") {
                return res.status(409).json({ message: "A timetable entry already exists for this exam, class, and subject." });
            }
            return (0, utils_1.handleErr)(err, res);
        }
    },
    delete: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const id = req.params.timetableId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            const existing = await config_1.prisma.examTimetable.findFirst({
                where: { id, schoolId },
                select: { id: true },
            });
            if (!existing)
                return res.status(404).json({ message: "Exam timetable entry not found." });
            await config_1.prisma.examTimetable.delete({ where: { id } });
            return res.status(200).json({ message: "Exam timetable entry deleted." });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
};
