"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.principalExamControllers = void 0;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const utils_1 = require("../utils");
const getSchoolId = (req) => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const getAcademicYearId = (req) => req.query?.academicYearId?.toString() ?? req.body?.academicYearId?.toString();
const validDate = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const parseExamInput = (body, partial = false) => {
    const data = {};
    if (!partial || body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) {
            throw new Error("Exam name is required.");
        }
        data.name = body.name.trim();
    }
    if (!partial || body.type !== undefined) {
        if (typeof body.type !== "string" || !Object.values(client_1.ExamType).includes(body.type)) {
            throw new Error("A valid exam type is required.");
        }
        data.type = body.type;
    }
    if (!partial || body.termNumber !== undefined) {
        const termNumber = Number(body.termNumber);
        if (!Number.isInteger(termNumber) || termNumber < 1) {
            throw new Error("Term number must be a positive integer.");
        }
        data.termNumber = termNumber;
    }
    if (!partial || body.startDate !== undefined) {
        if (!validDate(body.startDate))
            throw new Error("A valid start date is required.");
        data.startDate = new Date(body.startDate);
    }
    if (!partial || body.endDate !== undefined) {
        if (!validDate(body.endDate))
            throw new Error("A valid end date is required.");
        data.endDate = new Date(body.endDate);
    }
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
        throw new Error("End date must be on or after start date.");
    }
    return data;
};
const badRequest = (res, message) => res.status(400).json({ message });
exports.principalExamControllers = {
    getOptions: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const academicYearId = getAcademicYearId(req);
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!academicYearId)
                return res.status(400).json({ message: "academicYearId is required." });
            const academicYear = await config_1.prisma.academicYear.findUnique({
                where: { id: academicYearId },
                select: { id: true, name: true, startDate: true, endDate: true },
            });
            if (!academicYear)
                return res.status(404).json({ message: "Academic year not found." });
            return res.status(200).json({
                academicYear,
                examTypes: Object.values(client_1.ExamType),
            });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    getExams: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const academicYearId = getAcademicYearId(req);
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!academicYearId)
                return res.status(400).json({ message: "academicYearId is required." });
            const exams = await config_1.prisma.exam.findMany({
                where: { schoolId, academicYearId },
                orderBy: [{ termNumber: "asc" }, { startDate: "asc" }, { name: "asc" }],
            });
            return res.status(200).json({ exams, total: exams.length });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    createExam: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const academicYearId = req.body?.academicYearId?.toString();
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!academicYearId)
                return res.status(400).json({ message: "academicYearId is required." });
            let data;
            try {
                data = parseExamInput(req.body);
            }
            catch (err) {
                return badRequest(res, err.message || "Invalid exam details.");
            }
            const academicYear = await config_1.prisma.academicYear.findUnique({
                where: { id: academicYearId },
                select: { id: true },
            });
            if (!academicYear)
                return res.status(404).json({ message: "Academic year not found." });
            const exam = await config_1.prisma.exam.create({
                data: {
                    ...data,
                    schoolId,
                    academicYearId,
                },
            });
            return res.status(201).json({ message: "Exam created successfully.", exam });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    updateExam: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const examId = req.params.examId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            if (!examId)
                return res.status(400).json({ message: "Exam ID is required." });
            let data;
            try {
                data = parseExamInput(req.body, true);
            }
            catch (err) {
                return badRequest(res, err.message || "Invalid exam details.");
            }
            if (Object.keys(data).length === 0) {
                return badRequest(res, "At least one exam field must be provided.");
            }
            const existing = await config_1.prisma.exam.findFirst({ where: { id: examId, schoolId } });
            if (!existing)
                return res.status(404).json({ message: "Exam not found." });
            const mergedStart = data.startDate ? data.startDate : existing.startDate;
            const mergedEnd = data.endDate ? data.endDate : existing.endDate;
            if (mergedStart > mergedEnd)
                return badRequest(res, "End date must be on or after start date.");
            const exam = await config_1.prisma.exam.update({ where: { id: examId }, data: data });
            return res.status(200).json({ message: "Exam updated successfully.", exam });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    setPublished: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const examId = req.params.examId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            const existing = await config_1.prisma.exam.findFirst({ where: { id: examId, schoolId } });
            if (!existing)
                return res.status(404).json({ message: "Exam not found." });
            const isPublished = req.body?.isPublished;
            if (typeof isPublished !== "boolean") {
                return badRequest(res, "isPublished must be a boolean.");
            }
            const exam = await config_1.prisma.exam.update({
                where: { id: examId },
                data: { isPublished },
            });
            return res.status(200).json({
                message: isPublished ? "Exam published successfully." : "Exam unpublished successfully.",
                exam,
            });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
    deleteExam: async (req, res) => {
        try {
            const schoolId = getSchoolId(req);
            const examId = req.params.examId;
            if (!schoolId)
                return res.status(400).json({ message: "School context is missing." });
            const existing = await config_1.prisma.exam.findFirst({ where: { id: examId, schoolId } });
            if (!existing)
                return res.status(404).json({ message: "Exam not found." });
            await config_1.prisma.exam.delete({ where: { id: examId } });
            return res.status(200).json({ message: "Exam deleted successfully." });
        }
        catch (err) {
            return (0, utils_1.handleErr)(err, res);
        }
    },
};
