import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getSchoolId = (req: Request): string | undefined => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const getAcademicYearId = (req: Request): string | undefined => req.query?.academicYearId?.toString() ?? req.body?.academicYearId?.toString();
const gradeFor = (p: number) => p >= 90 ? "A+" : p >= 80 ? "A" : p >= 70 ? "B" : p >= 60 ? "C" : p >= 50 ? "D" : p >= 35 ? "E" : "F";

export const getTeacherReportCardOptions = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req); const academicYearId = getAcademicYearId(req); const teacherId = req.user?.id;
    if (!schoolId || !academicYearId || !teacherId) return res.status(400).json({ message: "Authenticated teacher, school and academic year are required." });
    const academicYear = await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true } });
    if (!academicYear) return res.status(404).json({ message: "Academic year not found." });
    const sections = await prisma.section.findMany({ where: { schoolId, classTeacherId: teacherId, class: { academicYearId } }, select: { id: true, sectionName: true, classId: true, class: { select: { id: true, classNumber: true, displayName: true } } }, orderBy: [{ class: { classNumber: "asc" } }, { sectionName: "asc" }] });
    const classIds = [...new Set(sections.map(s => s.classId))];
    const exams = await prisma.exam.findMany({ where: { schoolId, academicYearId, examSubjects: { some: { classId: { in: classIds } } } }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, type: true, termNumber: true, startDate: true, endDate: true, isPublished: true, examSubjects: { select: { classId: true } } } });
    return res.status(200).json({ academicYear, exams, sections: sections.map(s => ({ id: s.id, sectionName: s.sectionName, classId: s.classId, class: s.class })) });
  } catch (err) { return handleErr(err, res); }
};

export const getTeacherReportCardPreview = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req); const academicYearId = req.query?.academicYearId?.toString(); const examId = req.query?.examId?.toString(); const sectionId = req.query?.sectionId?.toString(); const teacherId = req.user?.id;
    if (!schoolId || !academicYearId || !examId || !sectionId || !teacherId) return res.status(400).json({ message: "academicYearId, examId and sectionId are required." });
    const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId, classTeacherId: teacherId, class: { academicYearId } }, include: { class: { select: { id: true, classNumber: true, displayName: true } } } });
    if (!section) return res.status(403).json({ message: "This section is not assigned to you as class teacher." });
    const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId, academicYearId, examSubjects: { some: { classId: section.classId } } }, include: { academicYear: { select: { id: true, name: true, startDate: true, endDate: true } }, school: { select: { name: true, address: true, contactPhone: true, logoUrl: true, board: true } }, examSubjects: { where: { classId: section.classId }, include: { subject: { select: { id: true, name: true, code: true } } }, orderBy: { subject: { name: "asc" } } } } });
    if (!exam) return res.status(404).json({ message: "Exam not found for this assigned class." });
    const students = await prisma.student.findMany({ where: { schoolId, classId: section.classId, sectionId, status: "ACTIVE" }, orderBy: [{ rollNumber: "asc" }, { name: "asc" }], select: { id: true, admissionNo: true, name: true, fatherName: true, rollNumber: true, section: { select: { sectionName: true } } } });
    const marks = students.length ? await prisma.mark.findMany({ where: { schoolId, studentId: { in: students.map(s => s.id) }, examSubjectId: { in: exam.examSubjects.map(s => s.id) } }, select: { studentId: true, examSubjectId: true, marksObtained: true, isAbsent: true, isFinalized: true } }) : [];
    const markMap = new Map(marks.map(m => [`${m.studentId}:${m.examSubjectId}`, m]));
    const cards = students.map(student => {
      const subjects = exam.examSubjects.map(es => { const m = markMap.get(`${student.id}:${es.id}`); const obtained = m?.isAbsent ? 0 : m?.marksObtained ?? null; return { examSubjectId: es.id, subject: es.subject, maxMarks: es.maxMarks, passingMarks: es.passingMarks, marksObtained: obtained, isAbsent: Boolean(m?.isAbsent), isFinalized: Boolean(m?.isFinalized), passed: obtained !== null && obtained >= es.passingMarks && !m?.isAbsent }; });
      const allFinalized = subjects.length > 0 && subjects.every(s => s.isFinalized && s.marksObtained !== null); const totalMax = subjects.reduce((a, s) => a + s.maxMarks, 0); const totalObtained = subjects.reduce((a, s) => a + (s.marksObtained ?? 0), 0); const percentage = totalMax ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0; const passed = allFinalized && subjects.every(s => s.passed);
      return { student, subjects, allFinalized, totalMax, totalObtained, percentage, grade: allFinalized ? gradeFor(percentage) : null, result: allFinalized ? (passed ? "PASS" : "FAIL") : "PENDING" };
    });
    const ranked = [...cards].filter(c => c.allFinalized).sort((a, b) => b.totalObtained - a.totalObtained); let last: number | null = null; let rank = 0; const ranks = new Map<string, number>(); ranked.forEach((c, i) => { if (last !== c.totalObtained) rank = i + 1; last = c.totalObtained; ranks.set(c.student.id, rank); });
    return res.status(200).json({ school: exam.school, academicYear: exam.academicYear, exam: { id: exam.id, name: exam.name, type: exam.type, termNumber: exam.termNumber, startDate: exam.startDate, endDate: exam.endDate, isPublished: exam.isPublished }, class: section.class, section: { id: section.id, sectionName: section.sectionName }, reportCards: cards.map(c => ({ ...c, rank: ranks.get(c.student.id) ?? null })), summary: { students: students.length, complete: cards.filter(c => c.allFinalized).length, pending: cards.filter(c => !c.allFinalized).length, pass: cards.filter(c => c.result === "PASS").length, fail: cards.filter(c => c.result === "FAIL").length } });
  } catch (err) { return handleErr(err, res); }
};
