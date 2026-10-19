"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishReportCards = exports.getReportCardPreview = exports.getReportCardOptions = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getSchoolId = (req) => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const getAcademicYearId = (req) => req.query?.academicYearId?.toString() ?? req.body?.academicYearId?.toString();
const gradeFor = (percentage) => {
    if (percentage >= 90)
        return "A+";
    if (percentage >= 80)
        return "A";
    if (percentage >= 70)
        return "B";
    if (percentage >= 60)
        return "C";
    if (percentage >= 50)
        return "D";
    if (percentage >= 35)
        return "E";
    return "F";
};
const getReportCardOptions = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = getAcademicYearId(req);
        if (!schoolId || !academicYearId)
            return res.status(400).json({ message: "schoolId and academicYearId are required." });
        const [academicYear, exams, classes] = await Promise.all([
            config_1.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true, startDate: true, endDate: true } }),
            config_1.prisma.exam.findMany({ where: { schoolId, academicYearId }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, type: true, termNumber: true, startDate: true, endDate: true, isPublished: true, examSubjects: { select: { classId: true } } } }),
            config_1.prisma.class.findMany({ where: { schoolId, academicYearId }, orderBy: { classNumber: "asc" }, select: { id: true, classNumber: true, displayName: true } }),
        ]);
        if (!academicYear)
            return res.status(404).json({ message: "Academic year not found." });
        return res.status(200).json({ academicYear, exams, classes });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.getReportCardOptions = getReportCardOptions;
const getReportCardPreview = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = req.query?.academicYearId?.toString();
        const examId = req.query?.examId?.toString();
        const classId = req.query?.classId?.toString();
        if (!schoolId || !academicYearId || !examId || !classId)
            return res.status(400).json({ message: "academicYearId, examId and classId are required." });
        const exam = await config_1.prisma.exam.findFirst({ where: { id: examId, schoolId, academicYearId }, include: { academicYear: { select: { id: true, name: true, startDate: true, endDate: true } }, school: { select: { name: true, address: true, contactPhone: true, logoUrl: true, board: true } }, examSubjects: { where: { classId }, include: { subject: { select: { id: true, name: true, code: true } } }, orderBy: { subject: { name: "asc" } } } } });
        if (!exam)
            return res.status(404).json({ message: "Exam not found for this academic year." });
        if (!exam.examSubjects.length)
            return res.status(404).json({ message: "No exam subjects are configured for this class." });
        const classRecord = await config_1.prisma.class.findFirst({ where: { id: classId, schoolId, academicYearId }, select: { id: true, classNumber: true, displayName: true } });
        if (!classRecord)
            return res.status(404).json({ message: "Class not found." });
        const students = await config_1.prisma.student.findMany({ where: { schoolId, classId, status: "ACTIVE" }, orderBy: [{ rollNumber: "asc" }, { name: "asc" }], select: { id: true, admissionNo: true, name: true, fatherName: true, rollNumber: true, section: { select: { sectionName: true } } } });
        const marks = students.length ? await config_1.prisma.mark.findMany({ where: { schoolId, studentId: { in: students.map(s => s.id) }, examSubjectId: { in: exam.examSubjects.map(s => s.id) } }, select: { studentId: true, examSubjectId: true, marksObtained: true, isAbsent: true, isFinalized: true } }) : [];
        const markMap = new Map(marks.map(m => [`${m.studentId}:${m.examSubjectId}`, m]));
        const reportCards = students.map(student => {
            const subjects = exam.examSubjects.map(es => {
                const mark = markMap.get(`${student.id}:${es.id}`);
                const obtained = mark?.isAbsent ? 0 : mark?.marksObtained ?? null;
                return { examSubjectId: es.id, subject: es.subject, maxMarks: es.maxMarks, passingMarks: es.passingMarks, marksObtained: obtained, isAbsent: Boolean(mark?.isAbsent), isFinalized: Boolean(mark?.isFinalized), passed: obtained !== null && obtained >= es.passingMarks && !mark?.isAbsent };
            });
            const allFinalized = subjects.length > 0 && subjects.every(s => s.isFinalized && s.marksObtained !== null);
            const totalMax = subjects.reduce((sum, s) => sum + s.maxMarks, 0);
            const totalObtained = subjects.reduce((sum, s) => sum + (s.marksObtained ?? 0), 0);
            const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
            const passed = allFinalized && subjects.every(s => s.passed);
            return { student, subjects, allFinalized, totalMax, totalObtained, percentage, grade: allFinalized ? gradeFor(percentage) : null, result: allFinalized ? (passed ? "PASS" : "FAIL") : "PENDING" };
        });
        // Rank is assigned only among complete report cards; ties share the same rank.
        const ranked = [...reportCards].filter(r => r.allFinalized).sort((a, b) => b.totalObtained - a.totalObtained);
        let lastScore = null;
        let lastRank = 0;
        ranked.forEach((r, index) => { if (lastScore !== r.totalObtained)
            lastRank = index + 1; lastScore = r.totalObtained; r.rank = lastRank; });
        const rankMap = new Map(ranked.map(r => [r.student.id, r.rank]));
        return res.status(200).json({ school: exam.school, academicYear: exam.academicYear, exam: { id: exam.id, name: exam.name, type: exam.type, termNumber: exam.termNumber, startDate: exam.startDate, endDate: exam.endDate, isPublished: exam.isPublished }, class: classRecord, reportCards: reportCards.map(r => ({ ...r, rank: rankMap.get(r.student.id) ?? null })), summary: { students: students.length, complete: reportCards.filter(r => r.allFinalized).length, pending: reportCards.filter(r => !r.allFinalized).length, pass: reportCards.filter(r => r.result === "PASS").length, fail: reportCards.filter(r => r.result === "FAIL").length } });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.getReportCardPreview = getReportCardPreview;
const publishReportCards = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = req.body?.academicYearId?.toString();
        const examId = req.params?.examId?.toString();
        const published = req.body?.published;
        if (!schoolId || !academicYearId || typeof published !== "boolean")
            return res.status(400).json({ message: "academicYearId and boolean published are required." });
        const exam = await config_1.prisma.exam.findFirst({ where: { id: examId, schoolId, academicYearId }, include: { examSubjects: { select: { id: true, classId: true } } } });
        if (!exam)
            return res.status(404).json({ message: "Exam not found." });
        if (published) {
            if (!exam.examSubjects.length)
                return res.status(400).json({ message: "Configure exam subjects before publishing report cards." });
            const classIds = [...new Set(exam.examSubjects.map(s => s.classId))];
            for (const classId of classIds) {
                const students = await config_1.prisma.student.findMany({ where: { schoolId, classId, status: "ACTIVE" }, select: { id: true } });
                const subjectIds = exam.examSubjects.filter(s => s.classId === classId).map(s => s.id);
                const marks = students.length ? await config_1.prisma.mark.findMany({ where: { schoolId, studentId: { in: students.map(s => s.id) }, examSubjectId: { in: subjectIds } }, select: { studentId: true, examSubjectId: true, marksObtained: true, isFinalized: true } }) : [];
                const expected = students.length * subjectIds.length;
                if (marks.length !== expected || marks.some(m => !m.isFinalized || m.marksObtained === null))
                    return res.status(409).json({ message: "Cannot publish: every active student must have finalized marks for every configured subject in each included class." });
            }
        }
        // Existing schema has only Exam.isPublished; no separate report-card publication field exists.
        const updated = await config_1.prisma.exam.update({ where: { id: exam.id }, data: { isPublished: published }, select: { id: true, name: true, isPublished: true } });
        return res.status(200).json({ message: published ? "Report cards published." : "Report cards unpublished.", exam: updated });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.publishReportCards = publishReportCards;
