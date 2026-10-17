import { prisma } from "../config";
import { Request, Response } from "../types";
import { handleErr } from "../utils";

const getSchoolId = (req: any): string | undefined =>
  req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId;

/**
 * Subject CRUD.
 * Subject belongs to a Class; the class determines the academic year.
 * School scoping is enforced on every query.
 */

const getSubjectClasses = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "schoolId is required" });
    }

    const academicYearId = String(req.query?.academicYearId ?? "").trim();
    if (!academicYearId) {
      return res.status(400).json({ message: "academicYearId is required" });
    }

    const academicYear = await prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
      select: { id: true },
    });
    if (!academicYear) {
      return res.status(404).json({ message: "Academic year not found" });
    }

    const classes = await prisma.class.findMany({
      where: { schoolId, academicYearId, isCompleted: false },
      select: {
        id: true,
        classNumber: true,
        displayName: true,
      },
      orderBy: { classNumber: "asc" },
    });

    return res.status(200).json({ academicYearId, classes });
  } catch (error) {
    return handleErr(error, res);
  }
};

const getSubjects = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "schoolId is required" });
    }

    const academicYearId = String(req.query?.academicYearId ?? "").trim();
    const classId = String(req.query?.classId ?? "").trim();

    const where: any = { schoolId };
    if (classId) {
      const selectedClass = await prisma.class.findFirst({
        where: {
          id: classId,
          schoolId,
          ...(academicYearId ? { academicYearId } : {}),
        },
        select: { id: true },
      });
      if (!selectedClass) {
        return res.status(404).json({ message: "Class not found for this school and academic year" });
      }
      where.classId = classId;
    } else if (academicYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true },
      });
      if (!year) {
        return res.status(404).json({ message: "Academic year not found" });
      }
      where.class = { academicYearId };
    }

    const subjects = await prisma.subject.findMany({
      where,
      include: {
        class: {
          select: { id: true, classNumber: true, displayName: true, academicYearId: true },
        },
      },
      orderBy: [{ class: { classNumber: "asc" } }, { name: "asc" }],
    });

    return res.status(200).json({ total: subjects.length, subjects });
  } catch (error) {
    return handleErr(error, res);
  }
};

type SubjectBody = {
  classId?: string;
  name?: string;
  code?: string;
  isOptional?: boolean;
};

const createSubject = async (
  req: Request<any, SubjectBody>,
  res: Response,
) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "schoolId is required" });
    }

    const classId = String(req.body?.classId ?? "").trim();
    const name = String(req.body?.name ?? "").trim();
    const code = String(req.body?.code ?? "").trim();
    const isOptional = req.body?.isOptional === true;

    if (!classId || !name || !code) {
      return res.status(400).json({ message: "classId, name and code are required" });
    }

    const classRecord = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    });
    if (!classRecord) {
      return res.status(404).json({ message: "Class not found for this school" });
    }

    const duplicate = await prisma.subject.findFirst({
      where: { schoolId, classId, code },
      select: { id: true },
    });
    if (duplicate) {
      return res.status(409).json({ message: "A subject with this code already exists for this class" });
    }

    const subject = await prisma.subject.create({
      data: { schoolId, classId, name, code, isOptional },
      include: {
        class: { select: { id: true, classNumber: true, displayName: true, academicYearId: true } },
      },
    });

    return res.status(201).json({ message: "Subject created successfully", subject });
  } catch (error) {
    return handleErr(error, res);
  }
};

const updateSubject = async (
  req: Request<any, SubjectBody>,
  res: Response,
) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "schoolId is required" });
    }

    const subjectId = String(req.params?.subjectId ?? "").trim();
    if (!subjectId) {
      return res.status(400).json({ message: "subjectId is required" });
    }

    const existing = await prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
      select: { id: true, classId: true },
    });
    if (!existing) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const classId = req.body?.classId === undefined
      ? existing.classId
      : String(req.body.classId).trim();
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const code = req.body?.code === undefined ? undefined : String(req.body.code).trim();
    const isOptional = req.body?.isOptional;

    if (!classId || (name !== undefined && !name) || (code !== undefined && !code)) {
      return res.status(400).json({ message: "classId, name and code cannot be empty" });
    }

    const classRecord = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    });
    if (!classRecord) {
      return res.status(404).json({ message: "Class not found for this school" });
    }

    const finalCode = code ?? undefined;
    if (finalCode) {
      const duplicate = await prisma.subject.findFirst({
        where: { schoolId, classId, code: finalCode, NOT: { id: subjectId } },
        select: { id: true },
      });
      if (duplicate) {
        return res.status(409).json({ message: "A subject with this code already exists for this class" });
      }
    }

    const data: any = { classId };
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (typeof isOptional === "boolean") data.isOptional = isOptional;

    const subject = await prisma.subject.update({
      where: { id: subjectId },
      data,
      include: {
        class: { select: { id: true, classNumber: true, displayName: true, academicYearId: true } },
      },
    });

    return res.status(200).json({ message: "Subject updated successfully", subject });
  } catch (error) {
    return handleErr(error, res);
  }
};

const deleteSubject = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ message: "schoolId is required" });
    }

    const subjectId = String(req.params?.subjectId ?? "").trim();
    if (!subjectId) {
      return res.status(400).json({ message: "subjectId is required" });
    }

    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, schoolId },
      select: { id: true },
    });
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // Related exam/timetable/mapping records may prevent deletion; handleErr
    // returns the project's standard error response if Prisma rejects it.
    await prisma.subject.delete({ where: { id: subjectId } });

    return res.status(200).json({ message: "Subject deleted successfully" });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const subjectControllers = {
  getSubjectClasses,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
};
