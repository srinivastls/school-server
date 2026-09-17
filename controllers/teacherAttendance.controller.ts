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
/* ============================================================
   GET TEACHER ASSIGNED SECTIONS
============================================================ */

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
       VERIFY TEACHER
    -------------------------------------------------------- */

    const teacher =
      await prisma.user.findFirst({
        where: {
          id: teacherUserId,
          schoolId,
          role: "TEACHER",
          isActive: true,
        },

        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          designation: true,
          department: true,
        },
      });


    if (!teacher) {
      return res.status(404).json({
        message:
          "Teacher not found",
      });
    }


    /* --------------------------------------------------------
       CURRENT ACADEMIC YEAR
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


    /* ========================================================
       1. SUBJECT MAPPINGS
       
       Sections where teacher teaches a subject.
    ======================================================== */

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
              isOptional: true,
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
          {
            subject: {
              name: "asc",
            },
          },
        ],
      });


    /* ========================================================
       2. CLASS TEACHER SECTIONS
       
       Sections where this teacher is the class teacher.
    ======================================================== */

    const classTeacherSections =
      await prisma.section.findMany({
        where: {
          schoolId,

          classTeacherId:
            teacherUserId,

          class: {
            academicYearId:
              academicYear.id,

            isCompleted: false,
          },
        },

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

        orderBy: [
          {
            class: {
              classNumber: "asc",
            },
          },
          {
            sectionName: "asc",
          },
        ],
      });


    /* ========================================================
       3. BUILD UNIQUE SECTION MAP
    ======================================================== */

    const sectionMap =
      new Map<string, any>();


    /* --------------------------------------------------------
       ADD CLASS TEACHER SECTIONS FIRST
    -------------------------------------------------------- */

    for (
      const section of
        classTeacherSections
    ) {

      if (
        !section.class ||
        section.class.isCompleted
      ) {
        continue;
      }


      sectionMap.set(
        section.id,
        {
          sectionId:
            section.id,

          sectionName:
            section.sectionName,

          classId:
            section.class.id,

          classNumber:
            section.class.classNumber,

          classDisplayName:
            section.class.displayName,

          academicYearId:
            academicYear.id,

          academicYearName:
            academicYear.name,

          isClassTeacher:
            true,

          subjects: [],
        }
      );
    }


    /* --------------------------------------------------------
       ADD SUBJECT MAPPINGS
    -------------------------------------------------------- */

    for (
      const mapping of mappings
    ) {

      const section =
        mapping.section;

      if (
        !section ||
        !section.class ||
        section.class.isCompleted
      ) {
        continue;
      }


      /* ------------------------------------------------------
         CREATE SECTION IF NOT EXISTS
      ------------------------------------------------------ */

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
              section.class.id,

            classNumber:
              section.class.classNumber,

            classDisplayName:
              section.class.displayName,

            academicYearId:
              academicYear.id,

            academicYearName:
              academicYear.name,

            isClassTeacher:
              false,

            subjects: [],
          }
        );
      }


      /* ------------------------------------------------------
         GET SECTION
      ------------------------------------------------------ */

      const sectionData =
        sectionMap.get(
          section.id
        );


      /* ------------------------------------------------------
         MARK CLASS TEACHER
         
         This also handles the case where the
         section was first added from a mapping.
      ------------------------------------------------------ */

      if (
        section.classTeacherId ===
        teacherUserId
      ) {
        sectionData.isClassTeacher =
          true;
      }


      /* ------------------------------------------------------
         ADD SUBJECT
      ------------------------------------------------------ */

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

          isOptional:
            mapping.subject.isOptional,
        });
      }
    }


    /* ========================================================
       4. GET STUDENT COUNTS
    ======================================================== */

    const sectionIds =
      Array.from(
        sectionMap.keys()
      );


    const studentCounts =
      sectionIds.length > 0
        ? await prisma.studentAcademicEnrollment.groupBy({
            by: ["sectionId"],

            where: {
              schoolId,

              academicYearId:
                academicYear.id,

              sectionId: {
                in: sectionIds,
              },

              enrollmentStatus: {
                not: "LEFT",
              },
            },

            _count: {
              _all: true,
            },
          })
        : [];


    /* --------------------------------------------------------
       CREATE COUNT MAP
    -------------------------------------------------------- */

    const studentCountMap =
      new Map<string, number>();


    for (
      const item of studentCounts
    ) {

      studentCountMap.set(
        item.sectionId,
        item._count._all
      );
    }


    /* ========================================================
       5. ADD STUDENT COUNTS
    ======================================================== */

    const sections =
      Array.from(
        sectionMap.values()
      ).map(
        (section) => ({
          ...section,

          totalStudents:
            studentCountMap.get(
              section.sectionId
            ) ?? 0,
        })
      );


    /* ========================================================
       6. SORT
    ======================================================== */

    sections.sort(
      (a, b) => {

        const classCompare =
          a.classNumber.localeCompare(
            b.classNumber,
            undefined,
            {
              numeric: true,
            }
          );

        if (
          classCompare !== 0
        ) {
          return classCompare;
        }

        return a.sectionName.localeCompare(
          b.sectionName
        );
      }
    );


    /* ========================================================
       7. SUMMARY
    ======================================================== */

    const totalStudents =
      sections.reduce(
        (
          total: number,
          section: any
        ) =>
          total +
          section.totalStudents,
        0
      );


    const totalSubjects =
      new Set(
        mappings.map(
          (mapping) =>
            mapping.subject.id
        )
      ).size;


    const classTeacherSectionCount =
      sections.filter(
        (section: any) =>
          section.isClassTeacher
      ).length;


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        employeeId:
          teacher.employeeId,
        designation:
          teacher.designation,
        department:
          teacher.department,
      },

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

      summary: {
        totalSections:
          sections.length,

        totalStudents,

        totalSubjects,

        classTeacherSections:
          classTeacherSectionCount,
      },

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
   GET STUDENTS OF TEACHER ASSIGNED SECTION
============================================================ */

/**
 * GET /attendance/student/my-section-students
 *
 * Returns students belonging to a section assigned
 * to the authenticated teacher for the current academic year.
 *
 * Access:
 * - Class teacher of the section
 * - Subject teacher mapped to the section
 */
const getTeacherSectionStudents = async (
  req: any,
  res: any
) => {
  try {
    /* --------------------------------------------------------
       AUTHENTICATED TEACHER
    -------------------------------------------------------- */

    const teacherUserId = req.user?.id;

    if (!teacherUserId) {
      return res.status(401).json({
        message: "Authenticated teacher not found",
      });
    }

    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    /* --------------------------------------------------------
       SECTION ID
    -------------------------------------------------------- */

    const sectionId = String(
      req.query?.sectionId ?? ""
    ).trim();

    if (!sectionId) {
      return res.status(400).json({
        message: "sectionId is required",
      });
    }

    /* --------------------------------------------------------
       CURRENT ACADEMIC YEAR
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
        message: "Current academic year not found",
      });
    }

    /* --------------------------------------------------------
       FIND SECTION
    -------------------------------------------------------- */

    const section =
      await prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          class: {
            schoolId,
            academicYearId:
              academicYear.id,
          },
        },

        select: {
          id: true,
          sectionName: true,
          classTeacherId: true,

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
      });

    if (!section) {
      return res.status(404).json({
        message: "Section not found",
      });
    }

    /* --------------------------------------------------------
       DO NOT ALLOW COMPLETED CLASS
    -------------------------------------------------------- */

    if (section.class.isCompleted) {
      return res.status(403).json({
        message:
          "This class has been completed",
      });
    }

    /* --------------------------------------------------------
       TEACHER ACCESS CHECK
    --------------------------------------------------------

       A teacher can access the section when:

       1. They are the class teacher
                       OR
       2. They have a subject mapping for this section
    -------------------------------------------------------- */

    const isClassTeacher =
      section.classTeacherId ===
      teacherUserId;

    let hasSubjectMapping = false;

    if (!isClassTeacher) {
      const mapping =
        await prisma.teacherSubjectMapping.findFirst({
          where: {
            schoolId,
            teacherUserId,
            sectionId,
            academicYearId:
              academicYear.id,
          },
          select: {
            id: true,
          },
        });

      hasSubjectMapping =
        !!mapping;
    }

    if (
      !isClassTeacher &&
      !hasSubjectMapping
    ) {
      return res.status(403).json({
        message:
          "You are not assigned to this section",
      });
    }

    /* --------------------------------------------------------
       GET CURRENT ENROLLMENTS
    -------------------------------------------------------- */

    const enrollments =
      await prisma.studentAcademicEnrollment.findMany({
        where: {
          schoolId,
          academicYearId:
            academicYear.id,
          sectionId,

          /*
           * LEFT students should not appear
           * in the active teacher roster.
           */
          enrollmentStatus: {
            not: "LEFT",
          },
        },

        select: {
          id: true,
          enrollmentStatus: true,
          student: {
            select: {
              id: true,
              admissionNo: true,
              name: true,
              fatherName: true,
              motherName: true,
              dob: true,
              doj: true,
              gender: true,
              bloodGroup: true,
              phone: true,
              emergencyContact: true,
              photoUrl: true,
              rollNumber: true,
              status: true,
            },
          },
        },

        orderBy: {
          student: {
            name: "asc",
          },
        },
      });

    /* --------------------------------------------------------
       FORMAT STUDENTS
    -------------------------------------------------------- */

    const students =
      enrollments.map(
        (enrollment) => ({
          enrollmentId:
            enrollment.id,

          id:
            enrollment.student.id,

          admissionNo:
            enrollment.student.admissionNo,

          name:
            enrollment.student.name,

          fatherName:
            enrollment.student.fatherName,

          motherName:
            enrollment.student.motherName,

          dob:
            enrollment.student.dob,

          doj:
            enrollment.student.doj,

          gender:
            enrollment.student.gender,

          bloodGroup:
            enrollment.student.bloodGroup,

          phone:
            enrollment.student.phone,

          emergencyContact:
            enrollment.student
              .emergencyContact,

          photoUrl:
            enrollment.student.photoUrl,

          rollNumber:
            enrollment.student.rollNumber,

          studentStatus:
            enrollment.student.status,

          enrollmentStatus:
            enrollment.enrollmentStatus,
        })
      );

    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({
      academicYear: {
        id: academicYear.id,
        name: academicYear.name,
        startDate:
          academicYear.startDate,
        endDate:
          academicYear.endDate,
      },

      section: {
        id: section.id,
        sectionName:
          section.sectionName,

        classId:
          section.class.id,

        classNumber:
          section.class.classNumber,

        classDisplayName:
          section.class.displayName,

        isClassTeacher,
      },

      totalStudents:
        students.length,

      students,
    });

  } catch (error) {
    console.error(
      "GET TEACHER SECTION STUDENTS ERROR:",
      error
    );

    return handleErr(
      error,
      res
    );
  }
};


/* ============================================================
   HELPERS
============================================================ */

const parseAttendanceDate = (value: unknown): Date | null => {
  if (!value) return null;

  const raw = String(value).trim();

  /*
   * Accept:
   * YYYY-MM-DD
   * DD/MM/YYYY
   */

  let year: number;
  let month: number;
  let day: number;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parts = raw.split("-").map(Number);

    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const parts = raw.split("/").map(Number);

    day = parts[0];
    month = parts[1];
    year = parts[2];
  } else {
    return null;
  }

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};


/* ============================================================
   CHECK TEACHER SECTION ACCESS
============================================================ */

const teacherHasSectionAccess = async (
  teacherUserId: string,
  schoolId: string,
  sectionId: string,
  academicYearId: string
): Promise<boolean> => {

  /* ----------------------------------------------------------
     CLASS TEACHER
  ---------------------------------------------------------- */

  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      schoolId,
      class: {
        schoolId,
        academicYearId,
      },
    },
    select: {
      classTeacherId: true,
    },
  });

  if (!section) {
    return false;
  }

  if (section.classTeacherId === teacherUserId) {
    return true;
  }


  /* ----------------------------------------------------------
     SUBJECT TEACHER
  ---------------------------------------------------------- */

  const mapping =
    await prisma.teacherSubjectMapping.findFirst({
      where: {
        schoolId,
        teacherUserId,
        sectionId,
        academicYearId,
      },
      select: {
        id: true,
      },
    });

  return !!mapping;
};


/* ============================================================
   GET SECTION ATTENDANCE
============================================================ */

/**
 * GET /attendance/student/my-section-attendance
 *
 * Teacher fetches students + attendance for one assigned
 * section on a specific date.
 */
const getTeacherSectionAttendance = async (
  req: any,
  res: any
) => {

  try {

    /* --------------------------------------------------------
       AUTHENTICATED TEACHER
    -------------------------------------------------------- */

    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }


    /* --------------------------------------------------------
       REQUEST PARAMETERS
    -------------------------------------------------------- */

    const sectionId = String(
      req.query?.sectionId ?? ""
    ).trim();

    const dateInput = String(
      req.query?.date ?? ""
    ).trim();

    if (!sectionId) {
      return res.status(400).json({
        message: "sectionId is required",
      });
    }

    const attendanceDate =
      parseAttendanceDate(dateInput);

    if (!attendanceDate) {
      return res.status(400).json({
        message:
          "Valid date is required. Use YYYY-MM-DD or DD/MM/YYYY",
      });
    }


    /* --------------------------------------------------------
       CURRENT ACADEMIC YEAR
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
        message: "Current academic year not found",
      });
    }


    /* --------------------------------------------------------
       SECTION
    -------------------------------------------------------- */

    const section =
      await prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          class: {
            schoolId,
            academicYearId:
              academicYear.id,
          },
        },

        select: {
          id: true,
          sectionName: true,
          classTeacherId: true,

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
      });

    if (!section) {
      return res.status(404).json({
        message:
          "Section not found for current academic year",
      });
    }


    /* --------------------------------------------------------
       COMPLETED CLASS CHECK
    -------------------------------------------------------- */

    if (section.class.isCompleted) {
      return res.status(400).json({
        message:
          "Attendance cannot be marked for a completed class",
      });
    }


    /* --------------------------------------------------------
       TEACHER PERMISSION
    -------------------------------------------------------- */

    const hasAccess =
      await teacherHasSectionAccess(
        teacherUserId,
        schoolId,
        sectionId,
        academicYear.id
      );

    if (!hasAccess) {
      return res.status(403).json({
        message:
          "You are not assigned to this section",
      });
    }


    /* --------------------------------------------------------
       STUDENTS
    -------------------------------------------------------- */

    const enrollments =
      await prisma.studentAcademicEnrollment.findMany({
        where: {
          schoolId,
          academicYearId:
            academicYear.id,
          sectionId,

          enrollmentStatus: {
            not: "LEFT",
          },
        },

        select: {
          id: true,
          enrollmentStatus: true,

          student: {
            select: {
              id: true,
              admissionNo: true,
              name: true,
              fatherName: true,
              motherName: true,
              gender: true,
              bloodGroup: true,
              photoUrl: true,
              rollNumber: true,
              status: true,
            },
          },
        },

        orderBy: {
          student: {
            name: "asc",
          },
        },
      });


    /* --------------------------------------------------------
       EXISTING ATTENDANCE
    -------------------------------------------------------- */

    const studentIds =
      enrollments.map(
        (item) => item.student.id
      );

    const attendance =
      studentIds.length > 0
        ? await prisma.attendance.findMany({
            where: {
              schoolId,
              academicYearId:
                academicYear.id,
              sectionId,
              date: attendanceDate,

              studentId: {
                in: studentIds,
              },
            },

            select: {
              id: true,
              studentId: true,
              status: true,
              remark: true,
              markedByUserId: true,
              createdAt: true,
              updatedAt: true,
            },
          })
        : [];


    /* --------------------------------------------------------
       MAP ATTENDANCE BY STUDENT
    -------------------------------------------------------- */

    const attendanceMap = new Map<
      string,
      (typeof attendance)[number]
    >();

    for (const record of attendance) {
      attendanceMap.set(
        record.studentId,
        record
      );
    }


    /* --------------------------------------------------------
       RESULT
    -------------------------------------------------------- */

    const students = enrollments.map(
      (enrollment) => {

        const student =
          enrollment.student;

        const record =
          attendanceMap.get(student.id);

        return {
          enrollmentId:
            enrollment.id,

          id: student.id,

          admissionNo:
            student.admissionNo,

          name:
            student.name,

          fatherName:
            student.fatherName,

          motherName:
            student.motherName,

          gender:
            student.gender,

          bloodGroup:
            student.bloodGroup,

          photoUrl:
            student.photoUrl,

          rollNumber:
            student.rollNumber,

          studentStatus:
            student.status,

          enrollmentStatus:
            enrollment.enrollmentStatus,

          attendance: record
            ? {
                id: record.id,
                status: record.status,
                remark: record.remark,
                markedByUserId:
                  record.markedByUserId,
                createdAt:
                  record.createdAt,
                updatedAt:
                  record.updatedAt,
              }
            : null,
        };
      }
    );


    /* --------------------------------------------------------
       SUMMARY
    -------------------------------------------------------- */

    const summary = {
      total: students.length,

      marked: students.filter(
        (student) =>
          student.attendance !== null
      ).length,

      unmarked: students.filter(
        (student) =>
          student.attendance === null
      ).length,

      present: students.filter(
        (student) =>
          student.attendance?.status ===
          "PRESENT"
      ).length,

      absent: students.filter(
        (student) =>
          student.attendance?.status ===
          "ABSENT"
      ).length,

      late: students.filter(
        (student) =>
          student.attendance?.status ===
          "LATE"
      ).length,

      halfDay: students.filter(
        (student) =>
          student.attendance?.status ===
          "HALF_DAY"
      ).length,

      holiday: students.filter(
        (student) =>
          student.attendance?.status ===
          "HOLIDAY"
      ).length,
    };


    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({
      date: dateInput,

      academicYear: {
        id: academicYear.id,
        name: academicYear.name,
        startDate:
          academicYear.startDate,
        endDate:
          academicYear.endDate,
      },

      section: {
        id: section.id,
        sectionName:
          section.sectionName,

        classId:
          section.class.id,

        classNumber:
          section.class.classNumber,

        classDisplayName:
          section.class.displayName,

        isClassTeacher:
          section.classTeacherId ===
          teacherUserId,
      },

      summary,

      totalStudents:
        students.length,

      students,
    });

  } catch (error) {

    console.error(
      "GET TEACHER SECTION ATTENDANCE ERROR:",
      error
    );

    return handleErr(
      error,
      res
    );
  }
};


/* ============================================================
   SAVE SECTION ATTENDANCE
============================================================ */

/**
 * POST /attendance/student/my-section-attendance
 *
 * Bulk create/update attendance for an assigned section.
 */
const saveTeacherSectionAttendance = async (
  req: any,
  res: any
) => {

  try {

    /* --------------------------------------------------------
       AUTHENTICATED TEACHER
    -------------------------------------------------------- */

    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }


    /* --------------------------------------------------------
       REQUEST BODY
    -------------------------------------------------------- */

    const {
      sectionId,
      date,
      attendance,
    } = req.body ?? {};

    if (!sectionId) {
      return res.status(400).json({
        message: "sectionId is required",
      });
    }

    const attendanceDate =
      parseAttendanceDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        message:
          "Valid date is required. Use YYYY-MM-DD or DD/MM/YYYY",
      });
    }

    if (!Array.isArray(attendance)) {
      return res.status(400).json({
        message:
          "attendance must be an array",
      });
    }

    if (attendance.length === 0) {
      return res.status(400).json({
        message:
          "At least one attendance record is required",
      });
    }


    /* --------------------------------------------------------
       CURRENT ACADEMIC YEAR
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
       SECTION
    -------------------------------------------------------- */

    const section =
      await prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          class: {
            schoolId,
            academicYearId:
              academicYear.id,
          },
        },

        select: {
          id: true,
          sectionName: true,
          classTeacherId: true,

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
      });

    if (!section) {
      return res.status(404).json({
        message:
          "Section not found for current academic year",
      });
    }


    if (section.class.isCompleted) {
      return res.status(400).json({
        message:
          "Attendance cannot be marked for a completed class",
      });
    }


    /* --------------------------------------------------------
       TEACHER PERMISSION
    -------------------------------------------------------- */

    const hasAccess =
      await teacherHasSectionAccess(
        teacherUserId,
        schoolId,
        sectionId,
        academicYear.id
      );

    if (!hasAccess) {
      return res.status(403).json({
        message:
          "You are not assigned to this section",
      });
    }
    

    /* --------------------------------------------------------
       VALID ATTENDANCE STATUSES
    -------------------------------------------------------- */

    const validStatuses = new Set([
      "PRESENT",
      "ABSENT",
      "LATE",
      "HALF_DAY",
      "HOLIDAY",
    ]);


    /* --------------------------------------------------------
       GET VALID ENROLLED STUDENTS
    -------------------------------------------------------- */

    const enrollments =
      await prisma.studentAcademicEnrollment.findMany({
        where: {
          schoolId,
          academicYearId:
            academicYear.id,
          sectionId,

          enrollmentStatus: {
            not: "LEFT",
          },
        },

        select: {
          studentId: true,
        },
      });

    const validStudentIds =
      new Set(
        enrollments.map(
          (item) => item.studentId
        )
      );


    /* --------------------------------------------------------
       VALIDATE PAYLOAD
    -------------------------------------------------------- */

    const seenStudentIds =
      new Set<string>();

    for (const item of attendance) {

      if (!item || typeof item !== "object") {
        return res.status(400).json({
          message:
            "Invalid attendance item",
        });
      }

      const studentId =
        String(
          item.studentId ?? ""
        ).trim();

      const status =
        String(
          item.status ?? ""
        ).trim();

      if (!studentId) {
        return res.status(400).json({
          message:
            "studentId is required for every attendance record",
        });
      }

      if (!validStudentIds.has(studentId)) {
        return res.status(403).json({
          message:
            `Student ${studentId} is not enrolled in this section`,
        });
      }

      if (seenStudentIds.has(studentId)) {
        return res.status(400).json({
          message:
            `Duplicate attendance record for student ${studentId}`,
        });
      }

      seenStudentIds.add(studentId);

      if (!validStatuses.has(status)) {
        return res.status(400).json({
          message:
            `Invalid attendance status for student ${studentId}`,
        });
      }

      if (
        item.remark !== undefined &&
        item.remark !== null &&
        typeof item.remark !== "string"
      ) {
        return res.status(400).json({
          message:
            `Invalid remark for student ${studentId}`,
        });
      }
    }


    /* --------------------------------------------------------
       SAVE IN TRANSACTION
    -------------------------------------------------------- */

    const operations = attendance.map((item: any) => { const studentId = String(item.studentId).trim(); const status = String(item.status).trim() as any; const remark = item.remark === undefined || item.remark === null || String(item.remark).trim() === "" ? null : String(item.remark).trim(); return prisma.attendance.upsert({ where: { schoolId_studentId_date: { schoolId, studentId, date: attendanceDate, }, }, create: { schoolId, studentId, classId: section.class.id, sectionId: section.id, academicYearId: academicYear.id, date: attendanceDate, status, markedByUserId: teacherUserId, remark, }, update: { classId: section.class.id, sectionId: section.id, academicYearId: academicYear.id, status, markedByUserId: teacherUserId, remark, }, select: { id: true, studentId: true, classId: true, sectionId: true, academicYearId: true, date: true, status: true, remark: true, markedByUserId: true, createdAt: true, updatedAt: true, }, }); }); const results = await prisma.$transaction(operations);


    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({
      message:
        "Student attendance saved successfully",

      date,

      section: {
        id: section.id,
        sectionName:
          section.sectionName,

        classId:
          section.class.id,

        classNumber:
          section.class.classNumber,

        classDisplayName:
          section.class.displayName,
      },

      count:
        results.length,

      attendance:
        results,
    });

  } catch (error) {

    console.error(
      "SAVE TEACHER SECTION ATTENDANCE ERROR:",
      error
    );
    return handleErr(
      error,
      res
    );
  }
};


const getTeacherStudentAttendanceHistory = async (
  req: any,
  res: any,
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId || !schoolId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const studentId = String(req.query.studentId || "").trim();
    const sectionId = String(req.query.sectionId || "").trim();

    if (!studentId || !sectionId) {
      return res.status(400).json({
        message: "studentId and sectionId are required",
      });
    }

    const academicYear = await prisma.academicYear.findFirst({
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
        message: "Current academic year not found",
      });
    }

    const hasAccess = await teacherHasSectionAccess(
      teacherUserId,
      schoolId,
      sectionId,
      academicYear.id
    );

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this section",
      });
    }

    const enrollment = await prisma.studentAcademicEnrollment.findFirst({
      where: {
        schoolId,
        academicYearId: academicYear.id,
        studentId,
        sectionId,
        enrollmentStatus: {
          not: "LEFT",
        },
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            name: true,
            fatherName: true,
            photoUrl: true,
            rollNumber: true,
          },
        },
        section: {
          select: {
            id: true,
            sectionName: true,
            class: {
              select: {
                id: true,
                classNumber: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      return res.status(404).json({
        message: "Student not found in this section",
      });
    }

    const attendance = await prisma.attendance.findMany({
      where: {
        schoolId,
        studentId,
        sectionId,
        academicYearId: academicYear.id,
      },
      orderBy: {
        date: "desc",
      },
      select: {
        id: true,
        date: true,
        status: true,
        remark: true,
        markedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const summary = {
      total: attendance.length,
      present: attendance.filter((a) => a.status === "PRESENT").length,
      absent: attendance.filter((a) => a.status === "ABSENT").length,
      late: attendance.filter((a) => a.status === "LATE").length,
      halfDay: attendance.filter((a) => a.status === "HALF_DAY").length,
      holiday: attendance.filter((a) => a.status === "HOLIDAY").length,
    };

    const workingDays =
      summary.present +
      summary.absent +
      summary.late +
      summary.halfDay;

    const attendancePercentage =
      workingDays > 0
        ? Number(
            (
              ((summary.present + summary.late + summary.halfDay * 0.5) /
                workingDays) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      academicYear,
      student: enrollment.student,
      section: enrollment.section,
      summary: {
        ...summary,
        workingDays,
        attendancePercentage,
      },
      attendance,
    });
  } catch (error) {
    return handleErr(error, res);
  }
};

/* ============================================================
   GET TEACHER MY STUDENTS
   ============================================================ */

/**
 * GET /attendance/student/my-students
 *
 * Returns all students belonging to sections assigned
 * to the authenticated teacher for the current academic year.
 */
const getTeacherMyStudents = async (
  req: any,
  res: any,
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId || !schoolId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    /* ----------------------------------------------------------
       CURRENT ACADEMIC YEAR
    ---------------------------------------------------------- */

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
        message: "Current academic year not found",
      });
    }

    /* ----------------------------------------------------------
       FIND TEACHER'S ASSIGNED SECTIONS

       Teacher can access a section when:
       1. They are the class teacher
       OR
       2. They have a subject mapping for that section
    ---------------------------------------------------------- */

    const sections =
      await prisma.section.findMany({
        where: {
          schoolId,

          class: {
            schoolId,
            academicYearId: academicYear.id,
            isCompleted: false,
          },

          OR: [
            {
              classTeacherId: teacherUserId,
            },
            {
              teacherMappings: {
                some: {
                  schoolId,
                  teacherUserId,
                  academicYearId: academicYear.id,
                },
              },
            },
          ],
        },

        select: {
          id: true,
          sectionName: true,

          class: {
            select: {
              id: true,
              classNumber: true,
              displayName: true,
            },
          },
        },

        orderBy: [
          {
            class: {
              classNumber: "asc",
            },
          },
          {
            sectionName: "asc",
          },
        ],
      });

    if (sections.length === 0) {
      return res.status(200).json({
        academicYear,
        summary: {
          totalStudents: 0,
          totalSections: 0,
          totalClasses: 0,
        },
        sections: [],
        students: [],
      });
    }

    const sectionIds = sections.map(
      (section) => section.id
    );

    /* ----------------------------------------------------------
       GET CURRENT ENROLLMENTS
    ---------------------------------------------------------- */

    const enrollments =
      await prisma.studentAcademicEnrollment.findMany({
        where: {
          schoolId,
          academicYearId: academicYear.id,

          sectionId: {
            in: sectionIds,
          },

          enrollmentStatus: {
            not: "LEFT",
          },
        },

        select: {
          id: true,
          sectionId: true,
          classId: true,
          enrollmentStatus: true,

          student: {
            select: {
              id: true,
              admissionNo: true,
              name: true,
              fatherName: true,
              motherName: true,
              dob: true,
              doj: true,
              gender: true,
              bloodGroup: true,
              phone: true,
              emergencyContact: true,
              photoUrl: true,
              rollNumber: true,
              status: true,
            },
          },
        },

        orderBy: {
          student: {
            name: "asc",
          },
        },
      });

    /* ----------------------------------------------------------
       SECTION MAP
    ---------------------------------------------------------- */

    const sectionMap = new Map(
      sections.map((section) => [
        section.id,
        section,
      ])
    );

    /* ----------------------------------------------------------
       BUILD RESPONSE
    ---------------------------------------------------------- */

    const students = enrollments.map(
      (enrollment) => {
        const section = sectionMap.get(
          enrollment.sectionId
        );

        return {
          enrollmentId: enrollment.id,

          id: enrollment.student.id,
          admissionNo:
            enrollment.student.admissionNo,
          name: enrollment.student.name,

          fatherName:
            enrollment.student.fatherName,
          motherName:
            enrollment.student.motherName,

          dob: enrollment.student.dob,
          doj: enrollment.student.doj,

          gender:
            enrollment.student.gender,

          bloodGroup:
            enrollment.student.bloodGroup,

          phone:
            enrollment.student.phone,

          emergencyContact:
            enrollment.student.emergencyContact,

          photoUrl:
            enrollment.student.photoUrl,

          rollNumber:
            enrollment.student.rollNumber,

          studentStatus:
            enrollment.student.status,

          enrollmentStatus:
            enrollment.enrollmentStatus,

          classId:
            enrollment.classId,

          classNumber:
            section?.class.classNumber ?? "",

          classDisplayName:
            section?.class.displayName ?? "",

          sectionId:
            enrollment.sectionId,

          sectionName:
            section?.sectionName ?? "",
        };
      }
    );

    /* ----------------------------------------------------------
       SECTION SUMMARY
    ---------------------------------------------------------- */

    const sectionSummary =
      sections.map((section) => ({
        sectionId: section.id,
        sectionName: section.sectionName,

        classId: section.class.id,
        classNumber: section.class.classNumber,
        classDisplayName:
          section.class.displayName,

        totalStudents:
          students.filter(
            (student) =>
              student.sectionId === section.id
          ).length,
      }));

    const uniqueClassIds =
      new Set(
        sections.map(
          (section) => section.class.id
        )
      );

    return res.status(200).json({
      academicYear,

      summary: {
        totalStudents: students.length,
        totalSections: sections.length,
        totalClasses: uniqueClassIds.size,
      },

      sections: sectionSummary,

      students,
    });
  } catch (error) {
    console.error(
      "GET TEACHER MY STUDENTS ERROR:",
      error
    );

    return handleErr(error, res);
  }
};


/**
 * Get logged-in teacher attendance history
 *
 * GET /api/v1/teacher-attendance/my-attendance
 *
 * Query:
 *   month=2026-09
 */
const getMyTeacherAttendance = async (
  req: any,
  res: any
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

    const month =
      typeof req.query.month === "string"
        ? req.query.month
        : undefined;

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
        message: "Current academic year not found",
      });
    }

    const where: any = {
      schoolId,
      teacherUserId,
      date: {
        gte: academicYear.startDate,
        lte: academicYear.endDate,
      },
    };

    /**
     * Optional month filter.
     * Format: YYYY-MM
     */
    if (month) {
      const match = /^(\d{4})-(\d{2})$/.exec(month);

      if (!match) {
        return res.status(400).json({
          message: "Invalid month. Expected YYYY-MM",
        });
      }

      const year = Number(match[1]);
      const monthNumber = Number(match[2]);

      if (
        monthNumber < 1 ||
        monthNumber > 12
      ) {
        return res.status(400).json({
          message: "Invalid month",
        });
      }

      const monthStart = new Date(
        Date.UTC(year, monthNumber - 1, 1)
      );

      const nextMonthStart = new Date(
        Date.UTC(year, monthNumber, 1)
      );

      where.date = {
        gte:
          monthStart > academicYear.startDate
            ? monthStart
            : academicYear.startDate,
        lt:
          nextMonthStart < academicYear.endDate
            ? nextMonthStart
            : academicYear.endDate,
      };
    }

    const attendance =
      await prisma.teacherAttendance.findMany({
        where,
        orderBy: {
          date: "desc",
        },
        select: {
          id: true,
          date: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    /**
     * Calculate summary.
     */
    const summary = {
      total: attendance.length,
      present: 0,
      absent: 0,
      halfDay: 0,
      onLeave: 0,
    };

    attendance.forEach((item: any) => {
      switch (item.status) {
        case "PRESENT":
          summary.present++;
          break;

        case "ABSENT":
          summary.absent++;
          break;

        case "HALF_DAY":
          summary.halfDay++;
          break;

        case "ON_LEAVE":
          summary.onLeave++;
          break;
      }
    });

    const attendancePercentage =
      summary.total > 0
        ? Number(
            (
              ((summary.present +
                summary.halfDay * 0.5) /
                summary.total) *
              100
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      academicYear,
      month: month || null,
      summary: {
        ...summary,
        attendancePercentage,
      },
      totalRecords: attendance.length,
      attendance,
    });
  } catch (error) {
    return handleErr( error, res);
  }
};

/**
 * Get logged-in teacher's attendance for today
 *
 * GET /api/v1/teacher-attendance/my-attendance/today
 */
const getMyTeacherAttendanceToday = async (
  req: any,
  res: any
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

    const today = new Date();

    const startOfDay = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
      )
    );

    const attendance =
      await prisma.teacherAttendance.findUnique({
        where: {
          schoolId_teacherUserId_date: {
            schoolId,
            teacherUserId,
            date: startOfDay,
          },
        },
        select: {
          id: true,
          date: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return res.status(200).json({
      date: startOfDay,
      marked: Boolean(attendance),
      attendance,
    });
  } catch (error) {
    return handleErr(error,res);
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

  getTeacherSectionStudents,

  getTeacherSectionAttendance,

  saveTeacherSectionAttendance,
  getTeacherStudentAttendanceHistory,
  getTeacherMyStudents,

  getMyTeacherAttendance,
  getMyTeacherAttendanceToday,
  
};