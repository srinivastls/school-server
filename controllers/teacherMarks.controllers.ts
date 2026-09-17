import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

/* ============================================================
   GET MARKS ENTRY OPTIONS
   ============================================================ */

const getTeacherMarksOptions = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId || !schoolId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

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
       TEACHER SUBJECT MAPPINGS
    -------------------------------------------------------- */

    const mappings =
      await prisma.teacherSubjectMapping.findMany({
        where: {
          schoolId,
          teacherUserId,
          academicYearId: academicYear.id,
        },

        select: {
          id: true,

          section: {
            select: {
              id: true,
              sectionName: true,

              class: {
                select: {
                  id: true,
                  classNumber: true,
                  displayName: true,
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

        orderBy: {
          subject: {
            name: "asc",
          },
        },
      });

    /* --------------------------------------------------------
       ONLY ACTIVE CLASSES
    -------------------------------------------------------- */

    const validMappings =
      mappings.filter(
        (mapping) =>
          !mapping.section.class.isCompleted
      );

    /* --------------------------------------------------------
       EXAMS AVAILABLE FOR THOSE CLASSES
    -------------------------------------------------------- */

    const classIds = [
      ...new Set(
        validMappings.map(
          (mapping) =>
            mapping.section.class.id
        )
      ),
    ];

    const exams =
      classIds.length === 0
        ? []
        : await prisma.exam.findMany({
            where: {
              schoolId,
              academicYearId:
                academicYear.id,

              examSubjects: {
                some: {
                  classId: {
                    in: classIds,
                  },
                },
              },
            },

            select: {
              id: true,
              name: true,
              type: true,
              termNumber: true,
              startDate: true,
              endDate: true,
              isPublished: true,

              examSubjects: {
                where: {
                  classId: {
                    in: classIds,
                  },
                },

                select: {
                  id: true,
                  subjectId: true,
                  classId: true,
                  maxMarks: true,
                  passingMarks: true,
                  weightage: true,

                  subject: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              startDate: "asc",
            },
          });

    /* --------------------------------------------------------
       GROUP BY CLASS
    -------------------------------------------------------- */

    const classMap = new Map<
      string,
      {
        id: string;
        classNumber: string;
        displayName: string;
        sections: Map<
          string,
          {
            id: string;
            sectionName: string;
            subjects: Map<
              string,
              {
                id: string;
                name: string;
                code: string;
                isOptional: boolean;
              }
            >;
          }
        >;
      }
    >();

    for (const mapping of validMappings) {
      const classData =
        mapping.section.class;

      let classItem =
        classMap.get(classData.id);

      if (!classItem) {
        classItem = {
          id: classData.id,
          classNumber:
            classData.classNumber,
          displayName:
            classData.displayName,
          sections: new Map(),
        };

        classMap.set(
          classData.id,
          classItem
        );
      }

      let sectionItem =
        classItem.sections.get(
          mapping.section.id
        );

      if (!sectionItem) {
        sectionItem = {
          id: mapping.section.id,
          sectionName:
            mapping.section.sectionName,
          subjects: new Map(),
        };

        classItem.sections.set(
          mapping.section.id,
          sectionItem
        );
      }

      sectionItem.subjects.set(
        mapping.subject.id,
        {
          id: mapping.subject.id,
          name: mapping.subject.name,
          code: mapping.subject.code,
          isOptional:
            mapping.subject.isOptional,
        }
      );
    }

    const classes =
      Array.from(
        classMap.values()
      ).map((classItem) => ({
        id: classItem.id,
        classNumber:
          classItem.classNumber,
        displayName:
          classItem.displayName,

        sections:
          Array.from(
            classItem.sections.values()
          ).map((section) => ({
            id: section.id,
            sectionName:
              section.sectionName,

            subjects:
              Array.from(
                section.subjects.values()
              ),
          })),
      }));

    return res.status(200).json({
      academicYear,
      classes,
      exams,
    });
  } catch (error) {
    console.error(
      "GET TEACHER MARKS OPTIONS ERROR:",
      error
    );

    return handleErr(error, res);
  }
};


/* ============================================================
   GET MARKS FOR ENTRY
   ============================================================ */

const getTeacherMarksEntry = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    const {
      sectionId,
      subjectId,
      examId,
    } = req.query;

    if (
      !teacherUserId ||
      !schoolId
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (
      !sectionId ||
      !subjectId ||
      !examId
    ) {
      return res.status(400).json({
        message:
          "sectionId, subjectId and examId are required",
      });
    }

    /* --------------------------------------------------------
       CURRENT YEAR
    -------------------------------------------------------- */

    const academicYear =
      await prisma.academicYear.findFirst({
        where: {
          schoolId,
          isCurrent: true,
        },
      });

    if (!academicYear) {
      return res.status(404).json({
        message:
          "Current academic year not found",
      });
    }

    /* --------------------------------------------------------
       VERIFY TEACHER ASSIGNMENT
    -------------------------------------------------------- */

    const mapping =
      await prisma.teacherSubjectMapping.findFirst({
        where: {
          schoolId,
          teacherUserId,
          sectionId: String(sectionId),
          subjectId: String(subjectId),
          academicYearId:
            academicYear.id,
        },

        select: {
          id: true,

          section: {
            select: {
              id: true,
              sectionName: true,

              class: {
                select: {
                  id: true,
                  classNumber: true,
                  displayName: true,
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
      });

    if (!mapping) {
      return res.status(403).json({
        message:
          "You are not assigned to this subject and section.",
      });
    }

    if (
      mapping.section.class.isCompleted
    ) {
      return res.status(400).json({
        message:
          "This class has been completed.",
      });
    }

    /* --------------------------------------------------------
       EXAM SUBJECT
    -------------------------------------------------------- */

    const examSubject =
      await prisma.examSubject.findFirst({
        where: {
          

          examId: String(examId),
          subjectId: String(subjectId),
          classId:
            mapping.section.class.id,

          exam: {
            schoolId,
            academicYearId:
              academicYear.id,
          },
        },

        select: {
          id: true,
          maxMarks: true,
          passingMarks: true,
          weightage: true,

          exam: {
            select: {
              id: true,
              name: true,
              type: true,
              termNumber: true,
              startDate: true,
              endDate: true,
              isPublished: true,
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
      });

    if (!examSubject) {
      return res.status(404).json({
        message:
          "Exam subject configuration not found.",
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
          sectionId: String(sectionId),

          enrollmentStatus: {
            not: "LEFT",
          },
        },

        select: {
          id: true,

          student: {
            select: {
              id: true,
              admissionNo: true,
              name: true,
              rollNumber: true,
              photoUrl: true,
            },
          },
        },

        orderBy: {
          student: {
            name: "asc",
          },
        },
      });

    const studentIds =
      enrollments.map(
        (item) => item.student.id
      );

    /* --------------------------------------------------------
       EXISTING MARKS
    -------------------------------------------------------- */

    const marks =
      studentIds.length === 0
        ? []
        : await prisma.mark.findMany({
            where: {
              schoolId,
              examSubjectId:
                examSubject.id,

              studentId: {
                in: studentIds,
              },
            },

            select: {
              id: true,
              studentId: true,
              marksObtained: true,
              isAbsent: true,
              isFinalized: true,
              enteredByUserId: true,
              createdAt: true,
              updatedAt: true,
            },
          });

    const markMap = new Map(
      marks.map((mark) => [
        mark.studentId,
        mark,
      ])
    );

    const students =
      enrollments.map(
        (enrollment) => {
          const mark =
            markMap.get(
              enrollment.student.id
            );

          return {
            enrollmentId:
              enrollment.id,

            id:
              enrollment.student.id,

            admissionNo:
              enrollment.student.admissionNo,

            name:
              enrollment.student.name,

            rollNumber:
              enrollment.student.rollNumber,

            photoUrl:
              enrollment.student.photoUrl,

            mark: mark
              ? {
                  id: mark.id,
                  marksObtained:
                    mark.marksObtained,
                  isAbsent:
                    mark.isAbsent,
                  isFinalized:
                    mark.isFinalized,
                }
              : null,
          };
        }
      );

    const finalized =
      marks.length > 0 &&
      marks.length ===
        studentIds.length &&
      marks.every(
        (mark) => mark.isFinalized
      );

    return res.status(200).json({
      academicYear,

      section: mapping.section,

      subject: mapping.subject,

      examSubject: {
        id: examSubject.id,
        maxMarks:
          examSubject.maxMarks,
        passingMarks:
          examSubject.passingMarks,
        weightage:
          examSubject.weightage,
      },

      exam:
        examSubject.exam,

      finalized,

      summary: {
        totalStudents:
          students.length,

        entered:
          students.filter(
            (student) =>
              student.mark !== null
          ).length,

        absent:
          students.filter(
            (student) =>
              student.mark?.isAbsent
          ).length,

        pending:
          students.filter(
            (student) =>
              student.mark === null
          ).length,
      },

      students,
    });
  } catch (error) {
    console.error(
      "GET TEACHER MARKS ENTRY ERROR:",
      error
    );

    return handleErr(error, res);
  }
};


/* ============================================================
   SAVE MARKS
   ============================================================ */

const saveTeacherMarks = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (
      !teacherUserId ||
      !schoolId
    ) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const {
      sectionId,
      subjectId,
      examId,
      finalize = false,
      marks,
    } = req.body;

    if (
      !sectionId ||
      !subjectId ||
      !examId ||
      !Array.isArray(marks)
    ) {
      return res.status(400).json({
        message:
          "sectionId, subjectId, examId and marks are required.",
      });
    }

    /* --------------------------------------------------------
       CURRENT YEAR
    -------------------------------------------------------- */

    const academicYear =
      await prisma.academicYear.findFirst({
        where: {
          schoolId,
          isCurrent: true,
        },
      });

    if (!academicYear) {
      return res.status(404).json({
        message:
          "Current academic year not found.",
      });
    }

    /* --------------------------------------------------------
       VERIFY SUBJECT ASSIGNMENT
    -------------------------------------------------------- */

    const mapping =
      await prisma.teacherSubjectMapping.findFirst({
        where: {
          schoolId,
          teacherUserId,
          sectionId: String(sectionId),
          subjectId: String(subjectId),
          academicYearId:
            academicYear.id,
        },

        select: {
          section: {
            select: {
              id: true,
              classId: true,
              class: {
                select: {
                  id: true,
                  isCompleted: true,
                },
              },
            },
          },
        },
      });

    if (!mapping) {
      return res.status(403).json({
        message:
          "You are not assigned to this subject and section.",
      });
    }

    if (
      mapping.section.class.isCompleted
    ) {
      return res.status(400).json({
        message:
          "This class has been completed.",
      });
    }

    /* --------------------------------------------------------
       EXAM SUBJECT
    -------------------------------------------------------- */

    const examSubject =
      await prisma.examSubject.findFirst({
        where: {
          examId: String(examId),
          subjectId: String(subjectId),
          classId:
            mapping.section.classId,

          exam: {
            schoolId,
            academicYearId:
              academicYear.id,
          },
        },

        select: {
          id: true,
          maxMarks: true,
        },
      });

    if (!examSubject) {
      return res.status(404).json({
        message:
          "Exam subject configuration not found.",
      });
    }

    /* --------------------------------------------------------
       STUDENTS BELONGING TO SECTION
    -------------------------------------------------------- */

    const enrollments =
      await prisma.studentAcademicEnrollment.findMany({
        where: {
          schoolId,
          academicYearId:
            academicYear.id,
          sectionId: String(sectionId),

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
       VALIDATE INPUT
    -------------------------------------------------------- */

    const seen =
      new Set<string>();

    for (const item of marks) {
      if (
        !item ||
        typeof item.studentId !==
          "string"
      ) {
        return res.status(400).json({
          message:
            "Invalid student in marks payload.",
        });
      }

      if (
        seen.has(item.studentId)
      ) {
        return res.status(400).json({
          message:
            "Duplicate student in marks payload.",
        });
      }

      seen.add(item.studentId);

      if (
        !validStudentIds.has(
          item.studentId
        )
      ) {
        return res.status(403).json({
          message:
            "One or more students do not belong to this section.",
        });
      }

      const isAbsent =
        Boolean(item.isAbsent);

      if (isAbsent) {
        continue;
      }

      if (
        item.marksObtained === null ||
        item.marksObtained === undefined ||
        item.marksObtained === ""
      ) {
        if (finalize) {
          return res.status(400).json({
            message:
              "All students must have marks or be marked AB before finalization.",
          });
        }

        continue;
      }

      const value =
        Number(item.marksObtained);

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value >
          examSubject.maxMarks
      ) {
        return res.status(400).json({
          message:
            `Marks must be between 0 and ${examSubject.maxMarks}.`,
        });
      }
    }

    /* --------------------------------------------------------
       CHECK FINALIZED MARKS
    -------------------------------------------------------- */

    const existingMarks =
      await prisma.mark.findMany({
        where: {
          schoolId,
          examSubjectId:
            examSubject.id,

          studentId: {
            in: Array.from(
              validStudentIds
            ),
          },
        },

        select: {
          studentId: true,
          isFinalized: true,
        },
      });

    const finalizedStudents =
      new Set(
        existingMarks
          .filter(
            (mark) =>
              mark.isFinalized
          )
          .map(
            (mark) =>
              mark.studentId
          )
      );

    if (
      finalizedStudents.size > 0
    ) {
      return res.status(409).json({
        message:
          "Some marks are already finalized and cannot be edited.",
      });
    }

    /* --------------------------------------------------------
       FINALIZE VALIDATION
    -------------------------------------------------------- */

    if (finalize) {
      if (
        marks.length !==
        validStudentIds.size
      ) {
        return res.status(400).json({
          message:
            "All students must be included before finalization.",
        });
      }

      for (const studentId of validStudentIds) {
        const item =
          marks.find(
            (entry: any) =>
              entry.studentId ===
              studentId
          );

        if (
          !item ||
          (
            !item.isAbsent &&
            (
              item.marksObtained ===
                null ||
              item.marksObtained ===
                undefined ||
              item.marksObtained ===
                ""
            )
          )
        ) {
          return res.status(400).json({
            message:
              "All students must have marks or AB before finalization.",
          });
        }
      }
    }

    /* --------------------------------------------------------
       SAVE TRANSACTION
    -------------------------------------------------------- */

    await prisma.$transaction(
      async (tx) => {

        for (const item of marks) {

          const isAbsent =
            Boolean(item.isAbsent);

          const marksObtained =
            isAbsent
              ? 0
              : (
                  item.marksObtained ===
                    "" ||
                  item.marksObtained ===
                    null ||
                  item.marksObtained ===
                    undefined
                )
                ? null
                : Number(
                    item.marksObtained
                  );

          await tx.mark.upsert({
            where: {
              studentId_examSubjectId: {
                studentId:
                  item.studentId,
                examSubjectId:
                  examSubject.id,
              },
            },

            create: {
              schoolId,

              studentId:
                item.studentId,

              examSubjectId:
                examSubject.id,

              marksObtained,

              isAbsent,

              enteredByUserId:
                teacherUserId,

              isFinalized:
                Boolean(finalize),
            },

            update: {
              marksObtained,

              isAbsent,

              enteredByUserId:
                teacherUserId,

              isFinalized:
                Boolean(finalize),
            },
          });
        }
      }
    );

    return res.status(200).json({
      message: finalize
        ? "Marks finalized successfully."
        : "Marks saved as draft.",

      finalized:
        Boolean(finalize),

      savedCount:
        marks.length,
    });
  } catch (error) {
    console.error(
      "SAVE TEACHER MARKS ERROR:",
      error
    );

    return handleErr(error, res);
  }
};


export {
  getTeacherMarksOptions,
  getTeacherMarksEntry,
  saveTeacherMarks,
};