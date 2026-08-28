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

type TeacherAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "HALF_DAY"
  | "ON_LEAVE";


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
   GET ATTENDANCE DASHBOARD
============================================================ */

/**
 * GET /attendance/dashboard?date=27/08/2026
 *
 * Returns:
 *
 * - student attendance summary
 * - teacher attendance summary
 * - class-wise student attendance
 * - section-wise student attendance
 * - overall percentages
 */
const getAttendanceDashboard =
  async (
    req: any,
    res: any
  ) => {

    try {

      /* ======================================================
         SCHOOL
      ====================================================== */

      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }


      /* ======================================================
         DATE
      ====================================================== */

      const date =
        String(
          req.query?.date ?? ""
        );

      const attendanceDate =
        parseDate(date);

      if (!attendanceDate) {
        return res.status(400).json({
          message:
            "Valid date is required. Use DD/MM/YYYY",
        });
      }


      /* ======================================================
         FETCH STUDENTS
      ====================================================== */

      const students =
        await prisma.student.findMany({
          where: {
            schoolId,

            status: "ACTIVE",
          },

          select: {
            id: true,
            name: true,
            admissionNo: true,

            classId: true,

            sectionId: true,

            class: {
              select: {
                id: true,
                classNumber: true,
                displayName: true,
              },
            },

            section: {
              select: {
                id: true,
                sectionName: true,
              },
            },

            attendances: {
              where: {
                schoolId,

                date:
                  attendanceDate,
              },

              select: {
                status: true,
              },

              take: 1,
            },
          },

          orderBy: [
            {
              class: {
                classNumber: "asc",
              },
            },
            {
              section: {
                sectionName: "asc",
              },
            },
            {
              name: "asc",
            },
          ],
        });


      /* ======================================================
         FETCH TEACHERS
      ====================================================== */

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
            employeeId: true,

            teacherAttendances: {
              where: {
                schoolId,

                date:
                  attendanceDate,
              },

              select: {
                status: true,
                leaveType: true,
              },

              take: 1,
            },
          },

          orderBy: {
            name: "asc",
          },
        });


      /* ======================================================
         STUDENT SUMMARY
      ====================================================== */

      const studentSummary = {

        total:
          students.length,

        marked: 0,

        unmarked: 0,

        present: 0,

        absent: 0,

        late: 0,

        halfDay: 0,

        holiday: 0,

      };


      students.forEach(
        student => {

          const attendance =
            student.attendances?.[0];

          if (!attendance) {

            studentSummary.unmarked++;

            return;
          }

          studentSummary.marked++;

          switch (
            attendance.status
          ) {

            case "PRESENT":
              studentSummary.present++;
              break;

            case "ABSENT":
              studentSummary.absent++;
              break;

            case "LATE":
              studentSummary.late++;
              break;

            case "HALF_DAY":
              studentSummary.halfDay++;
              break;

            case "HOLIDAY":
              studentSummary.holiday++;
              break;

          }

        }
      );


      /* ======================================================
         TEACHER SUMMARY
      ====================================================== */

      const teacherSummary = {

        total:
          teachers.length,

        marked:
          0,

        unmarked:
          0,

        present:
          0,

        absent:
          0,

        halfDay:
          0,

        onLeave:
          0,

      };


      teachers.forEach(
        teacher => {

          const attendance =
            teacher
              .teacherAttendances?.[0];

          if (!attendance) {

            teacherSummary.unmarked++;

            return;
          }

          teacherSummary.marked++;

          switch (
            attendance.status
          ) {

            case "PRESENT":
              teacherSummary.present++;
              break;

            case "ABSENT":
              teacherSummary.absent++;
              break;

            case "HALF_DAY":
              teacherSummary.halfDay++;
              break;

            case "ON_LEAVE":
              teacherSummary.onLeave++;
              break;

          }

        }
      );


      /* ======================================================
         STUDENT PERCENTAGES
      ====================================================== */

      const studentMarked =
        studentSummary.marked;

      const studentAttendancePercentage =
        studentMarked > 0
          ? Number(
              (
                (
                  studentSummary.present +
                  studentSummary.late +
                  studentSummary.halfDay
                ) /
                studentMarked
              ) *
                100
            ).toFixed(2)
          : 0;


      const studentAbsentPercentage =
        studentMarked > 0
          ? Number(
              (
                studentSummary.absent /
                studentMarked
              ) *
                100
            ).toFixed(2)
          : 0;


      /* ======================================================
         TEACHER PERCENTAGES
      ====================================================== */

      const teacherMarked =
        teacherSummary.marked;

      const teacherAttendancePercentage =
        teacherMarked > 0
          ? Number(
              (
                (
                  teacherSummary.present +
                  teacherSummary.halfDay
                ) /
                teacherMarked
              ) *
                100
            ).toFixed(2)
          : 0;


      const teacherAbsentPercentage =
        teacherMarked > 0
          ? Number(
              (
                teacherSummary.absent /
                teacherMarked
              ) *
                100
            ).toFixed(2)
          : 0;


      /* ======================================================
         CLASS-WISE SUMMARY
      ====================================================== */

      const classMap =
        new Map<string, any>();


      students.forEach(
        student => {

          const classId =
            student.class.id;

          if (
            !classMap.has(
              classId
            )
          ) {

            classMap.set(
              classId,
              {
                classId,

                classNumber:
                  student.class
                    .classNumber,

                displayName:
                  student.class
                    .displayName,

                totalStudents:
                  0,

                marked:
                  0,

                unmarked:
                  0,

                present:
                  0,

                absent:
                  0,

                late:
                  0,

                halfDay:
                  0,

                holiday:
                  0,
              }
            );

          }


          const item =
            classMap.get(
              classId
            );


          item.totalStudents++;


          const attendance =
            student
              .attendances?.[0];


          if (!attendance) {

            item.unmarked++;

            return;
          }


          item.marked++;


          switch (
            attendance.status
          ) {

            case "PRESENT":
              item.present++;
              break;

            case "ABSENT":
              item.absent++;
              break;

            case "LATE":
              item.late++;
              break;

            case "HALF_DAY":
              item.halfDay++;
              break;

            case "HOLIDAY":
              item.holiday++;
              break;

          }

        }
      );


      const classWise =
        Array.from(
          classMap.values()
        ).map(item => {

          const marked =
            item.marked;

          return {

            ...item,

            attendancePercentage:
              marked > 0
                ? Number(
                    (
                      (
                        item.present +
                        item.late +
                        item.halfDay
                      ) /
                      marked
                    ) *
                      100
                  ).toFixed(2)
                : 0,

          };

        });


      /* ======================================================
         SECTION-WISE SUMMARY
      ====================================================== */

      const sectionMap =
        new Map<string, any>();


      students.forEach(
        student => {

          const sectionId =
            student.section.id;


          if (
            !sectionMap.has(
              sectionId
            )
          ) {

            sectionMap.set(
              sectionId,
              {

                sectionId,

                classId:
                  student.class.id,

                classNumber:
                  student.class
                    .classNumber,

                classDisplayName:
                  student.class
                    .displayName,

                sectionName:
                  student.section
                    .sectionName,

                totalStudents:
                  0,

                marked:
                  0,

                unmarked:
                  0,

                present:
                  0,

                absent:
                  0,

                late:
                  0,

                halfDay:
                  0,

                holiday:
                  0,

              }
            );

          }


          const item =
            sectionMap.get(
              sectionId
            );


          item.totalStudents++;


          const attendance =
            student
              .attendances?.[0];


          if (!attendance) {

            item.unmarked++;

            return;
          }


          item.marked++;


          switch (
            attendance.status
          ) {

            case "PRESENT":
              item.present++;
              break;

            case "ABSENT":
              item.absent++;
              break;

            case "LATE":
              item.late++;
              break;

            case "HALF_DAY":
              item.halfDay++;
              break;

            case "HOLIDAY":
              item.holiday++;
              break;

          }

        }
      );


      const sectionWise =
        Array.from(
          sectionMap.values()
        ).map(item => {

          const marked =
            item.marked;

          return {

            ...item,

            attendancePercentage:
              marked > 0
                ? Number(
                    (
                      (
                        item.present +
                        item.late +
                        item.halfDay
                      ) /
                      marked
                    ) *
                      100
                  ).toFixed(2)
                : 0,

          };

        });


      /* ======================================================
         RESPONSE
      ====================================================== */

      return res.status(200).json({

        date,

        students: {

          summary:
            studentSummary,

          attendancePercentage:
            studentAttendancePercentage,

          absentPercentage:
            studentAbsentPercentage,

          classWise,

          sectionWise,

        },


        teachers: {

          summary:
            teacherSummary,

          attendancePercentage:
            teacherAttendancePercentage,

          absentPercentage:
            teacherAbsentPercentage,

        },

      });

    } catch (error) {

      console.error(
        "GET ATTENDANCE DASHBOARD ERROR:",
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

export const attendanceDashboardControllers = {

  getAttendanceDashboard,

};