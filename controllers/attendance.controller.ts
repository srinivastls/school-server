import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import { prisma } from "../config";
import { handleErr } from "../utils";

dayjs.extend(customParseFormat);

/* ============================================================
   TYPES
============================================================ */

type AttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "HOLIDAY";

type StudentAttendanceItem = {
  studentId: string;
  status: AttendanceStatus;
  remark?: string | null;
};

type MarkStudentAttendanceBody = {
  classId: string;
  sectionId: string;
  date: string;
  attendance: StudentAttendanceItem[];
};


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

  return parsed
    .startOf("day")
    .toDate();
};


/* ============================================================
   GET STUDENTS FOR ATTENDANCE
============================================================ */



/* ============================================================
   MARK / UPDATE STUDENT ATTENDANCE
============================================================ */

const markStudentAttendance =
  async (
    req: any,
    res: any
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      const markedByUserId =
        req.user?.id;

      if (
        !schoolId ||
        !markedByUserId
      ) {
        return res.status(401).json({
          message:
            "Authenticated user not found",
        });
      }

      const {
        classId,
        sectionId,
        date,
        attendance,
      }: MarkStudentAttendanceBody =
        req.body;

      /* ======================================================
         VALIDATE BASIC DATA
      ====================================================== */

      if (
        !classId ||
        !sectionId
      ) {
        return res.status(400).json({
          message:
            "classId and sectionId are required",
        });
      }

      const attendanceDate =
        parseDate(date);

      if (!attendanceDate) {
        return res.status(400).json({
          message:
            "Invalid date. Use DD/MM/YYYY",
        });
      }

      if (
        !Array.isArray(attendance) ||
        attendance.length === 0
      ) {
        return res.status(400).json({
          message:
            "Attendance data is required",
        });
      }

      /* ======================================================
         VALID STATUS
      ====================================================== */

      const validStatuses:
        AttendanceStatus[] = [

          "PRESENT",

          "ABSENT",

          "LATE",

          "HALF_DAY",

          "HOLIDAY",

        ];

      for (
        const item of attendance
      ) {

        if (!item.studentId) {
          return res.status(400).json({
            message:
              "studentId is required",
          });
        }

        if (
          !validStatuses.includes(
            item.status
          )
        ) {
          return res.status(400).json({
            message:
              `Invalid attendance status for student ${item.studentId}`,
          });
        }
      }

      /* ======================================================
         DUPLICATES
      ====================================================== */

      const studentIds =
        attendance.map(
          item =>
            item.studentId
        );

      const uniqueStudentIds =
        new Set(studentIds);

      if (
        uniqueStudentIds.size !==
        studentIds.length
      ) {
        return res.status(400).json({
          message:
            "Duplicate student attendance entries found",
        });
      }

      /* ======================================================
         VERIFY MARKING USER
      ====================================================== */

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
            role: true,
          },
        });

      if (!markingUser) {
        return res.status(403).json({
          message:
            "You are not authorized to mark attendance",
        });
      }

      /* ======================================================
         VERIFY CLASS
      ====================================================== */

      const classDetails =
        await prisma.class.findFirst({
          where: {
            id:
              classId,

            schoolId,

            isCompleted: false,
          },

          select: {
            id: true,
            academicYearId: true,
            classNumber: true,
            displayName: true,
          },
        });

      if (!classDetails) {
        return res.status(404).json({
          message:
            "Class not found",
        });
      }

      /* ======================================================
         VERIFY SECTION
      ====================================================== */

      const section =
        await prisma.section.findFirst({
          where: {
            id:
              sectionId,

            schoolId,

            classId:
              classDetails.id,
          },

          select: {
            id: true,
            sectionName: true,
            classTeacherId: true,
          },
        });

      if (!section) {
        return res.status(404).json({
          message:
            "Section not found for this class",
        });
      }

      /* ======================================================
         TEACHER AUTHORIZATION
      ====================================================== */

      if (
        markingUser.role ===
        "TEACHER"
      ) {

        const mapping =
          await prisma.teacherSubjectMapping.findFirst(
            {
              where: {
                schoolId,

                teacherUserId:
                  markedByUserId,

                sectionId:
                  section.id,
              },

              select: {
                id: true,
              },
            }
          );

        const isClassTeacher =
          section.classTeacherId ===
          markedByUserId;

        if (
          !mapping &&
          !isClassTeacher
        ) {
          return res.status(403).json({
            message:
              "You are not authorized to mark attendance for this section",
          });
        }
      }

      /* ======================================================
         VERIFY STUDENTS
         
         Every student must belong to:
         same school
         same class
         same section
         active
      ====================================================== */

      const students =
        await prisma.student.findMany({
          where: {
            id: {
              in:
                studentIds,
            },

            schoolId,

            classId:
              classDetails.id,

            sectionId:
              section.id,

            status: "ACTIVE",
          },

          select: {
            id: true,
            name: true,
            admissionNo: true,
          },
        });

      if (
        students.length !==
        studentIds.length
      ) {

        const foundIds =
          new Set(
            students.map(
              student =>
                student.id
            )
          );

        const invalidStudent =
          studentIds.find(
            id =>
              !foundIds.has(id)
          );

        return res.status(400).json({
          message:
            `Student ${invalidStudent} does not belong to the selected class/section`,
        });
      }

      /* ======================================================
         SAVE
      ====================================================== */

      const saved =
        await prisma.$transaction(
          async tx => {

            const results = [];

            for (
              const item of attendance
            ) {

              const result =
                await tx.attendance.upsert(
                  {
                    where: {
                      schoolId_studentId_date:
                        {
                          schoolId,

                          studentId:
                            item.studentId,

                          date:
                            attendanceDate,
                        },
                    },

                    create: {

                      schoolId,

                      studentId:
                        item.studentId,

                      sectionId:
                        section.id,

                      classId:
                        classDetails.id,

                      academicYearId: classDetails.academicYearId,

                      date:
                        attendanceDate,

                      status:
                        item.status,

                      remark:
                        item.remark?.trim() ||
                        null,

                      markedByUserId,

                    },

                    update: {

                      status:
                        item.status,

                      remark:
                        item.remark?.trim() ||
                        null,

                      markedByUserId,

                    },

                    include: {

                      student: {
                        select: {
                          id: true,
                          admissionNo: true,
                          name: true,
                          rollNumber: true,
                        },
                      },

                    },

                  }
                );

              results.push(
                result
              );
            }

            return results;
          }
        );

      /* ======================================================
         SUMMARY
      ====================================================== */

      const summary = {

        total:
          saved.length,

        present:
          saved.filter(
            item =>
              item.status ===
              "PRESENT"
          ).length,

        absent:
          saved.filter(
            item =>
              item.status ===
              "ABSENT"
          ).length,

        late:
          saved.filter(
            item =>
              item.status ===
              "LATE"
          ).length,

        halfDay:
          saved.filter(
            item =>
              item.status ===
              "HALF_DAY"
          ).length,

        holiday:
          saved.filter(
            item =>
              item.status ===
              "HOLIDAY"
          ).length,

      };

      return res.status(200).json({

        message:
          "Student attendance marked successfully",

        date,

        class:
          classDetails,

        section,

        summary,

        attendance:
          saved,

      });

    } catch (error) {

      console.error(
        "MARK STUDENT ATTENDANCE ERROR:",
        error
      );

      return handleErr(
        error,
        res
      );
    }
  };



  const getStudentsForAttendance = async (
  req: any,
  res: any
) => {
  try {

    /* ========================================================
       AUTHENTICATION
    ======================================================== */

    const teacherUserId =
      req.user?.id;

    const schoolId =
      req.user?.schoolId;


    if (!teacherUserId) {
      return res.status(401).json({
        message:
          "Authenticated teacher not found",
      });
    }


    if (!schoolId) {
      return res.status(400).json({
        message:
          "schoolId is required",
      });
    }


    /* ========================================================
       QUERY
    ======================================================== */

    const {
      classId,
      sectionId,
      academicYearId,
      date,
    } = req.query;


    if (!classId) {
      return res.status(400).json({
        message:
          "classId is required",
      });
    }


    if (!sectionId) {
      return res.status(400).json({
        message:
          "sectionId is required",
      });
    }


    if (!academicYearId) {
      return res.status(400).json({
        message:
          "academicYearId is required",
      });
    }


    if (!date) {
      return res.status(400).json({
        message:
          "date is required",
      });
    }


    /* ========================================================
       DATE
    ======================================================== */

    const attendanceDate =
      dayjs(
        String(date),
        "DD/MM/YYYY",
        true
      );


    if (
      !attendanceDate.isValid()
    ) {
      return res.status(400).json({
        message:
          "Invalid date. Use DD/MM/YYYY",
      });
    }


    const dateValue =
      attendanceDate
        .startOf("day")
        .toDate();


    /* ========================================================
       VERIFY ACADEMIC YEAR
    ======================================================== */

    const academicYear =
      await prisma.academicYear.findFirst({
        where: {
          id:
            String(
              academicYearId
            ),

          schoolId,
        },

        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
        },
      });


    if (!academicYear) {
      return res.status(404).json({
        message:
          "Academic year not found",
      });
    }


    /* ========================================================
       VERIFY CLASS
    ======================================================== */

    const classDetails =
      await prisma.class.findFirst({
        where: {
          id:
            String(
              classId
            ),

          schoolId,

          academicYearId:
            academicYear.id,
        },

        select: {
          id: true,
          classNumber: true,
          displayName: true,
          academicYearId: true,
          isCompleted: true,
        },
      });


    if (!classDetails) {
      return res.status(404).json({
        message:
          "Class not found",
      });
    }


    if (
      classDetails.isCompleted
    ) {
      return res.status(400).json({
        message:
          "This class is completed",
      });
    }


    /* ========================================================
       VERIFY SECTION
    ======================================================== */

    const section =
      await prisma.section.findFirst({
        where: {
          id:
            String(
              sectionId
            ),

          schoolId,

          classId:
            classDetails.id,
        },

        select: {
          id: true,
          sectionName: true,
          classId: true,
        },
      });


    if (!section) {
      return res.status(404).json({
        message:
          "Section not found for selected class",
      });
    }


    /* ========================================================
       VERIFY TEACHER ASSIGNMENT
       
       Teacher must be mapped to this
       section for the academic year.
    ======================================================== */

    const teacherMapping =
      await prisma.teacherSubjectMapping.findFirst({
        where: {
          schoolId,

          teacherUserId:
            teacherUserId,

          sectionId:
            section.id,

          academicYearId:
            academicYear.id,
        },

        select: {
          id: true,
        },
      });


    if (!teacherMapping) {
      return res.status(403).json({
        message:
          "You are not assigned to this section",
      });
    }


    /* ========================================================
       GET STUDENTS
       
       Only active students belonging to
       the selected class + section.
    ======================================================== */

    const students =
      await prisma.student.findMany({
        where: {
          schoolId,

          classId:
            classDetails.id,

          sectionId:
            section.id,

          status:
            "ACTIVE",
        },

        select: {
          id: true,

          admissionNo: true,

          name: true,

          rollNumber: true,

          classId: true,

          sectionId: true,

          attendances: {
            where: {
              schoolId,

              date:
                dateValue,
            },

            select: {
              id: true,

              status: true,

              remark: true,

              markedByUserId: true,

              createdAt: true,

              updatedAt: true,
            },

            take: 1,
          },
        },

        orderBy: [
          {
            rollNumber:
              "asc",
          },

          {
            name:
              "asc",
          },
        ],
      });


    /* ========================================================
       MAP STUDENTS
    ======================================================== */

    const result =
      students.map(
        student => {

          const existingAttendance =
            student
              .attendances?.[0] ??
            null;


          return {

            id:
              student.id,

            admissionNo:
              student.admissionNo,

            name:
              student.name,

            rollNumber:
              student.rollNumber,

            classId:
              student.classId,

            sectionId:
              student.sectionId,

            attendance:
              existingAttendance
                ? {
                    id:
                      existingAttendance.id,

                    status:
                      existingAttendance.status,

                    remark:
                      existingAttendance.remark,

                    markedByUserId:
                      existingAttendance
                        .markedByUserId,

                    createdAt:
                      existingAttendance
                        .createdAt,

                    updatedAt:
                      existingAttendance
                        .updatedAt,
                  }
                : null,

          };

        }
      );


    /* ========================================================
       SUMMARY
    ======================================================== */

    const summary = {

      total:
        result.length,

      present:
        result.filter(
          student =>
            student.attendance
              ?.status ===
            "PRESENT"
        ).length,

      absent:
        result.filter(
          student =>
            student.attendance
              ?.status ===
            "ABSENT"
        ).length,

      late:
        result.filter(
          student =>
            student.attendance
              ?.status ===
            "LATE"
        ).length,

      halfDay:
        result.filter(
          student =>
            student.attendance
              ?.status ===
            "HALF_DAY"
        ).length,

      holiday:
        result.filter(
          student =>
            student.attendance
              ?.status ===
            "HOLIDAY"
        ).length,

      notMarked:
        result.filter(
          student =>
            !student.attendance
        ).length,

    };


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      date:

        attendanceDate.format(
          "DD/MM/YYYY"
        ),

      academicYear: {

        id:
          academicYear.id,

        name:
          academicYear.name,

      },

      class: {

        id:
          classDetails.id,

        classNumber:
          classDetails.classNumber,

        displayName:
          classDetails.displayName,

      },

      section: {

        id:
          section.id,

        sectionName:
          section.sectionName,

      },

      summary,

      students:
        result,

    });

  } catch (error) {

    console.error(
      "GET STUDENTS FOR ATTENDANCE ERROR:",
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

export const attendanceControllers = {

  getStudentsForAttendance,

  markStudentAttendance,

};