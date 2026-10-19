import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getSchoolId = (req: Request): string | undefined => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const gradeFor = (percentage: number) => percentage >= 90 ? "A+" : percentage >= 80 ? "A" : percentage >= 70 ? "B" : percentage >= 60 ? "C" : percentage >= 50 ? "D" : percentage >= 35 ? "E" : "F";

export const getReportCardAnalyticsOptions = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = req.query?.academicYearId?.toString();
    if (!schoolId || !academicYearId) return res.status(400).json({ message: "academicYearId is required." });
    const [academicYear, exams, classes] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true } }),
      prisma.exam.findMany({ where: { schoolId, academicYearId }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, type: true, termNumber: true, isPublished: true, examSubjects: { select: { classId: true } } } }),
      prisma.class.findMany({ where: { schoolId, academicYearId }, orderBy: { classNumber: "asc" }, select: { id: true, classNumber: true, displayName: true } }),
    ]);
    if (!academicYear) return res.status(404).json({ message: "Academic year not found." });
    return res.status(200).json({ academicYear, exams, classes });
  } catch (err) { return handleErr(err, res); }
};

export const getReportCardAnalytics = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = req.query?.academicYearId?.toString();
    const examId = req.query?.examId?.toString();
    const classId = req.query?.classId?.toString();
    if (!schoolId || !academicYearId || !examId || !classId) return res.status(400).json({ message: "academicYearId, examId and classId are required." });

    const [exam, classRecord, students] = await Promise.all([
      prisma.exam.findFirst({ where: { id: examId, schoolId, academicYearId }, select: { id: true, name: true, type: true, termNumber: true, isPublished: true, examSubjects: { where: { classId }, orderBy: { subject: { name: "asc" } }, select: { id: true, maxMarks: true, passingMarks: true, subject: { select: { id: true, name: true, code: true } } } } } }),
      prisma.class.findFirst({ where: { id: classId, schoolId, academicYearId }, select: { id: true, classNumber: true, displayName: true } }),
      prisma.student.findMany({ where: { schoolId, classId, status: "ACTIVE" }, orderBy: [{ rollNumber: "asc" }, { name: "asc" }], select: { id: true, name: true, sectionId: true } }),
    ]);
    if (!exam) return res.status(404).json({ message: "Exam not found for this academic year." });
    if (!classRecord) return res.status(404).json({ message: "Class not found for this academic year." });
    if (!exam.examSubjects.length) return res.status(404).json({ message: "No exam subjects are configured for this class." });

    const marks = students.length ? await prisma.mark.findMany({ where: { schoolId, studentId: { in: students.map(s => s.id) }, examSubjectId: { in: exam.examSubjects.map(s => s.id) } }, select: { studentId: true, examSubjectId: true, marksObtained: true, isAbsent: true, isFinalized: true } }) : [];
    const markMap = new Map(marks.map(m => [`${m.studentId}:${m.examSubjectId}`, m]));
    const cards = students.map(student => {
      const subjectRows = exam.examSubjects.map(es => {
        const mark = markMap.get(`${student.id}:${es.id}`);
        const obtained = mark?.isAbsent ? 0 : mark?.marksObtained ?? null;
        return { examSubjectId: es.id, subject: es.subject, maxMarks: es.maxMarks, passingMarks: es.passingMarks, obtained, isAbsent: Boolean(mark?.isAbsent), finalized: Boolean(mark?.isFinalized), complete: Boolean(mark?.isFinalized && (mark?.isAbsent || mark?.marksObtained !== null && mark?.marksObtained !== undefined)) };
      });
      const complete = subjectRows.length > 0 && subjectRows.every(s => s.complete);
      const totalMax = subjectRows.reduce((sum, s) => sum + s.maxMarks, 0);
      const totalObtained = subjectRows.reduce((sum, s) => sum + (s.obtained ?? 0), 0);
      const percentage = totalMax ? Number((100 * totalObtained / totalMax).toFixed(2)) : 0;
      const passed = complete && subjectRows.every(s => s.obtained !== null && s.obtained >= s.passingMarks && !s.isAbsent);
      return { studentId: student.id, studentName: student.name, sectionId: student.sectionId, complete, totalMax, totalObtained, percentage, grade: complete ? gradeFor(percentage) : null, result: !complete ? "PENDING" : passed ? "PASS" : "FAIL", subjectRows };
    });
    const completed = cards.filter(c => c.complete);
    const grades = ["A+", "A", "B", "C", "D", "E", "F"].map(grade => ({ grade, count: completed.filter(c => c.grade === grade).length }));
    const subjectAnalytics = exam.examSubjects.map(es => {
      const rows = cards.map(c => c.subjectRows.find(s => s.examSubjectId === es.id)!).filter(Boolean);
      const completeRows = rows.filter(r => r.complete && r.obtained !== null);
      const scores = completeRows.map(r => r.obtained as number);
      const totalMax = es.maxMarks;
      const avg = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;
      const passCount = completeRows.filter(r => !r.isAbsent && (r.obtained as number) >= r.passingMarks).length;
      return { subject: es.subject, maxMarks: totalMax, passingMarks: es.passingMarks, studentsWithFinalizedMarks: completeRows.length, averageMarks: avg, averagePercentage: avg === null || totalMax <= 0 ? null : Number((avg / totalMax * 100).toFixed(2)), highestMarks: scores.length ? Math.max(...scores) : null, lowestMarks: scores.length ? Math.min(...scores) : null, passCount, failCount: completeRows.length - passCount, passPercentage: completeRows.length ? Number((passCount / completeRows.length * 100).toFixed(2)) : null };
    });
    const averagePercentage = completed.length ? Number((completed.reduce((sum, c) => sum + c.percentage, 0) / completed.length).toFixed(2)) : null;
    const ranked = [...completed].sort((a, b) => b.totalObtained - a.totalObtained);
    const topStudents = ranked.slice(0, 5).map((r, i) => ({ rank: i + 1, studentId: r.studentId, studentName: r.studentName, percentage: r.percentage, totalObtained: r.totalObtained, totalMax: r.totalMax }));
    return res.status(200).json({ exam: { id: exam.id, name: exam.name, type: exam.type, termNumber: exam.termNumber, isPublished: exam.isPublished }, class: classRecord, summary: { activeStudents: students.length, completed: completed.length, pending: students.length - completed.length, passed: completed.filter(c => c.result === "PASS").length, failed: completed.filter(c => c.result === "FAIL").length, passPercentage: completed.length ? Number((completed.filter(c => c.result === "PASS").length / completed.length * 100).toFixed(2)) : null, averagePercentage }, gradeDistribution: grades, subjectAnalytics, topStudents });
  } catch (err) { return handleErr(err, res); }
};
