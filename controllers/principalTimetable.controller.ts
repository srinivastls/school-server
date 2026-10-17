import { prisma } from "../config";
import { Request, Response } from "../types";
import { handleErr } from "../utils";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
type Day = (typeof DAYS)[number];

type TimetableBody = {
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  teacherUserId?: string;
  dayOfWeek?: string;
  periodNumber?: number;
  startTime?: string;
  endTime?: string;
};

const getSchoolId = (req: any): string | undefined =>
  req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId;
const clean = (v: unknown): string => typeof v === "string" ? v.trim() : "";

const getAcademicYear = (schoolId: string, academicYearId: string) =>
  prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true },
  });

const validateEntry = async (schoolId: string, body: TimetableBody, existingId?: string) => {
  const academicYearId = clean(body.academicYearId);
  const classId = clean(body.classId);
  const sectionId = clean(body.sectionId);
  const subjectId = clean(body.subjectId);
  const teacherUserId = clean(body.teacherUserId);
  const day = clean(body.dayOfWeek).toUpperCase();
  const startTime = clean(body.startTime);
  const endTime = clean(body.endTime);
  const periodNumber = Number(body.periodNumber);

  if (!academicYearId || !classId || !sectionId || !subjectId || !teacherUserId ||
      !day || !startTime || !endTime || !Number.isInteger(periodNumber) || periodNumber < 1) {
    return { error: "academicYearId, classId, sectionId, subjectId, teacherUserId, dayOfWeek, periodNumber, startTime and endTime are required." } as const;
  }
  if (!DAYS.includes(day as Day)) {
    return { error: "Invalid dayOfWeek. Use MONDAY through SUNDAY." } as const;
  }

  // Timetable.academicYear stores the year NAME, while classes/mappings use the year ID.
  const year = await getAcademicYear(schoolId, academicYearId);
  if (!year) return { error: "Academic year not found." } as const;

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId, academicYearId, isCompleted: false },
    select: { id: true },
  });
  if (!cls) return { error: "Class not found for this academic year." } as const;

  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId, classId },
    select: { id: true },
  });
  if (!section) return { error: "Section does not belong to the selected class." } as const;

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId, classId },
    select: { id: true },
  });
  if (!subject) return { error: "Subject does not belong to the selected class." } as const;

  const teacher = await prisma.user.findFirst({
    where: { id: teacherUserId, schoolId, role: "TEACHER", isActive: true },
    select: { id: true },
  });
  if (!teacher) return { error: "Active teacher not found for this school." } as const;

  const mapping = await prisma.teacherSubjectMapping.findFirst({
    where: { schoolId, academicYearId, teacherUserId, subjectId, sectionId },
    select: { id: true },
  });
  if (!mapping) {
    return { error: "This teacher is not assigned to the selected subject and section for this academic year." } as const;
  }

  const validTime = (v: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

if (
  !validTime(startTime) ||
  !validTime(endTime) ||
  startTime >= endTime
) {
  return {
    error:
      "Use valid 24-hour HH:mm times and ensure startTime is earlier than endTime.",
  } as const;
}

  const timetableYear = year.name;
  const duplicate = await prisma.timetable.findFirst({
    where: {
      schoolId, sectionId, academicYear: timetableYear,
      dayOfWeek: day as any, periodNumber,
      ...(existingId ? { NOT: { id: existingId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return { error: "This section already has an entry for that day and period.", status: 409 } as const;

  const teacherConflict = await prisma.timetable.findFirst({
    where: {
      schoolId, teacherUserId, academicYear: timetableYear,
      dayOfWeek: day as any, periodNumber,
      ...(existingId ? { NOT: { id: existingId } } : {}),
    },
    select: { id: true },
  });
  if (teacherConflict) {
    return { error: "This teacher is already assigned to another class or section during that period.", status: 409 } as const;
  }

  return { value: {
    schoolId, classId, sectionId, subjectId, teacherUserId,
    academicYear: timetableYear, dayOfWeek: day as any,
    periodNumber, startTime, endTime,
  } } as const;
};

const entryInclude = {
  class: { select: { id: true, classNumber: true, displayName: true } },
  section: { select: { id: true, sectionName: true } },
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, name: true, email: true, employeeId: true, designation: true } },
};

const getTimetableOptions = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = clean(req.query?.academicYearId);
    if (!schoolId) return res.status(400).json({ message: "schoolId is required." });
    if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });
    const academicYear = await getAcademicYear(schoolId, academicYearId);
    if (!academicYear) return res.status(404).json({ message: "Academic year not found." });

    const [classes, teachers, mappings] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId, academicYearId, isCompleted: false },
        select: {
          id: true, classNumber: true, displayName: true,
          subjects: { select: { id: true, name: true, code: true, isOptional: true }, orderBy: { name: "asc" } },
          sections: { select: { id: true, sectionName: true }, orderBy: { sectionName: "asc" } },
        },
        orderBy: { classNumber: "asc" },
      }),
      prisma.user.findMany({
        where: { schoolId, role: "TEACHER", isActive: true },
        select: { id: true, name: true, email: true, employeeId: true, designation: true },
        orderBy: { name: "asc" },
      }),
      prisma.teacherSubjectMapping.findMany({
        where: { schoolId, academicYearId },
        select: { id: true, teacherUserId: true, subjectId: true, sectionId: true },
      }),
    ]);
    return res.status(200).json({ academicYear, classes, teachers, mappings });
  } catch (error) {
    return handleErr(error, res);
  }
};

const getPrincipalTimetable = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const academicYearId = clean(req.query?.academicYearId);
    const classId = clean(req.query?.classId);
    const sectionId = clean(req.query?.sectionId);
    if (!schoolId) return res.status(400).json({ message: "schoolId is required." });
    if (!academicYearId) return res.status(400).json({ message: "academicYearId is required." });
    const year = await getAcademicYear(schoolId, academicYearId);
    if (!year) return res.status(404).json({ message: "Academic year not found." });

    if (classId) {
      const cls = await prisma.class.findFirst({ where: { id: classId, schoolId, academicYearId }, select: { id: true } });
      if (!cls) return res.status(404).json({ message: "Class not found for this academic year." });
    }
    if (sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: sectionId, schoolId, ...(classId ? { classId } : {}) },
        select: { id: true },
      });
      if (!section) return res.status(404).json({ message: "Section not found for the selected class." });
    }

    const entries = await prisma.timetable.findMany({
      where: {
        schoolId, academicYear: year.name,
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
      include: entryInclude,
      orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }],
    });
    return res.status(200).json({ academicYear: year, total: entries.length, entries });
  } catch (error) {
    return handleErr(error, res);
  }
};

const createTimetableEntry = async (req: Request<any, TimetableBody>, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    if (!schoolId) return res.status(400).json({ message: "schoolId is required." });
    const result = await validateEntry(schoolId, req.body, undefined);
    if ("error" in result) return res.status(result.status ?? 400).json({ message: result.error });
    const entry = await prisma.timetable.create({ data: result.value, include: entryInclude });
    return res.status(201).json({ message: "Timetable entry created successfully.", entry });
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "A timetable entry already exists for this section, day, and period." });
    return handleErr(error, res);
  }
};

const updateTimetableEntry = async (req: Request<any, TimetableBody>, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const timetableId = clean(req.params?.timetableId);
    if (!schoolId) return res.status(400).json({ message: "schoolId is required." });
    if (!timetableId) return res.status(400).json({ message: "timetableId is required." });
    const existing = await prisma.timetable.findFirst({ where: { id: timetableId, schoolId }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: "Timetable entry not found." });

    const result = await validateEntry(schoolId, req.body, timetableId);
    if ("error" in result) return res.status(result.status ?? 400).json({ message: result.error });
    const entry = await prisma.timetable.update({ where: { id: timetableId }, data: result.value, include: entryInclude });
    return res.status(200).json({ message: "Timetable entry updated successfully.", entry });
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ message: "A timetable entry already exists for this section, day, and period." });
    return handleErr(error, res);
  }
};

const deleteTimetableEntry = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const timetableId = clean(req.params?.timetableId);
    if (!schoolId) return res.status(400).json({ message: "schoolId is required." });
    if (!timetableId) return res.status(400).json({ message: "timetableId is required." });
    const existing = await prisma.timetable.findFirst({ where: { id: timetableId, schoolId }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: "Timetable entry not found." });
    await prisma.timetable.delete({ where: { id: existing.id } });
    return res.status(200).json({ message: "Timetable entry deleted successfully." });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const principalTimetableControllers = {
  getTimetableOptions,
  getPrincipalTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
};
