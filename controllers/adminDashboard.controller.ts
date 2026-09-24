import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

/**
 * Safely convert a monetary string into a number.
 *
 * Examples:
 * "1500"      -> 1500
 * "1,500.50"  -> 1500.50
 * undefined   -> 0
 */
const parseAmount = (value: unknown): number => {
  if (typeof value !== "string" && typeof value !== "number") {
    return 0;
  }

  const normalizedValue = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

/**
 * Get start of a day in local server time.
 */
const startOfDay = (date: Date): Date => {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
};

/**
 * Get start of the next day.
 */
const startOfNextDay = (date: Date): Date => {
  const result = startOfDay(date);

  result.setDate(result.getDate() + 1);

  return result;
};

/**
 * Get start of the current week.
 *
 * Week starts on Monday.
 */
const startOfWeek = (date: Date): Date => {
  const result = startOfDay(date);

  const day = result.getDay();

  const daysFromMonday = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - daysFromMonday);

  return result;
};

/**
 * Get start of the current month.
 */
const startOfMonth = (date: Date): Date => {
  const result = startOfDay(date);

  result.setDate(1);

  return result;
};

/**
 * Sum transaction amounts.
 */
const sumTransactionAmounts = (
  transactions: Array<{ amount: string }>
): number => {
  return transactions.reduce((total, transaction) => {
    return total + parseAmount(transaction.amount);
  }, 0);
};

/**
 * School Admin Dashboard
 *
 * Collection calculations are based on Transaction.createdAt
 * because Transaction.date is stored as a String and its format
 * has not yet been standardized.
 */
export const getAdminDashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(401).json({
        message: "School context not found",
      });
    }

    /**
     * Role authorization
     *
     * This endpoint is intended for School Admin.
     */
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only school admins can access this dashboard",
      });
    }

    const now = new Date();

    const todayStart = startOfDay(now);
    const tomorrowStart = startOfNextDay(now);

    const weekStart = startOfWeek(now);

    const monthStart = startOfMonth(now);

    /**
     * Execute independent database queries in parallel.
     */
    const currentAcademicYear = await prisma.academicYear.findFirst({
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

    const [
      todayTransactions,
      weekTransactions,
      monthTransactions,
      totalStudents,
      totalTeachers,
      teacherAttendance,
      pendingLeaveApprovals,
    ] = await Promise.all([
      /**
       * Today's transactions
       */
      prisma.transaction.findMany({
        where: {
          schoolId,
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: {
          amount: true,
        },
      }),

      /**
       * Current week's transactions
       */
      prisma.transaction.findMany({
        where: {
          schoolId,
          createdAt: {
            gte: weekStart,
            lt: tomorrowStart,
          },
        },
        select: {
          amount: true,
        },
      }),

      /**
       * Current month's transactions
       */
      prisma.transaction.findMany({
        where: {
          schoolId,
          createdAt: {
            gte: monthStart,
            lt: tomorrowStart,
          },
        },
        select: {
          amount: true,
        },
      }),

      /**
       * Students enrolled in the current academic year.
       *
       * We use enrollment records instead of counting the
       * Student table directly.
       */
      currentAcademicYear
        ? prisma.studentAcademicEnrollment.count({
            where: {
              schoolId,
              academicYearId: currentAcademicYear.id,
              enrollmentStatus: {
                not: "LEFT",
              },
            },
          })
        : prisma.student.count({
            where: {
              schoolId,
            },
          }),

      /**
       * Active teachers
       */
      prisma.user.count({
        where: {
          schoolId,
          role: "TEACHER",
          isActive: true,
        },
      }),

      /**
       * Today's teacher attendance
       */
      prisma.teacherAttendance.findMany({
        where: {
          schoolId,
          date: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: {
          status: true,
        },
      }),

      /**
       * Pending teacher leave approvals
       */
      prisma.leaveRequest.count({
        where: {
          schoolId,
          status: "PENDING",
        },
      }),
    ]);

    /**
     * Calculate collection values.
     */
    const todayCollection = sumTransactionAmounts(
      todayTransactions
    );

    const weeklyCollection = sumTransactionAmounts(
      weekTransactions
    );

    const monthlyCollection = sumTransactionAmounts(
      monthTransactions
    );

    /**
     * Calculate teacher attendance.
     */
    const presentToday = teacherAttendance.filter(
      (record) => record.status === "PRESENT"
    ).length;

    const absentToday = teacherAttendance.filter(
      (record) => record.status === "ABSENT"
    ).length;

    const halfDayToday = teacherAttendance.filter(
      (record) => record.status === "HALF_DAY"
    ).length;

    const onLeaveToday = teacherAttendance.filter(
      (record) => record.status === "ON_LEAVE"
    ).length;

    /**
     * Return dashboard response.
     *
     * Pending fees are deliberately returned as null until
     * the fee ledger calculation is implemented.
     */
    return res.status(200).json({
      message: "Admin dashboard fetched successfully",

      data: {
        financial: {
          todayCollection,
          weeklyCollection,
          monthlyCollection,

          pendingFees: null,
          defaultersCount: null,
        },

        students: {
          total: totalStudents,
        },

        teachers: {
          total: totalTeachers,
          presentToday,
          absentToday,
          halfDayToday,
          onLeaveToday,
        },

        operations: {
          pendingLeaveApprovals,
        },

        academicYear: currentAcademicYear
          ? {
              id: currentAcademicYear.id,
              name: currentAcademicYear.name,
              startDate: currentAcademicYear.startDate,
              endDate: currentAcademicYear.endDate,
            }
          : null,

        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleErr(error, res);
  }
};