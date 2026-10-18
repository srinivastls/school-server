import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const schoolIdOf = (req: Request) =>
  req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();
const bad = (res: Response, message: string) => res.status(400).json({ message });

function parseBody(body: any, partial = false) {
  const data: Record<string, unknown> = {};
  for (const key of ["examId", "classId", "subjectId"] as const) {
    if (!partial || body[key] !== undefined) {
      if (typeof body[key] !== "string" || !body[key].trim()) throw new Error(`${key} is required.`);
      data[key] = body[key].trim();
    }
  }
  for (const key of ["maxMarks", "passingMarks"] as const) {
    if (!partial || body[key] !== undefined) {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < 0 || (key === "maxMarks" && value === 0))
        throw new Error(`${key} must be a valid ${key === "maxMarks" ? "positive" : "non-negative"} number.`);
      data[key] = value;
    }
  }
  if (!partial || body.weightage !== undefined) {
    if (body.weightage === "" || body.weightage === null) data.weightage = null;
    else if (body.weightage !== undefined) {
      const value = Number(body.weightage);
      if (!Number.isFinite(value) || value < 0) throw new Error("weightage must be a non-negative number.");
      data.weightage = value;
    }
  }
  const max = data.maxMarks as number | undefined;
  const passing = data.passingMarks as number | undefined;
  if (max !== undefined && passing !== undefined && passing > max)
    throw new Error("passingMarks cannot exceed maxMarks.");
  return data;
}

const includeDetails = {
  exam: { select: { id: true, name: true, type: true, termNumber: true, academicYearId: true } },
  class: { select: { id: true, classNumber: true, displayName: true, academicYearId: true } },
  subject: { select: { id: true, name: true, code: true, classId: true } },
};

async function validateReferences(schoolId: string, data: Record<string, unknown>) {
  const examId = data.examId as string;
  const classId = data.classId as string;
  const subjectId = data.subjectId as string;
  const [exam, classRow, subject] = await Promise.all([
    prisma.exam.findFirst({ where: { id: examId, schoolId }, select: { id: true, academicYearId: true } }),
    prisma.class.findFirst({ where: { id: classId }, select: { id: true, academicYearId: true } }),
    prisma.subject.findFirst({ where: { id: subjectId }, select: { id: true, classId: true } }),
  ]);
  if (!exam) return { error: "Exam not found for this school." };
  if (!classRow) return { error: "Class not found." };
  if (!subject) return { error: "Subject not found." };
  if (classRow.academicYearId !== exam.academicYearId)
    return { error: "The selected class does not belong to the exam's academic year." };
  if (subject.classId !== classId)
    return { error: "The selected subject does not belong to the selected class." };
  return { exam, classRow, subject };
}

export const principalExamSubjectControllers = {
  getOptions: async (req: Request, res: Response) => {
    try {
      const schoolId = schoolIdOf(req);
      const academicYearId = req.query?.academicYearId?.toString();
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });
      const [academicYear, exams] = await Promise.all([
        prisma.academicYear.findUnique({
          where: { id: academicYearId },
          select: { id: true, name: true, startDate: true, endDate: true },
        }),
        prisma.exam.findMany({
          where: { schoolId, academicYearId },
          select: { id: true, name: true, type: true, termNumber: true, startDate: true, endDate: true, isPublished: true },
          orderBy: [{ termNumber: "asc" }, { startDate: "asc" }],
        }),
      ]);
      if (!academicYear) return res.status(404).json({ message: "Academic year not found." });
      return res.status(200).json({ academicYear, exams });
    } catch (err) { return handleErr(err, res); }
  },

  getAll: async (req: Request, res: Response) => {
    try {
      const schoolId = schoolIdOf(req);
      const academicYearId = req.query?.academicYearId?.toString();
      const examId = req.query?.examId?.toString();
      const classId = req.query?.classId?.toString();
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });
      const examSubjects = await prisma.examSubject.findMany({
        where: {
          exam: { schoolId, academicYearId, ...(examId ? { id: examId } : {}) },
          ...(classId ? { classId } : {}),
        },
        include: includeDetails,
        orderBy: [{ exam: { termNumber: "asc" } }, { subject: { name: "asc" } }],
      });
      return res.status(200).json({ examSubjects, total: examSubjects.length });
    } catch (err) { return handleErr(err, res); }
  },

  create: async (req: Request, res: Response) => {
    try {
      const schoolId = schoolIdOf(req);
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      let data: Record<string, unknown>;
      try {
        data = parseBody(req.body);
        if ((data.passingMarks as number) > (data.maxMarks as number))
          throw new Error("passingMarks cannot exceed maxMarks.");
      } catch (err: any) { return bad(res, err.message || "Invalid assignment."); }

      const refs = await validateReferences(schoolId, data);
      if ("error" in refs) return res.status(400).json({ message: refs.error });
      const examSubject = await prisma.examSubject.create({ data: data as any, include: includeDetails });
      return res.status(201).json({ message: "Subject assigned to exam.", examSubject });
    } catch (err: any) {
      if (err?.code === "P2002") return res.status(409).json({ message: "This subject is already assigned to this exam and class." });
      return handleErr(err, res);
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const schoolId = schoolIdOf(req);
      const id = req.params.examSubjectId;
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      const existing = await prisma.examSubject.findFirst({
        where: { id, exam: { schoolId } },
        include: { exam: { select: { academicYearId: true } } },
      });
      if (!existing) return res.status(404).json({ message: "Exam subject assignment not found." });

      let data: Record<string, unknown>;
      try {
        data = parseBody(req.body, true);
        const max = (data.maxMarks as number | undefined) ?? existing.maxMarks;
        const passing = (data.passingMarks as number | undefined) ?? existing.passingMarks;
        if (passing > max) throw new Error("passingMarks cannot exceed maxMarks.");
      } catch (err: any) { return bad(res, err.message || "Invalid assignment."); }
      if (!Object.keys(data).length) return bad(res, "At least one field must be provided.");

      const refsData = {
        examId: (data.examId as string | undefined) ?? existing.examId,
        classId: (data.classId as string | undefined) ?? existing.classId,
        subjectId: (data.subjectId as string | undefined) ?? existing.subjectId,
      };
      const refs = await validateReferences(schoolId, refsData);
      if ("error" in refs) return res.status(400).json({ message: refs.error });
      const examSubject = await prisma.examSubject.update({ where: { id }, data: data as any, include: includeDetails });
      return res.status(200).json({ message: "Exam subject updated.", examSubject });
    } catch (err: any) {
      if (err?.code === "P2002") return res.status(409).json({ message: "This subject is already assigned to this exam and class." });
      return handleErr(err, res);
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      const schoolId = schoolIdOf(req);
      const id = req.params.examSubjectId;
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      const existing = await prisma.examSubject.findFirst({ where: { id, exam: { schoolId } }, select: { id: true } });
      if (!existing) return res.status(404).json({ message: "Exam subject assignment not found." });
      await prisma.examSubject.delete({ where: { id } });
      return res.status(200).json({ message: "Exam subject assignment deleted." });
    } catch (err) { return handleErr(err, res); }
  },
};
