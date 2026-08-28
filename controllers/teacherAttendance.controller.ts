import dayjs from "dayjs";

import { prisma } from "../config";

import {
  handleErr,
} from "../utils";

/* ============================================================
   TYPES
============================================================ */

type TeacherAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "ON_LEAVE";

type LeaveType =
  | "CL"
  | "SL"
  | "EL"
  | "LWP";

type MarkTeacherAttendanceItem = {
  teacherUserId: string;
  status: TeacherAttendanceStatus;
  leaveType?: LeaveType | null;
};

type MarkTeacherAttendanceBody = {
  date: string;
  attendance: MarkTeacherAttendanceItem[];
};


/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (
  req: any
): string | undefined => {
  return (
    req.user?.schoolId ??
    req.body?.schoolId ??
    req.query?.schoolId
  );
};


/* ============================================================
   VALIDATE DATE
============================================================ */

const parseDate = (
  value: string
): Date | null => {

  if (!value) {
    return null;
  }

  const parsed =
    dayjs(
      value,
      "DD/MM/YYYY",
      true
    );

  if (!parsed.isValid()) {
    return null;
  }

  return parsed
    .startOf("day")
    .toDate();
};


/* ============================================================
   MARK TEACHER ATTENDANCE
============================================================ */

const markTeacherAttendance =
  async (
    req: any,
    res: any
  ) => {

    try {

      const {
        date,
        attendance,
      }: MarkTeacherAttendanceBody =
        req.body;

      /* ------------------------------------------------------
         SCHOOL
      ------------------------------------------------------ */

      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }


      /* ------------------------------------------------------
         VALIDATE DATE
      ------------------------------------------------------ */

      const attendanceDate =
        parseDate(date);

      if (!attendanceDate) {
        return res.status(400).json({
          message:
            "Invalid date. Use DD/MM/YYYY",
        });
      }


      /* ------------------------------------------------------
         VALIDATE ATTENDANCE ARRAY
      ------------------------------------------------------ */

      if (
        !Array.isArray(
          attendance
        ) ||
        attendance.length === 0
      ) {
        return res.status(400).json({
          message:
            "Attendance data is required",
        });
      }


      /* ------------------------------------------------------
         VALID STATUSES
      ------------------------------------------------------ */

      const validStatuses: TeacherAttendanceStatus[] =
        [
          "PRESENT",
          "ABSENT",
          "HALF_DAY",
          "ON_LEAVE",
        ];

      const validLeaveTypes: LeaveType[] =
        [
          "CL",
          "SL",
          "EL",
          "LWP",
        ];


      /* ------------------------------------------------------
         DUPLICATE TEACHER CHECK
      ------------------------------------------------------ */

      const teacherIds =
        attendance.map(
          (item) =>
            item.teacherUserId
        );

      const uniqueTeacherIds =
        new Set(
          teacherIds
        );

      if (
        uniqueTeacherIds.size !==
        teacherIds.length
      ) {
        return res.status(400).json({
          message:
            "Duplicate teacher attendance entries found",
        });
      }


      /* ------------------------------------------------------
         VALIDATE EACH ENTRY
      ------------------------------------------------------ */

      for (
        const item of attendance
      ) {

        if (
          !item.teacherUserId
        ) {
          return res.status(400).json({
            message:
              "teacherUserId is required",
          });
        }


        if (
          !validStatuses.includes(
            item.status
          )
        ) {
          return res.status(400).json({
            message:
              `Invalid attendance status for teacher ${item.teacherUserId}`,
          });
        }


        /* ----------------------------------------------------
           LEAVE TYPE RULE
        ---------------------------------------------------- */

        if (
          item.status ===
          "ON_LEAVE"
        ) {

          if (
            !item.leaveType
          ) {
            return res.status(400).json({
              message:
                `Leave type is required for teacher ${item.teacherUserId}`,
            });
          }

          if (
            !validLeaveTypes.includes(
              item.leaveType
            )
          ) {
            return res.status(400).json({
              message:
                `Invalid leave type for teacher ${item.teacherUserId}`,
            });
          }

        } else {

          /*
           * Leave type should only exist
           * when status is ON_LEAVE.
           */

          if (
            item.leaveType !==
              null &&
            item.leaveType !==
              undefined
          ) {
            return res.status(400).json({
              message:
                `Leave type is only allowed for ON_LEAVE status`,
            });
          }

        }

      }


      /* ------------------------------------------------------
         VERIFY TEACHERS
      ------------------------------------------------------ */

      const teachers =
        await prisma.user.findMany({
          where: {
            id: {
              in:
                teacherIds,
            },

            schoolId,

            isActive: true,

            /*
             * Adjust this if your
             * RoleName enum uses another
             * teacher role name.
             */
            role: "TEACHER",
          },

          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
          },
        });


      /* ------------------------------------------------------
         CHECK ALL TEACHERS EXIST
      ------------------------------------------------------ */

      const foundTeacherIds =
        new Set(
          teachers.map(
            (teacher) =>
              teacher.id
          )
        );

      const missingTeacher =
        teacherIds.find(
          (id) =>
            !foundTeacherIds.has(
              id
            )
        );

      if (
        missingTeacher
      ) {
        return res.status(404).json({
          message:
            `Teacher not found: ${missingTeacher}`,
        });
      }


      /* ------------------------------------------------------
         MARKED BY USER
      ------------------------------------------------------ */

      const markedByUserId =
        req.user?.id;

      if (
        !markedByUserId
      ) {
        return res.status(401).json({
          message:
            "Authenticated user not found",
        });
      }


      /* ------------------------------------------------------
         VERIFY MARKING USER BELONGS
         TO SAME SCHOOL
      ------------------------------------------------------ */

      const markingUser =
        await prisma.user.findFirst({
          where: {
            id:
              markedByUserId,

            schoolId,

            isActive: true,
          },

          select: {
            id: true,
          },
        });

      if (
        !markingUser
      ) {
        return res.status(403).json({
          message:
            "You are not authorized to mark teacher attendance",
        });
      }


      /* ======================================================
         UPSERT ATTENDANCE
      ====================================================== */

      const results =
        await prisma.$transaction(
          async (tx) => {

            const saved = [];

            for (
              const item of attendance
            ) {

              const result =
                await tx.teacherAttendance.upsert(
                  {
                    where: {
                      schoolId_teacherUserId_date:
                        {
                          schoolId,

                          teacherUserId:
                            item.teacherUserId,

                          date:
                            attendanceDate,
                        },
                    },

                    create: {
                      schoolId,

                      teacherUserId:
                        item.teacherUserId,

                      date:
                        attendanceDate,

                      status:
                        item.status,

                      leaveType:
                        item.status ===
                        "ON_LEAVE"
                          ? item.leaveType
                          : null,

                      markedByUserId:
                        markedByUserId,
                    },

                    update: {
                      status:
                        item.status,

                      leaveType:
                        item.status ===
                        "ON_LEAVE"
                          ? item.leaveType
                          : null,

                      markedByUserId:
                        markedByUserId,
                    },

                    include: {
                      teacher: {
                        select: {
                          id: true,
                          name: true,
                          email: true,
                          employeeId: true,
                        },
                      },
                    },
                  }
                );

              saved.push(
                result
              );
            }

            return saved;
          }
        );


      /* ------------------------------------------------------
         RESPONSE
      ------------------------------------------------------ */

      return res.status(200).json({
        message:
          "Teacher attendance marked successfully",

        date,

        count:
          results.length,

        attendance:
          results,
      });

    } catch (error) {

      console.error(
        "MARK TEACHER ATTENDANCE ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   GET TEACHERS FOR ATTENDANCE
============================================================ */

const getTeachersForAttendance =
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


      const date =
        String(
          req.query?.date ??
          ""
        );

      const attendanceDate =
        parseDate(date);

      if (!attendanceDate) {
        return res.status(400).json({
          message:
            "Valid date is required. Use DD/MM/YYYY",
        });
      }


      /* ------------------------------------------------------
         ACTIVE TEACHERS
      ------------------------------------------------------ */

      const teachers =
        await prisma.user.findMany({
          where: {
            schoolId,

            role: "TEACHER",

            isActive: true,
          },

          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            employeeId: true,
            designation: true,
            department: true,

            teacherAttendances: {
              where: {
                schoolId,

                date:
                  attendanceDate,
              },

              select: {
                id: true,
                status: true,
                leaveType: true,
                markedByUserId: true,
                createdAt: true,
                updatedAt: true,
              },

              take: 1,
            },
          },

          orderBy: {
            name: "asc",
          },
        });


      /* ------------------------------------------------------
         RESPONSE
      ------------------------------------------------------ */

      const result =
        teachers.map(
          (teacher) => {

            const attendance =
              teacher
                .teacherAttendances?.[0] ??
              null;

            return {
              id:
                teacher.id,

              name:
                teacher.name,

              email:
                teacher.email,

              phone:
                teacher.phone,

              employeeId:
                teacher.employeeId,

              designation:
                teacher.designation,

              department:
                teacher.department,

              attendance:
                attendance
                  ? {
                      id:
                        attendance.id,

                      status:
                        attendance.status,

                      leaveType:
                        attendance.leaveType,

                      markedByUserId:
                        attendance.markedByUserId,

                      createdAt:
                        attendance.createdAt,

                      updatedAt:
                        attendance.updatedAt,
                    }
                  : null,
            };
          }
        );


      return res.status(200).json({
        date,

        totalTeachers:
          result.length,

        teachers:
          result,
      });

    } catch (error) {

      console.error(
        "GET TEACHERS ATTENDANCE ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };


/* ============================================================
   GET DAILY TEACHER ATTENDANCE
============================================================ */

const getDailyTeacherAttendance =
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


      const date =
        String(
          req.query?.date ??
          ""
        );

      const attendanceDate =
        parseDate(date);

      if (!attendanceDate) {
        return res.status(400).json({
          message:
            "Valid date is required. Use DD/MM/YYYY",
        });
      }


      const attendance =
        await prisma.teacherAttendance.findMany(
          {
            where: {
              schoolId,

              date:
                attendanceDate,
            },

            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  employeeId: true,
                  designation: true,
                  department: true,
                },
              },

              markedByUser: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },

            orderBy: {
              teacher: {
                name: "asc",
              },
            },
          }
        );


      /* ------------------------------------------------------
         SUMMARY
      ------------------------------------------------------ */

      const summary = {
        total:
          attendance.length,

        present:
          attendance.filter(
            (item) =>
              item.status ===
              "PRESENT"
          ).length,

        absent:
          attendance.filter(
            (item) =>
              item.status ===
              "ABSENT"
          ).length,

        halfDay:
          attendance.filter(
            (item) =>
              item.status ===
              "HALF_DAY"
          ).length,

        onLeave:
          attendance.filter(
            (item) =>
              item.status ===
              "ON_LEAVE"
          ).length,
      };


      return res.status(200).json({
        date,

        summary,

        attendance,
      });

    } catch (error) {

      console.error(
        "GET DAILY TEACHER ATTENDANCE ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };



/* ============================================================
   GET TEACHER ASSIGNED SECTIONS
============================================================ */

/**
 * GET /attendance/student/my-sections
 *
 * Returns sections assigned to the authenticated teacher
 * for the current academic year.
 */
const getTeacherAssignedSections = async (
  req: any,
  res: any
) => {
  try {
    /* --------------------------------------------------------
       AUTHENTICATED USER
    -------------------------------------------------------- */

    const teacherUserId =
      req.user?.id;

    if (!teacherUserId) {
      return res.status(401).json({
        message:
          "Authenticated teacher not found",
      });
    }


    /* --------------------------------------------------------
       SCHOOL
    -------------------------------------------------------- */

    const schoolId =
      req.user?.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        message:
          "schoolId is required",
      });
    }


    /* --------------------------------------------------------
       FIND CURRENT ACADEMIC YEAR
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       FIND TEACHER MAPPINGS
    -------------------------------------------------------- */

    const mappings =
      await prisma.teacherSubjectMapping.findMany({
        where: {
          schoolId,

          teacherUserId,

          academicYearId:
            academicYear.id,
        },

        include: {
          section: {
            include: {
              class: {
                select: {
                  id: true,
                  classNumber: true,
                  displayName: true,
                  academicYearId: true,
                  isCompleted: true,
                },
              },
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
            section: {
              class: {
                classNumber: "asc",
              },
            },
          },

          {
            section: {
              sectionName: "asc",
            },
          },
        ],
      });


    /* --------------------------------------------------------
       REMOVE DUPLICATE SECTIONS
       
       A teacher may teach multiple subjects in
       the same section.
    -------------------------------------------------------- */

    const sectionMap =
      new Map<string, any>();


    for (
      const mapping of mappings
    ) {

      const section =
        mapping.section;

      if (!section) {
        continue;
      }


      const classDetails =
        section.class;

      if (!classDetails) {
        continue;
      }


      /*
       * Ignore completed classes.
       */

      if (
        classDetails.isCompleted
      ) {
        continue;
      }


      if (
        !sectionMap.has(
          section.id
        )
      ) {

        sectionMap.set(
          section.id,
          {
            sectionId:
              section.id,

            sectionName:
              section.sectionName,

            classId:
              classDetails.id,

            classNumber:
              classDetails.classNumber,

            classDisplayName:
              classDetails.displayName,

            academicYearId:
              academicYear.id,

            academicYearName:
              academicYear.name,

            subjects: [],
          }
        );

      }


      const sectionData =
        sectionMap.get(
          section.id
        );


      /*
       * Include the subjects through
       * which the teacher is assigned.
       */

      if (
        mapping.subject &&
        !sectionData.subjects.some(
          (subject: any) =>
            subject.id ===
            mapping.subject.id
        )
      ) {

        sectionData.subjects.push({
          id:
            mapping.subject.id,

          name:
            mapping.subject.name,

          code:
            mapping.subject.code,
        });

      }

    }


    const sections =
      Array.from(
        sectionMap.values()
      );


    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({

      academicYear: {
        id:
          academicYear.id,

        name:
          academicYear.name,

        startDate:
          academicYear.startDate,

        endDate:
          academicYear.endDate,
      },

      totalSections:
        sections.length,

      sections,

    });

  } catch (error) {

    console.error(
      "GET TEACHER ASSIGNED SECTIONS ERROR:",
      error
    );

    return handleErr(
      error,
      res
    );

  }
};




/* ============================================================
   EXPORT
============================================================ */

export const teacherAttendanceControllers = {
  markTeacherAttendance,

  getTeachersForAttendance,

  getDailyTeacherAttendance,

  getTeacherAssignedSections,
};