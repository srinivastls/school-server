import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import { prisma } from "../config";
import { handleErr } from "../utils";

dayjs.extend(customParseFormat);

/* ============================================================
   TYPES
============================================================ */

type LeaveType =
  | "CL"
  | "SL"
  | "EL"
  | "LWP";

type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";


/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (
  req: any
): string | undefined => {
  return req.user?.schoolId;
};


const parseDate = (
  value: string
): Date | null => {

  if (!value) {
    return null;
  }

  const parsed = dayjs(
    value,
    "DD/MM/YYYY",
    true
  );

  if (!parsed.isValid()) {
    return null;
  }

  return parsed.startOf("day").toDate();
};


/* ============================================================
   CREATE LEAVE REQUEST
============================================================ */

const createLeaveRequest =
  async (
    req: any,
    res: any
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      const requesterId =
        req.user?.id;

      if (!schoolId || !requesterId) {
        return res.status(401).json({
          message:
            "Authenticated user not found",
        });
      }

      const {
        fromDate,
        toDate,
        leaveType,
        reason,
      } = req.body;

      /* ------------------------------------------------------
         VALIDATE DATES
      ------------------------------------------------------ */

      const startDate =
        parseDate(
          String(fromDate ?? "")
        );

      const endDate =
        parseDate(
          String(toDate ?? "")
        );

      if (!startDate || !endDate) {
        return res.status(400).json({
          message:
            "Invalid dates. Use DD/MM/YYYY",
        });
      }

      if (
        dayjs(startDate).isAfter(
          dayjs(endDate)
        )
      ) {
        return res.status(400).json({
          message:
            "From date cannot be after to date",
        });
      }

      /* ------------------------------------------------------
         VALIDATE LEAVE TYPE
      ------------------------------------------------------ */

      const validLeaveTypes:
        LeaveType[] = [
          "CL",
          "SL",
          "EL",
          "LWP",
        ];

      if (
        !validLeaveTypes.includes(
          leaveType
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid leave type",
        });
      }

      /* ------------------------------------------------------
         CHECK USER
      ------------------------------------------------------ */

      const user =
        await prisma.user.findFirst({
          where: {
            id: requesterId,
            schoolId,
            isActive: true,
          },

          select: {
            id: true,
            role: true,
          },
        });

      if (!user) {
        return res.status(403).json({
          message:
            "User is not authorized",
        });
      }

      /* ------------------------------------------------------
         CHECK EXISTING PENDING LEAVE
      ------------------------------------------------------ */

      const existing =
        await prisma.leaveRequest.findFirst({
          where: {
            schoolId,

            teacherUserId: requesterId,

            status: "PENDING",

            OR: [
              {
                fromDate: {
                  lte: endDate,
                },

                toDate: {
                  gte: startDate,
                },
              },
            ],
          },
        });

      if (existing) {
        return res.status(409).json({
          message:
            "You already have a pending leave request for these dates",
        });
      }

      /* ------------------------------------------------------
         CREATE
      ------------------------------------------------------ */

      const leave =
        await prisma.leaveRequest.create({
          data: {
            schoolId,

            teacherUserId:
              requesterId,

            fromDate:
              startDate,

            toDate:
              endDate,

            leaveType,

            reason:
              reason?.trim() ||
              null,

            status:
              "PENDING",
          },

          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true,
                role: true,
              },
            },
          },
        });

      return res.status(201).json({
        message:
          "Leave request submitted successfully",

        leave,
      });

    } catch (error) {

      console.error(
        "CREATE LEAVE REQUEST ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   GET MY LEAVE REQUESTS
============================================================ */

const getMyLeaveRequests =
  async (
    req: any,
    res: any
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      const requesterId =
        req.user?.id;

      if (!schoolId || !requesterId) {
        return res.status(401).json({
          message:
            "Authenticated user not found",
        });
      }

      const leaves =
        await prisma.leaveRequest.findMany({
          where: {
            schoolId,
            teacherUserId: requesterId,
          },

          include: {
            approvedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },

          orderBy: {
            appliedAt: "desc",
          },
        });

      return res.status(200).json({
        leaves,
      });

    } catch (error) {

      console.error(
        "GET MY LEAVE REQUESTS ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   GET PENDING LEAVE REQUESTS
============================================================ */

const getPendingLeaveRequests =
  async (
    req: any,
    res: any
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }

      const leaves =
        await prisma.leaveRequest.findMany({
          where: {
            schoolId,
            status: "PENDING",
          },

          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                employeeId: true,
                designation: true,
                department: true,
                role: true,
              },
            },
          },

          orderBy: [
            {
              appliedAt: "asc",
            },
          ],
        });

      return res.status(200).json({
        total:
          leaves.length,

        leaves,
      });

    } catch (error) {

      console.error(
        "GET PENDING LEAVE REQUESTS ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   APPROVE / REJECT LEAVE
============================================================ */

const updateLeaveRequest =
  async (
    req: any,
    res: any
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      const approverId =
        req.user?.id;

      if (!schoolId || !approverId) {
        return res.status(401).json({
          message:
            "Authenticated user not found",
        });
      }

      const {
        id,
        status,
      } = req.body;

      if (!id) {
        return res.status(400).json({
          message:
            "Leave request id is required",
        });
      }

      if (
        status !== "APPROVED" &&
        status !== "REJECTED"
      ) {
        return res.status(400).json({
          message:
            "Status must be APPROVED or REJECTED",
        });
      }

      /* ------------------------------------------------------
         VERIFY APPROVER
      ------------------------------------------------------ */

      const approver =
        await prisma.user.findFirst({
          where: {
            id: approverId,

            schoolId,

            isActive: true,

            role: {
              in: [
                "ADMIN",
                "PRINCIPAL",
              ],
            },
          },

          select: {
            id: true,
            role: true,
          },
        });

      if (!approver) {
        return res.status(403).json({
          message:
            "You are not authorized to approve leave requests",
        });
      }

      /* ------------------------------------------------------
         FIND REQUEST
      ------------------------------------------------------ */

      const leave =
        await prisma.leaveRequest.findFirst({
          where: {
            id,

            schoolId,
          },
        });

      if (!leave) {
        return res.status(404).json({
          message:
            "Leave request not found",
        });
      }

      if (
        leave.status !==
        "PENDING"
      ) {
        return res.status(409).json({
          message:
            "This leave request has already been processed",
        });
      }

      /* ------------------------------------------------------
         UPDATE
      ------------------------------------------------------ */

      const updated =
        await prisma.leaveRequest.update({
          where: {
            id:
              leave.id,
          },

          data: {
            status,

            approvedByUserId:
              approverId,

            updatedAt:
              new Date(),
          },

          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true,
                role: true,
              },
            },

            approvedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });

      /* ======================================================
         AUTOMATICALLY CREATE TEACHER ATTENDANCE
         
         Only when leave is APPROVED.
      ====================================================== */

      if (
        status === "APPROVED" &&
        leave.teacherUserId
      ) {

        const requester =
          await prisma.user.findFirst({
            where: {
              id:
                leave.teacherUserId,

              schoolId,

              role: "TEACHER",
            },

            select: {
              id: true,
            },
          });

        if (requester) {

          let current =
            dayjs(
              leave.fromDate
            );

          const end =
            dayjs(
              leave.toDate
            );

          while (
            current.isSame(
              end,
              "day"
            )
          ) {

            await prisma.teacherAttendance.upsert(
              {
                where: {
                  schoolId_teacherUserId_date:
                    {
                      schoolId,

                      teacherUserId:
                        requester.id,

                      date:
                        current
                          .startOf(
                            "day"
                          )
                          .toDate(),
                    },
                },

                create: {
                  schoolId,

                  teacherUserId:
                    requester.id,

                  date:
                    current
                      .startOf(
                        "day"
                      )
                      .toDate(),

                  status:
                    "ON_LEAVE",

                  leaveType:
                    leave.leaveType,

                  markedByUserId:
                    approverId,
                },

                update: {
                  status:
                    "ON_LEAVE",

                  leaveType:
                    leave.leaveType,

                  markedByUserId:
                    approverId,
                },
              }
            );

            current =
              current.add(
                1,
                "day"
              );
          }
        }
      }

      return res.status(200).json({

        message:
          status === "APPROVED"
            ? "Leave approved successfully"
            : "Leave rejected successfully",

        leave:
          updated,
      });

    } catch (error) {

      console.error(
        "UPDATE LEAVE REQUEST ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   GET LEAVE HISTORY
============================================================ */

const getLeaveHistory =
  async (
    req: any,
    res: any
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }

      const {
        status,
        leaveType,
        requesterId,
        from,
        to,
      } = req.query;

      const where: any = {
        schoolId,
      };

      if (status) {
        where.status =
          String(status);
      }

      if (leaveType) {
        where.leaveType =
          String(leaveType);
      }

      if (requesterId) {
        where.requesterId =
          String(requesterId);
      }

      if (from && to) {

        const range =
          parseDateRange(
            String(from),
            String(to)
          );

        if (!range) {
          return res.status(400).json({
            message:
              "Invalid date range",
          });
        }

        where.fromDate = {
          lte: range.lte,
        };

        where.toDate = {
          gte: range.gte,
        };
      }

      const leaves =
        await prisma.leaveRequest.findMany({
          where,

          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true,
                employeeId: true,
                designation: true,
                department: true,
                role: true,
              },
            },

            approvedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },

          orderBy: {
            fromDate: "desc",
          },
        });

      return res.status(200).json({
        total:
          leaves.length,

        leaves,
      });

    } catch (error) {

      console.error(
        "GET LEAVE HISTORY ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   DATE RANGE HELPER
============================================================ */

const parseDateRange = (
  from: string,
  to: string
) => {

  const fromDate =
    parseDate(from);

  const toDate =
    parseDate(to);

  if (!fromDate || !toDate) {
    return null;
  }

  if (
    dayjs(fromDate).isAfter(
      dayjs(toDate)
    )
  ) {
    return null;
  }

  return {
    gte:
      fromDate,

    lte:
      dayjs(toDate)
        .endOf("day")
        .toDate(),
  };
};


/* ============================================================
   EXPORT
============================================================ */

export const leaveControllers = {

  createLeaveRequest,

  getMyLeaveRequests,

  getPendingLeaveRequests,

  updateLeaveRequest,

  getLeaveHistory,

};