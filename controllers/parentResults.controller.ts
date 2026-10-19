import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getSchoolId = (req: Request): string | undefined => req.user?.schoolId;
const getUserId = (req: Request): string | undefined => req.user?.id;

/** Returns only children explicitly linked to the authenticated parent account. */
export const getParentResultChildren = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const parentUserId = getUserId(req);
    if (!schoolId || !parentUserId) return res.status(401).json({ message: "Authenticated parent account is required." });

    const links = await prisma.studentParentLink.findMany({
      where: { parentUserId, student: { schoolId } },
      include: {
        student: {
          select: {
            id: true, name: true, admissionNo: true, rollNumber: true, photoUrl: true,
            class: { select: { id: true, classNumber: true, displayName: true } },
            section: { select: { id: true, sectionName: true } },
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { student: { name: "asc" } }],
    });

    return res.status(200).json({ children: links.map((link) => ({ ...link.student, relationship: link.relationship, isPrimary: link.isPrimary })) });
  } catch (err) {
    return handleErr(err, res);
  }
};

/** Parents can see marks only for their linked children, published exams, and finalized marks. */
export const getParentStudentResults = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const parentUserId = getUserId(req);
    const studentId = req.query?.studentId?.toString();
    if (!schoolId || !parentUserId || !studentId) {
      return res.status(400).json({ message: "studentId and an authenticated parent account are required." });
    }

    const link = await prisma.studentParentLink.findFirst({
      where: { parentUserId, studentId, student: { schoolId } },
      include: {
        student: {
          select: {
            id: true, name: true, admissionNo: true, rollNumber: true, photoUrl: true, classId: true,
            class: { select: { id: true, classNumber: true, displayName: true, academicYearId: true } },
            section: { select: { id: true, sectionName: true } },
          },
        },
      },
    });
    if (!link) return res.status(403).json({ message: "This student is not linked to your parent account." });

    const student = link.student;
    const exams = await prisma.exam.findMany({
      where: { schoolId, academicYearId: student.class.academicYearId, isPublished: true },
      orderBy: [{ termNumber: "asc" }, { startDate: "desc" }],
      include: {
        examSubjects: {
          where: { classId: student.classId },
          include: {
            subject: { select: { id: true, name: true, code: true } },
            marks: {
              where: { schoolId, studentId, isFinalized: true },
              select: { id: true, marksObtained: true, isAbsent: true, isFinalized: true, updatedAt: true },
            },
          },
        },
      },
    });

    const results = exams.map((exam) => {
      const subjects = exam.examSubjects.map((item) => {
        const mark = item.marks[0] ?? null;
        return {
          examSubjectId: item.id,
          subject: item.subject,
          maxMarks: item.maxMarks,
          passingMarks: item.passingMarks,
          marksObtained: mark?.marksObtained ?? null,
          isAbsent: mark?.isAbsent ?? false,
          isFinalized: Boolean(mark?.isFinalized),
          status: !mark ? "NOT_AVAILABLE" : mark.isAbsent ? "ABSENT" : (mark.marksObtained ?? -1) >= item.passingMarks ? "PASS" : "FAIL",
        };
      });
      const available = subjects.filter((subject) => subject.isFinalized);
      const totalObtained = available.reduce((sum, subject) => sum + (subject.isAbsent ? 0 : subject.marksObtained ?? 0), 0);
      const totalMax = subjects.reduce((sum, subject) => sum + subject.maxMarks, 0);
      const allAvailable = subjects.length > 0 && available.length === subjects.length;
      const passed = allAvailable && subjects.every((subject) => subject.status === "PASS");
      return {
        id: exam.id, name: exam.name, type: exam.type, termNumber: exam.termNumber,
        startDate: exam.startDate, endDate: exam.endDate,
        subjects,
        summary: {
          totalObtained: allAvailable ? totalObtained : null,
          totalMax,
          percentage: allAvailable && totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : null,
          result: !allAvailable ? "PENDING" : passed ? "PASS" : "FAIL",
        },
      };
    }).filter((exam) => exam.subjects.length > 0);

    return res.status(200).json({
      student: {
        id: student.id, name: student.name, admissionNo: student.admissionNo,
        rollNumber: student.rollNumber, photoUrl: student.photoUrl,
        class: student.class, section: student.section,
      },
      results,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};
