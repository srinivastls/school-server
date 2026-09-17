import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

/**
 * GET /api/v1/teacher-timetable/my-timetable
 *
 * Returns the logged-in teacher's timetable
 * for the current academic year.
 *
 * Optional:
 *   ?day=MONDAY
 */
const getMyTimetable = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        message: "School information is missing",
      });
    }

    /*
     * Get current academic year.
     */
    const academicYear =
      await prisma.academicYear.findFirst({
        where: {
          schoolId,
          isCurrent: true,
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
        },
      });

    if (!academicYear) {
      return res.status(404).json({
        message:
          "Current academic year not found",
      });
    }

    /*
     * Timetable stores academicYear as String,
     * so we use academicYear.name.
     */
    const academicYearValue =
      academicYear.name;

    /*
     * Optional day filter.
     */
    const dayParam =
      typeof req.query.day === "string"
        ? req.query.day.toUpperCase()
        : undefined;

    if (
      dayParam &&
      !DAYS.includes(dayParam as any)
    ) {
      return res.status(400).json({
        message:
          "Invalid day. Use MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY or SUNDAY",
      });
    }

    const timetable =
      await prisma.timetable.findMany({
        where: {
          schoolId,
          teacherUserId,
          academicYear: academicYearValue,

          ...(dayParam
            ? {
                dayOfWeek:
                  dayParam as any,
              }
            : {}),
        },

        include: {
          class: {
            select: {
              id: true,
              classNumber: true,
              displayName: true,
              isCompleted: true,
            },
          },

          section: {
            select: {
              id: true,
              sectionName: true,
              classTeacherId: true,
            },
          },

          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },

        orderBy: [
          {
            dayOfWeek: "asc",
          },
          {
            periodNumber: "asc",
          },
        ],
      });

    /*
     * Ignore timetable entries belonging to
     * completed classes.
     */
    const activeTimetable =
      timetable.filter(
        (item) => !item.class.isCompleted
      );

    /*
     * Organize by day.
     */
    const weeklyTimetable = DAYS.map(
      (day) => ({
        day,
        entries: activeTimetable
          .filter(
            (item) =>
              item.dayOfWeek === day
          )
          .sort(
            (a, b) =>
              a.periodNumber -
              b.periodNumber
          )
          .map((item) => ({
            id: item.id,

            periodNumber:
              item.periodNumber,

            startTime:
              item.startTime,

            endTime:
              item.endTime,

            dayOfWeek:
              item.dayOfWeek,

            class: {
              id: item.class.id,
              classNumber:
                item.class.classNumber,
              displayName:
                item.class.displayName,
            },

            section: {
              id: item.section.id,
              sectionName:
                item.section.sectionName,
            },

            subject: {
              id: item.subject.id,
              name: item.subject.name,
              code: item.subject.code,
            },
          })),
      })
    );

    /*
     * Today's day.
     */
    const today = new Date();

    /*
     * JS:
     * 0 Sunday
     * 1 Monday
     * ...
     * 6 Saturday
     */
    const jsDay =
      today.getDay();

    const todayDay =
      DAYS[
        jsDay === 0
          ? 6
          : jsDay - 1
      ];

    return res.status(200).json({
      academicYear: {
        id: academicYear.id,
        name: academicYear.name,
        startDate:
          academicYear.startDate,
        endDate:
          academicYear.endDate,
      },

      today: todayDay,

      totalPeriods:
        activeTimetable.length,

      timetable:
        weeklyTimetable,
    });
  } catch (error) {
    console.error(
      "GET MY TEACHER TIMETABLE ERROR:",
      error
    );

    return handleErr(
      error,
      res
    );
  }
};

export {
  getMyTimetable,
};