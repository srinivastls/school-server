"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentPerformanceTrends = exports.getStudentPerformanceTrendOptions = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getSchoolId = (req) => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const getStudentPerformanceTrendOptions = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = req.query?.academicYearId?.toString();
        if (!schoolId || !academicYearId)
            return res.status(400).json({ message: "academicYearId is required." });
        const year = await config_1.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true } });
        if (!year)
            return res.status(404).json({ message: "Academic year not found." });
        const [classes, exams] = await Promise.all([
            config_1.prisma.class.findMany({ where: { schoolId, academicYearId }, orderBy: { classNumber: "asc" }, select: { id: true, classNumber: true, displayName: true } }),
            config_1.prisma.exam.findMany({ where: { schoolId, academicYearId, isPublished: true }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, termNumber: true, startDate: true } }),
        ]);
        return res.status(200).json({ academicYear: year, classes, exams });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.getStudentPerformanceTrendOptions = getStudentPerformanceTrendOptions;
const getStudentPerformanceTrends = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = req.query?.academicYearId?.toString();
        const classId = req.query?.classId?.toString();
        const studentId = req.query?.studentId?.toString();
        if (!schoolId || !academicYearId || !classId)
            return res.status(400).json({ message: "academicYearId and classId are required." });
        const [classRecord, students, exams] = await Promise.all([
            config_1.prisma.class.findFirst({ where: { id: classId, schoolId, academicYearId }, select: { id: true, classNumber: true, displayName: true } }),
            config_1.prisma.student.findMany({ where: { schoolId, classId, status: "ACTIVE" }, orderBy: [{ rollNumber: "asc" }, { name: "asc" }], select: { id: true, name: true, admissionNo: true, rollNumber: true, sectionId: true } }),
            config_1.prisma.exam.findMany({ where: { schoolId, academicYearId, isPublished: true }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, termNumber: true, startDate: true, examSubjects: { where: { classId }, orderBy: { subject: { name: "asc" } }, select: { id: true, maxMarks: true, passingMarks: true, subject: { select: { id: true, name: true, code: true } } } } } }),
        ]);
        if (!classRecord)
            return res.status(404).json({ message: "Class not found for this academic year." });
        if (studentId && !students.some(student => student.id === studentId))
            return res.status(404).json({ message: "Active student not found in the selected class." });
        const configuredExams = exams.filter(e => e.examSubjects.length > 0);
        const allSubjectIds = configuredExams.flatMap(e => e.examSubjects.map(s => s.id));
        const marks = students.length && allSubjectIds.length ? await config_1.prisma.mark.findMany({ where: { schoolId, studentId: { in: students.map(s => s.id) }, examSubjectId: { in: allSubjectIds }, isFinalized: true }, select: { studentId: true, examSubjectId: true, marksObtained: true, isAbsent: true } }) : [];
        const markMap = new Map(marks.map(m => [`${m.studentId}:${m.examSubjectId}`, m]));
        const examTrends = configuredExams.map(exam => {
            const studentRows = students.map(student => {
                const subjectRows = exam.examSubjects.map(subject => {
                    const mark = markMap.get(`${student.id}:${subject.id}`);
                    const complete = Boolean(mark && (mark.isAbsent || mark.marksObtained !== null));
                    const obtained = mark?.isAbsent ? 0 : mark?.marksObtained ?? null;
                    return { subjectId: subject.subject.id, subjectName: subject.subject.name, maxMarks: subject.maxMarks, passingMarks: subject.passingMarks, obtained, isAbsent: Boolean(mark?.isAbsent), complete };
                });
                const complete = subjectRows.length > 0 && subjectRows.every(s => s.complete);
                const maxMarks = subjectRows.reduce((sum, s) => sum + s.maxMarks, 0);
                const obtained = subjectRows.reduce((sum, s) => sum + (s.obtained ?? 0), 0);
                const percentage = complete && maxMarks > 0 ? Number((obtained / maxMarks * 100).toFixed(2)) : null;
                const passed = complete && subjectRows.every(s => s.obtained !== null && !s.isAbsent && s.obtained >= s.passingMarks);
                return { studentId: student.id, studentName: student.name, complete, totalObtained: complete ? obtained : null, totalMax: maxMarks, percentage, result: !complete ? "PENDING" : passed ? "PASS" : "FAIL", subjectRows };
            });
            const completed = studentRows.filter(s => s.complete && s.percentage !== null);
            const classAverage = completed.length ? Number((completed.reduce((sum, s) => sum + (s.percentage ?? 0), 0) / completed.length).toFixed(2)) : null;
            const subjectAverages = exam.examSubjects.map(subject => {
                const rows = studentRows.map(s => s.subjectRows.find(r => r.subjectId === subject.subject.id)).filter(r => r.complete && r.obtained !== null);
                const avg = rows.length ? rows.reduce((sum, r) => sum + (r.obtained ?? 0), 0) / rows.length : null;
                return { subjectId: subject.subject.id, subjectName: subject.subject.name, averagePercentage: avg === null || !subject.maxMarks ? null : Number((avg / subject.maxMarks * 100).toFixed(2)), finalizedCount: rows.length };
            });
            return { examId: exam.id, examName: exam.name, termNumber: exam.termNumber, date: exam.startDate, classAverage, completedStudents: completed.length, totalStudents: students.length, subjectAverages, students: studentRows };
        });
        const selectedStudent = studentId ? students.find(student => student.id === studentId) ?? null : null;
        const studentTrend = selectedStudent ? examTrends.map(exam => {
            const row = exam.students.find(s => s.studentId === selectedStudent.id);
            return { examId: exam.examId, examName: exam.examName, termNumber: exam.termNumber, date: exam.date, percentage: row?.percentage ?? null, result: row?.result ?? "PENDING", subjects: row?.subjectRows ?? [] };
        }) : null;
        const subjectTrendMap = new Map();
        for (const exam of examTrends) {
            for (const subject of exam.subjectAverages) {
                const entry = subjectTrendMap.get(subject.subjectId) ?? { subjectId: subject.subjectId, subjectName: subject.subjectName, points: [] };
                entry.points.push({ examName: exam.examName, percentage: subject.averagePercentage });
                subjectTrendMap.set(subject.subjectId, entry);
            }
        }
        return res.status(200).json({ class: classRecord, student: selectedStudent, students: students.map(s => ({ id: s.id, name: s.name, admissionNo: s.admissionNo, rollNumber: s.rollNumber })), examTrends, studentTrend, subjectTrends: Array.from(subjectTrendMap.values()), studentCount: students.length });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.getStudentPerformanceTrends = getStudentPerformanceTrends;
