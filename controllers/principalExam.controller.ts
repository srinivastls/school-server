import { ExamType } from "@prisma/client";
import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getSchoolId = (req: Request): string | undefined =>
  req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId?.toString();

const getAcademicYearId = (req: Request): string | undefined =>
  req.query?.academicYearId?.toString() ?? req.body?.academicYearId?.toString();

const validDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const parseExamInput = (body: any, partial = false) => {
  const data: Record<string, unknown> = {};

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new Error("Exam name is required.");
    }
    data.name = body.name.trim();
  }

  if (!partial || body.type !== undefined) {
    if (typeof body.type !== "string" || !Object.values(ExamType).includes(body.type as ExamType)) {
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
    if (!validDate(body.startDate)) throw new Error("A valid start date is required.");
    data.startDate = new Date(body.startDate);
  }

  if (!partial || body.endDate !== undefined) {
    if (!validDate(body.endDate)) throw new Error("A valid end date is required.");
    data.endDate = new Date(body.endDate);
  }

  if (data.startDate && data.endDate && (data.startDate as Date) > (data.endDate as Date)) {
    throw new Error("End date must be on or after start date.");
  }

  return data;
};

const badRequest = (res: Response, message: string) =>
  res.status(400).json({ message });

export const principalExamControllers = {
  getOptions: async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const academicYearId = getAcademicYearId(req);
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });

      const academicYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, name: true, startDate: true, endDate: true },
      });
      if (!academicYear) return res.status(404).json({ message: "Academic year not found." });

      return res.status(200).json({
        academicYear,
        examTypes: Object.values(ExamType),
      });
    } catch (err) {
        return handleErr(err,res);
    }
  },

  getExams: async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const academicYearId = getAcademicYearId(req);
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });

      const exams = await prisma.exam.findMany({
        where: { schoolId, academicYearId },
        orderBy: [{ termNumber: "asc" }, { startDate: "asc" }, { name: "asc" }],
      });
      return res.status(200).json({ exams, total: exams.length });
    } catch (err) {
        return handleErr(err, res);
    }
  },

  createExam: async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const academicYearId = req.body?.academicYearId?.toString();
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });

      let data: Record<string, unknown>;
      try {
        data = parseExamInput(req.body);
      } catch (err: any) {
        return badRequest(res, err.message || "Invalid exam details.");
      }

      const academicYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true },
      });
      if (!academicYear) return res.status(404).json({ message: "Academic year not found." });

      const exam = await prisma.exam.create({
        data: {
          ...(data as any),
          schoolId,
          academicYearId,
        },
      });
      return res.status(201).json({ message: "Exam created successfully.", exam });
    } catch (err) {
        return handleErr(err, res);
    }
  },

  updateExam: async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const examId = req.params.examId;
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });
      if (!examId) return res.status(400).json({ message: "Exam ID is required." });

      let data: Record<string, unknown>;
      try {
        data = parseExamInput(req.body, true);
      } catch (err: any) {
        return badRequest(res, err.message || "Invalid exam details.");
      }
      if (Object.keys(data).length === 0) {
        return badRequest(res, "At least one exam field must be provided.");
      }

      const existing = await prisma.exam.findFirst({ where: { id: examId, schoolId } });
      if (!existing) return res.status(404).json({ message: "Exam not found." });

      const mergedStart = data.startDate ? data.startDate as Date : existing.startDate;
      const mergedEnd = data.endDate ? data.endDate as Date : existing.endDate;
      if (mergedStart > mergedEnd) return badRequest(res, "End date must be on or after start date.");

      const exam = await prisma.exam.update({ where: { id: examId }, data: data as any });
      return res.status(200).json({ message: "Exam updated successfully.", exam });
    } catch (err) {
        return handleErr(err, res);
    }
  },

  setPublished: async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const examId = req.params.examId;
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });

      const existing = await prisma.exam.findFirst({ where: { id: examId, schoolId } });
      if (!existing) return res.status(404).json({ message: "Exam not found." });

      const isPublished = req.body?.isPublished;
      if (typeof isPublished !== "boolean") {
        return badRequest(res, "isPublished must be a boolean.");
      }

      const exam = await prisma.exam.update({
        where: { id: examId },
        data: { isPublished },
      });
      return res.status(200).json({
        message: isPublished ? "Exam published successfully." : "Exam unpublished successfully.",
        exam,
      });
    } catch (err) {
        return handleErr(err, res);
    }
  },

  deleteExam: async (req: Request, res: Response) => {
    try {
      const schoolId = getSchoolId(req);
      const examId = req.params.examId;
      if (!schoolId) return res.status(400).json({ message: "School context is missing." });

      const existing = await prisma.exam.findFirst({ where: { id: examId, schoolId } });
      if (!existing) return res.status(404).json({ message: "Exam not found." });

      await prisma.exam.delete({ where: { id: examId } });
      return res.status(200).json({ message: "Exam deleted successfully." });
    } catch (err) {
        return handleErr(err, res);
    }
  },
};
