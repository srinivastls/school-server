import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getSchoolId = (req: Request): string | undefined =>
  req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();

const getAcademicYearId = (req: Request): string | undefined =>
  req.query?.academicYearId?.toString() ?? req.body?.academicYearId?.toString();

/** Principal dashboard: exams and publication/completion status for one academic year. */
export const getPrincipalResultsOptions = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = getAcademicYearId(req);
    if (!schoolId || !academicYearId) {
      return res.status(400).json({ message: "schoolId and academicYearId are required." });
    }

    const exams = await prisma.exam.findMany({
      where: { schoolId, academicYearId },
      orderBy: [{ termNumber: "asc" }, { startDate: "desc" }],
      include: {
        examSubjects: {
          select: {
            id: true,
            classId: true,
            class: { select: { id: true, classNumber: true, displayName: true } },
            subject: { select: { id: true, name: true, code: true } },
            marks: { select: { isFinalized: true, isAbsent: true, marksObtained: true } },
          },
        },
      },
    });

    const result = exams.map((exam) => {
      const assignments = exam.examSubjects;
      const marks = assignments.flatMap((item) => item.marks);
      return {
        id: exam.id,
        name: exam.name,
        type: exam.type,
        termNumber: exam.termNumber,
        startDate: exam.startDate,
        endDate: exam.endDate,
        isPublished: exam.isPublished,
        classCount: new Set(assignments.map((item) => item.classId)).size,
        subjectAssignmentCount: assignments.length,
        totalMarksRecords: marks.length,
        finalizedMarksCount: marks.filter((mark) => mark.isFinalized).length,
        pendingMarksCount: marks.filter((mark) => !mark.isFinalized).length,
        classes: Array.from(
          new Map(assignments.map((item) => [item.class.id, item.class])).values(),
        ),
      };
    });

    return res.status(200).json({ exams: result });
  } catch (err) {
    return handleErr(err, res);
  }
};

/** Principal report: marks and computed totals for the students in each class assignment. */
export const getPrincipalExamResults = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = getAcademicYearId(req);
    const examId = req.params.examId;
    if (!schoolId || !academicYearId || !examId) {
      return res.status(400).json({ message: "schoolId, academicYearId and examId are required." });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId, academicYearId },
      include: {
        examSubjects: {
          include: {
            class: { select: { id: true, classNumber: true, displayName: true } },
            subject: { select: { id: true, name: true, code: true } },
            marks: {
              where: { schoolId },
              include: {
                student: {
                  select: { id: true, name: true, admissionNo: true, rollNumber: true, sectionId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) return res.status(404).json({ message: "Exam not found." });

    const classMap = new Map<string, any>();
    for (const assignment of exam.examSubjects) {
      if (!classMap.has(assignment.classId)) {
        classMap.set(assignment.classId, {
          ...assignment.class,
          subjects: [],
          students: new Map<string, any>(),
        });
      }
      const classResult = classMap.get(assignment.classId);
      classResult.subjects.push({
        examSubjectId: assignment.id,
        subject: assignment.subject,
        maxMarks: assignment.maxMarks,
        passingMarks: assignment.passingMarks,
      });

      for (const mark of assignment.marks) {
        const studentId = mark.student.id;
        if (!classResult.students.has(studentId)) {
          classResult.students.set(studentId, {
            id: studentId,
            name: mark.student.name,
            admissionNo: mark.student.admissionNo,
            rollNumber: mark.student.rollNumber,
            sectionId: mark.student.sectionId,
            subjects: {},
          });
        }
        classResult.students.get(studentId).subjects[assignment.id] = {
          markId: mark.id,
          marksObtained: mark.marksObtained,
          isAbsent: mark.isAbsent,
          isFinalized: mark.isFinalized,
          maxMarks: assignment.maxMarks,
          passingMarks: assignment.passingMarks,
        };
      }
    }

    const classes = Array.from(classMap.values()).map((classResult) => {
      const subjects = classResult.subjects;
      const students = Array.from(classResult.students.values()).map((student: any) => {
        const applicable = subjects.map((subject: any) => student.subjects[subject.examSubjectId]);
        const completed = applicable.filter((item: any) => item?.isFinalized && item.marksObtained !== null);
        const totalObtained = completed.reduce((sum: number, item: any) => sum + (item.isAbsent ? 0 : item.marksObtained ?? 0), 0);
        const totalMax = subjects.reduce((sum: number, item: any) => sum + item.maxMarks, 0);
        const allFinalized = applicable.length > 0 && applicable.every((item: any) => item?.isFinalized);
        const passed = allFinalized && subjects.every((subject: any) => {
          const item = student.subjects[subject.examSubjectId];
          return item && !item.isAbsent && (item.marksObtained ?? -1) >= subject.passingMarks;
        });
        return {
          ...student,
          totalObtained,
          totalMax,
          percentage: totalMax > 0 && allFinalized ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : null,
          result: !allFinalized ? "PENDING" : passed ? "PASS" : "FAIL",
        };
      }).sort((a: any, b: any) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name));
      return { id: classResult.id, classNumber: classResult.classNumber, displayName: classResult.displayName, subjects, students };
    });

    return res.status(200).json({
      exam: { id: exam.id, name: exam.name, type: exam.type, termNumber: exam.termNumber, isPublished: exam.isPublished, startDate: exam.startDate, endDate: exam.endDate },
      classes,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/** Publish only when every active student in each assigned class has finalized marks for every assigned subject. */
export const setPrincipalExamResultsPublished = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = getAcademicYearId(req);
    const examId = req.params.examId;
    const isPublished = req.body?.isPublished;
    if (!schoolId || !academicYearId || !examId || typeof isPublished !== "boolean") {
      return res.status(400).json({ message: "schoolId, academicYearId, examId and boolean isPublished are required." });
    }

    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId, academicYearId },
      include: { examSubjects: { select: { id: true, classId: true } } },
    });
    if (!exam) return res.status(404).json({ message: "Exam not found." });

    if (isPublished) {
      if (!exam.examSubjects.length) {
        return res.status(400).json({ message: "Add exam subjects before publishing results." });
      }
      for (const assignment of exam.examSubjects) {
        const studentCount = await prisma.student.count({
          where: { schoolId, classId: assignment.classId, status: "ACTIVE" },
        });
        const finalizedCount = await prisma.mark.count({
          where: { schoolId, examSubjectId: assignment.id, isFinalized: true },
        });
        if (finalizedCount !== studentCount) {
          return res.status(409).json({
            message: "Results cannot be published until every active student has finalized marks for every assigned subject.",
            examSubjectId: assignment.id,
            expectedStudents: studentCount,
            finalizedMarks: finalizedCount,
          });
        }
      }
    }

    const updated = await prisma.exam.update({ where: { id: exam.id }, data: { isPublished } });
    return res.status(200).json({ message: isPublished ? "Results published." : "Results unpublished.", exam: updated });
  } catch (err) {
    return handleErr(err, res);
  }
};
