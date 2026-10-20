import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getSchoolId = (req: Request): string | undefined =>
  req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();

export const getTeacherPerformanceTrendOptions = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = req.query?.academicYearId?.toString();
    const teacherUserId = req.user?.id;
    if (!schoolId || !academicYearId || !teacherUserId) return res.status(400).json({ message: "academicYearId is required." });

    const year = await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId }, select: { id: true, name: true } });
    if (!year) return res.status(404).json({ message: "Academic year not found." });
    const [classes, exams] = await Promise.all([
      prisma.class.findMany({ where: { schoolId, academicYearId, sections: { some: { schoolId, classTeacherId: teacherUserId } } }, orderBy: { classNumber: "asc" }, select: { id: true, classNumber: true, displayName: true } }),
      prisma.exam.findMany({ where: { schoolId, academicYearId, isPublished: true }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, termNumber: true, startDate: true } }),
    ]);
    return res.status(200).json({ academicYear: year, classes, exams });
  } catch (err) { return handleErr(err, res); }
};

export const getTeacherPerformanceTrends = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = req.query?.academicYearId?.toString();
    const classId = req.query?.classId?.toString();
    const studentId = req.query?.studentId?.toString();
    const teacherUserId = req.user?.id;
    if (!schoolId || !academicYearId || !classId || !teacherUserId) return res.status(400).json({ message: "academicYearId and classId are required." });

    const [classRecord, assignedSections, exams] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId, academicYearId, sections: { some: { schoolId, classTeacherId: teacherUserId } } }, select: { id: true, classNumber: true, displayName: true } }),
      prisma.section.findMany({ where: { schoolId, classId, classTeacherId: teacherUserId }, select: { id: true } }),
      prisma.exam.findMany({ where: { schoolId, academicYearId, isPublished: true }, orderBy: [{ termNumber: "asc" }, { startDate: "asc" }], select: { id: true, name: true, termNumber: true, startDate: true, examSubjects: { where: { classId }, orderBy: { subject: { name: "asc" } }, select: { id: true, maxMarks: true, passingMarks: true, subject: { select: { id: true, name: true, code: true } } } } } }),
    ]);
    if (!classRecord || !assignedSections.length) return res.status(404).json({ message: "This class is not assigned to you as a class teacher." });
    const students = await prisma.student.findMany({ where: { schoolId, classId, sectionId: { in: assignedSections.map(section => section.id) }, status: "ACTIVE" }, orderBy: [{ rollNumber: "asc" }, { name: "asc" }], select: { id: true, name: true, admissionNo: true, rollNumber: true, sectionId: true } });
    if (studentId && !students.some(student => student.id === studentId)) return res.status(404).json({ message: "Active student not found in the selected class." });

    const configuredExams = exams.filter(e => e.examSubjects.length > 0);
    const allSubjectIds = configuredExams.flatMap(e => e.examSubjects.map(s => s.id));
    const marks = students.length && allSubjectIds.length ? await prisma.mark.findMany({ where: { schoolId, studentId: { in: students.map(s => s.id) }, examSubjectId: { in: allSubjectIds }, isFinalized: true }, select: { studentId: true, examSubjectId: true, marksObtained: true, isAbsent: true } }) : [];
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
        const rows = studentRows.map(s => s.subjectRows.find(r => r.subjectId === subject.subject.id)!).filter(r => r.complete && r.obtained !== null);
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

    const subjectTrendMap = new Map<string, { subjectId: string; subjectName: string; points: { examName: string; percentage: number | null }[] }>();
    for (const exam of examTrends) {
      for (const subject of exam.subjectAverages) {
        const entry = subjectTrendMap.get(subject.subjectId) ?? { subjectId: subject.subjectId, subjectName: subject.subjectName, points: [] };
        entry.points.push({ examName: exam.examName, percentage: subject.averagePercentage });
        subjectTrendMap.set(subject.subjectId, entry);
      }
    }
    return res.status(200).json({ class: classRecord, student: selectedStudent, students: students.map(s => ({ id: s.id, name: s.name, admissionNo: s.admissionNo, rollNumber: s.rollNumber })), examTrends, studentTrend, subjectTrends: Array.from(subjectTrendMap.values()), studentCount: students.length });
  } catch (err) { return handleErr(err, res); }
};
