import { prisma } from "../config";

import {
  Request,
  Response,
  RequestWithQuery,
  RequestWithBody,
} from "../types";

import { handleErr } from "../utils";

import { Prisma } from "@prisma/client";
/* ============================================================
   TYPES
============================================================ */

type GetPromotionStudentsQuery = {
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
  classId?: string;
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
   GET STUDENTS FOR PROMOTION
============================================================ */

const getPromotionStudents = async (
  req: RequestWithQuery<GetPromotionStudentsQuery>,
  res: Response
) => {

  try {

    const {
      sourceAcademicYearId,
      targetAcademicYearId,
      classId,
    } = req.query;


    /* ========================================================
       SCHOOL
    ======================================================== */

    const schoolId =
      getSchoolId(req);


    if (!schoolId) {

      return res.status(400).json({
        message:
          "schoolId is required",
      });

    }


    /* ========================================================
       VALIDATION
    ======================================================== */

    if (
      !sourceAcademicYearId ||
      !targetAcademicYearId
    ) {

      return res.status(400).json({
        message:
          "sourceAcademicYearId and targetAcademicYearId are required",
      });

    }


    if (
      sourceAcademicYearId ===
      targetAcademicYearId
    ) {

      return res.status(400).json({
        message:
          "Source and target academic years cannot be the same",
      });

    }


    /* ========================================================
       VERIFY SOURCE ACADEMIC YEAR
    ======================================================== */

    const sourceAcademicYear =
      await prisma.academicYear.findFirst({

        where: {

          id:
            sourceAcademicYearId,

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


    if (!sourceAcademicYear) {

      return res.status(404).json({
        message:
          "Source academic year not found",
      });

    }


    /* ========================================================
       VERIFY TARGET ACADEMIC YEAR
    ======================================================== */

    const targetAcademicYear =
      await prisma.academicYear.findFirst({

        where: {

          id:
            targetAcademicYearId,

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


    if (!targetAcademicYear) {

      return res.status(404).json({
        message:
          "Target academic year not found",
      });

    }


    /* ========================================================
       GET SOURCE CLASSES
    ======================================================== */

    const sourceClasses =
      await prisma.class.findMany({

        where: {

          schoolId,

          academicYearId:
            sourceAcademicYearId,

          ...(classId
            ? {
                id:
                  classId,
              }
            : {}),

        },

        select: {

          id: true,

          classNumber: true,

          displayName: true,

        },

        orderBy: {

          classNumber:
            "asc",

        },

      });


    if (
      sourceClasses.length === 0
    ) {

      return res.status(404).json({
        message:
          "No classes found in source academic year",
      });

    }


    /* ========================================================
       GET STUDENTS
    ======================================================== */

    const students =
      await prisma.student.findMany({

        where: {

          schoolId,

          classId: {
            in:
              sourceClasses.map(
                item => item.id
              ),
          },

          /*
           * Only active students should
           * normally participate in promotion.
           */
          status:
            "ACTIVE",

        },

        select: {

          id: true,

          admissionNo: true,

          name: true,

          fatherName: true,

          phone: true,

          rollNumber: true,

          classId: true,

          sectionId: true,

          pendingAmount: true,

          status: true,

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

          promotionHistory: {

            where: {

              schoolId,

              fromAcademicYearId:
                sourceAcademicYearId,

              toAcademicYearId:
                targetAcademicYearId,

            },

            select: {

              id: true,

              status: true,

              remark: true,

              toClassId: true,

              toSectionId: true,

              createdAt: true,

            },

            take: 1,

          },

        },

        orderBy: [

          {

            classId:
              "asc",

          },

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
       TARGET CLASSES
    ======================================================== */

    const targetClasses =
      await prisma.class.findMany({

        where: {

          schoolId,

          academicYearId:
            targetAcademicYearId,

          isCompleted:
            false,

        },

        select: {

          id: true,

          classNumber: true,

          displayName: true,

          sections: {

            select: {

              id: true,

              sectionName: true,

            },

            orderBy: {

              sectionName:
                "asc",

            },

          },

        },

        orderBy: {

          classNumber:
            "asc",

        },

      });


    /* ========================================================
       CLASS NUMBER HELPER
    ======================================================== */

    const getSuggestedClass =
      (
        currentClassNumber: string
      ) => {

        /*
         * Handles normal numeric classes:
         *
         * 1 → 2
         * 2 → 3
         * ...
         * 10 → 11
         *
         * If the class number is not numeric,
         * no automatic suggestion is made.
         */

        const number =
          Number(
            currentClassNumber
          );


        if (
          !Number.isInteger(number)
        ) {

          return null;

        }


        const nextNumber =
          String(
            number + 1
          );


        return (
          targetClasses.find(
            item =>
              item.classNumber ===
              nextNumber
          ) ??
          null
        );

      };


    /* ========================================================
       MAP STUDENTS
    ======================================================== */

    const result =
      students.map(
        student => {

          const pendingAmount =
            Number(
              student.pendingAmount ??
              0
            );


          const eligible =
            pendingAmount === 0;


          const suggestedClass =
            getSuggestedClass(
              student.class.classNumber
            );


          const existingPromotion =
            (student
              .promotionHistory?.[0] ??
            null) as any;


          return {

            id:
              student.id,

            admissionNo:
              student.admissionNo,

            name:
              student.name,

            fatherName:
              student.fatherName,

            phone:
              student.phone,

            rollNumber:
              student.rollNumber,

            currentClass: {

              id:
                student.class.id,

              classNumber:
                student.class.classNumber,

              displayName:
                student.class.displayName,

            },

            currentSection: {

              id:
                student.section.id,

              sectionName:
                student.section.sectionName,

            },

            pendingAmount,

            eligible,

            eligibilityReason:
              eligible
                ? "No pending fee"
                : "Pending fee must be cleared before promotion",

            suggestedClass:
              suggestedClass
                ? {

                    id:
                      suggestedClass.id,

                    classNumber:
                      suggestedClass.classNumber,

                    displayName:
                      suggestedClass.displayName,

                  }
                : null,

            promotion:
              existingPromotion
                ? {

                    id:
                      existingPromotion.id,

                    status:
                      existingPromotion.status,

                    remark:
                      existingPromotion.remark,

                    toClassId:
                      existingPromotion.toClassId,

                    toSectionId:
                      existingPromotion.toSectionId,

                    createdAt:
                      existingPromotion.createdAt,

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

      eligible:
        result.filter(
          student =>
            student.eligible
        ).length,

      notEligible:
        result.filter(
          student =>
            !student.eligible
        ).length,

      alreadyProcessed:
        result.filter(
          student =>
            Boolean(
              student.promotion
            )
        ).length,

    };


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      sourceAcademicYear,

      targetAcademicYear,

      summary,

      sourceClasses,

      targetClasses,

      students:
        result,

    });

  } catch (error) {

    console.error(
      "GET PROMOTION STUDENTS ERROR:",
      error
    );

    return handleErr(
      error as any,
      res
    );

  }

};


type PromoteStudentRequest = {
  studentId: string;

  fromAcademicYearId: string;

  toAcademicYearId: string;

  toClassId: string;

  toSectionId: string;

  status:
    | "PROMOTED"
    | "DEMOTED"
    | "REPEATED"
    | "NOT_PROMOTED";

  remark?: string;
};


/* ============================================================
   HELPERS
============================================================ */



/* ============================================================
   PROMOTE / DEMOTE / REPEAT STUDENT
============================================================ */

const processStudentPromotion = async (
  req: RequestWithBody<
    PromoteStudentRequest
  >,
  res: Response
) => {

  try {

    const {
      studentId,
      fromAcademicYearId,
      toAcademicYearId,
      toClassId,
      toSectionId,
      status,
      remark,
    } = req.body;


    /* ========================================================
       SCHOOL
    ======================================================== */

    const schoolId =
      getSchoolId(req);


    if (!schoolId) {

      return res.status(400).json({
        message:
          "schoolId is required",
      });

    }


    /* ========================================================
       AUTHENTICATED USER
    ======================================================== */

    const promotedByUserId =
      req.user?.id;


    if (!promotedByUserId) {

      return res.status(401).json({
        message:
          "Authenticated user not found",
      });

    }


    /* ========================================================
       VALIDATION
    ======================================================== */

    if (
      !studentId ||
      !fromAcademicYearId ||
      !toAcademicYearId ||
      !status
    ) {

      return res.status(400).json({
        message:
          "studentId, fromAcademicYearId, toAcademicYearId and status are required",
      });

    }


    const validStatuses = [
      "PROMOTED",
      "DEMOTED",
      "REPEATED",
      "NOT_PROMOTED",
    ];


    if (
      !validStatuses.includes(
        status
      )
    ) {

      return res.status(400).json({
        message:
          "Invalid promotion status",
      });

    }


    /* ========================================================
       TARGET CLASS / SECTION
    ======================================================== */

    /*
     * A student needs a target class and
     * section for every actual movement.
     *
     * NOT_PROMOTED does not require them.
     */

    if (
      status !== "NOT_PROMOTED" &&
      (
        !toClassId ||
        !toSectionId
      )
    ) {

      return res.status(400).json({
        message:
          "Target class and section are required",
      });

    }


    /* ========================================================
       VERIFY PRINCIPAL
    ======================================================== */

    const principal =
      await prisma.user.findFirst({

        where: {

          id:
            promotedByUserId,

          schoolId,

          isActive:
            true,

          role:
            "PRINCIPAL",

        },

        select: {

          id: true,

        },

      });


    if (!principal) {

      return res.status(403).json({
        message:
          "Only the Principal can process student promotion",
      });

    }


    /* ========================================================
       VERIFY ACADEMIC YEARS
    ======================================================== */

    const academicYears =
      await prisma.academicYear.findMany({

        where: {

          schoolId,

          id: {

            in: [
              fromAcademicYearId,
              toAcademicYearId,
            ],

          },

        },

        select: {

          id: true,

          name: true,

        },

      });


    if (
      academicYears.length !== 2
    ) {

      return res.status(404).json({
        message:
          "One or both academic years were not found",
      });

    }


    if (
      fromAcademicYearId ===
      toAcademicYearId
    ) {

      return res.status(400).json({
        message:
          "Source and target academic years cannot be the same",
      });

    }


    /* ========================================================
       TRANSACTION
    ======================================================== */

    const result =
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {

          /* ==================================================
             GET STUDENT
          ================================================== */

          const student =
            await tx.student.findFirst({

              where: {

                id:
                  studentId,

                schoolId,

              },

              include: {

                class: {

                  include: {

                    academicYear:
                      true,

                  },

                },

                section:
                  true,

              },

            });


          if (!student) {

            throw new Error(
              "STUDENT_NOT_FOUND"
            );

          }


          /* ==================================================
             VERIFY STUDENT IS IN SOURCE YEAR
          ================================================== */

          if (
            student.class.academicYearId !==
            fromAcademicYearId
          ) {

            throw new Error(
              "STUDENT_NOT_IN_SOURCE_YEAR"
            );

          }


          /* ==================================================
             PENDING FEE
          ================================================== */

          const pendingAmount =
            Number(
              student.pendingAmount ??
              0
            );


          /* ==================================================
             PROMOTION ELIGIBILITY
          ================================================== */

          if (
            status === "PROMOTED" &&
            pendingAmount > 0
          ) {

            throw new Error(
              "PENDING_FEE"
            );

          }


          /* ==================================================
             TARGET CLASS
          ================================================== */

          let targetClass:
            | {
                id: string;
                classNumber: string;
                displayName: string;
                academicYearId: string;
              }
            | null = null;


          if (
            status !== "NOT_PROMOTED"
          ) {

            targetClass =
              await tx.class.findFirst({

                where: {

                  id:
                    toClassId,

                  schoolId,

                  academicYearId:
                    toAcademicYearId,

                  isCompleted:
                    false,

                },

                select: {

                  id: true,

                  classNumber:
                    true,

                  displayName:
                    true,

                  academicYearId:
                    true,

                },

              });


            if (!targetClass) {

              throw new Error(
                "TARGET_CLASS_NOT_FOUND"
              );

            }

          }


          /* ==================================================
             TARGET SECTION
          ================================================== */

          let targetSection:
            | {
                id: string;
                sectionName: string;
                classId: string;
              }
            | null = null;


          if (
            status !== "NOT_PROMOTED"
          ) {

            targetSection =
              await tx.section.findFirst({

                where: {

                  id:
                    toSectionId,

                  schoolId,

                  classId:
                    toClassId,

                },

                select: {

                  id: true,

                  sectionName:
                    true,

                  classId:
                    true,

                },

              });


            if (!targetSection) {

              throw new Error(
                "TARGET_SECTION_NOT_FOUND"
              );

            }

          }


          /* ==================================================
             CHECK EXISTING DECISION
          ================================================== */

          const existingPromotion =
          
            await tx.studentPromotion.findFirst({

              where: {

                schoolId,

                studentId,

                fromAcademicYearId,

                toAcademicYearId,

              },

              select: {

                id: true,

              },

            });


          if (existingPromotion) {

            throw new Error(
              "PROMOTION_ALREADY_PROCESSED"
            );

          }


          /* ==================================================
             CREATE HISTORY
          ================================================== */

          const promotion =
            await tx.studentPromotion.create({

              data: {

                schoolId,

                studentId,

                fromAcademicYearId,

                toAcademicYearId,

                fromClassId:
                  student.classId,

                fromSectionId:
                  student.sectionId,

                toClassId:
                  targetClass?.id ??
                  null,

                toSectionId:
                  targetSection?.id ??
                  null,

                status,

                remark:
                  remark?.trim() ||
                  null,

                promotedByUserId,

              },

              include: {

                fromAcademicYear:
                  true,

                toAcademicYear:
                  true,

                fromClass:
                  true,

                toClass:
                  true,

                fromSection:
                  true,

                toSection:
                  true,

              },

            });


          /* ==================================================
             NOT PROMOTED
          ================================================== */

          if (
            status === "NOT_PROMOTED"
          ) {

            return {

              promotion,

              student,

            };

          }


          /* ==================================================
             UPDATE STUDENT
          ================================================== */

          const updatedStudent =
            await tx.student.update({

              where: {

                id:
                  student.id,

              },

              data: {

                classId:
                  targetClass!.id,

                sectionId:
                  targetSection!.id,

                /*
                 * Keep the existing pending
                 * amount untouched here.
                 *
                 * Fee rollover / reset should
                 * be handled separately.
                 */

              },

              include: {

                class:
                  true,

                section:
                  true,

              },

            });


          return {

            promotion,

            student:
              updatedStudent,

          };

        }
      );


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      message:
        "Student promotion processed successfully",

      promotion:
        result.promotion,

      student:
        result.student,

    });

  } catch (error: any) {

    console.error(
      "PROCESS STUDENT PROMOTION ERROR:",
      error
    );


    /* ========================================================
       KNOWN ERRORS
    ======================================================== */

    switch (
      error?.message
    ) {

      case "STUDENT_NOT_FOUND":

        return res.status(404).json({
          message:
            "Student not found",
        });


      case "STUDENT_NOT_IN_SOURCE_YEAR":

        return res.status(400).json({
          message:
            "Student does not belong to the selected source academic year",
        });


      case "PENDING_FEE":

        return res.status(400).json({
          message:
            "Student has pending fees and cannot be promoted",
        });


      case "TARGET_CLASS_NOT_FOUND":

        return res.status(404).json({
          message:
            "Target class not found for the target academic year",
        });


      case "TARGET_SECTION_NOT_FOUND":

        return res.status(404).json({
          message:
            "Target section not found for the selected class",
        });


      case "PROMOTION_ALREADY_PROCESSED":

        return res.status(409).json({
          message:
            "Promotion decision has already been processed for this student",
        });


      default:

        return handleErr(
          error,
          res
        );

    }

  }

};


/* ============================================================
   BULK STUDENT PROMOTION
============================================================ */

type BulkPromotionItem = {
  studentId: string;
  toClassId: string;
  toSectionId: string;
  status:
    | "PROMOTED"
    | "DEMOTED"
    | "REPEATED"
    | "NOT_PROMOTED";
  remark?: string;
};

type BulkPromotionRequest = {
  fromAcademicYearId: string;
  toAcademicYearId: string;
  students: BulkPromotionItem[];
};


/* ============================================================
   BULK PROCESS PROMOTION
============================================================ */

const processBulkStudentPromotion = async (
  req: RequestWithBody<BulkPromotionRequest>,
  res: Response
) => {

  try {

    const {
      fromAcademicYearId,
      toAcademicYearId,
      students,
    } = req.body;

    const schoolId =
      getSchoolId(req);

    const promotedByUserId =
      req.user?.id;


    /* ========================================================
       BASIC VALIDATION
    ======================================================== */

    if (!schoolId) {

      return res.status(400).json({
        message:
          "schoolId is required",
      });

    }

    if (!promotedByUserId) {

      return res.status(401).json({
        message:
          "Authenticated user not found",
      });

    }

    if (
      !fromAcademicYearId ||
      !toAcademicYearId
    ) {

      return res.status(400).json({
        message:
          "Source and target academic years are required",
      });

    }

    if (
      fromAcademicYearId ===
      toAcademicYearId
    ) {

      return res.status(400).json({
        message:
          "Source and target academic years cannot be the same",
      });

    }

    if (
      !Array.isArray(students) ||
      students.length === 0
    ) {

      return res.status(400).json({
        message:
          "Student promotion data is required",
      });

    }


    /* ========================================================
       VERIFY PRINCIPAL
    ======================================================== */

    const principal =
      await prisma.user.findFirst({

        where: {

          id:
            promotedByUserId,

          schoolId,

          isActive:
            true,

          role:
            "PRINCIPAL",

        },

        select: {
          id: true,
        },

      });


    if (!principal) {

      return res.status(403).json({
        message:
          "Only the Principal can process student promotion",
      });

    }


    /* ========================================================
       DUPLICATE STUDENT CHECK
    ======================================================== */

    const studentIds =
      students.map(
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
          "Duplicate student entries found",
      });

    }


    /* ========================================================
       VALID STATUSES
    ======================================================== */

    const validStatuses = [
      "PROMOTED",
      "DEMOTED",
      "REPEATED",
      "NOT_PROMOTED",
    ];


    for (
      const item of students
    ) {

      if (
        !item.studentId
      ) {

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
            `Invalid promotion status for student ${item.studentId}`,
        });

      }

      if (
        item.status !==
          "NOT_PROMOTED" &&
        (
          !item.toClassId ||
          !item.toSectionId
        )
      ) {

        return res.status(400).json({
          message:
            `Target class and section are required for student ${item.studentId}`,
        });

      }

    }


    /* ========================================================
       TRANSACTION
    ======================================================== */

    const result =
      await prisma.$transaction(
        async tx => {

          /* ==================================================
             VERIFY ACADEMIC YEARS
          ================================================== */

          const academicYears =
            await tx.academicYear.findMany({

              where: {

                schoolId,

                id: {

                  in: [
                    fromAcademicYearId,
                    toAcademicYearId,
                  ],

                },

              },

              select: {

                id: true,
                name: true,

              },

            });


          if (
            academicYears.length !== 2
          ) {

            throw new Error(
              "ACADEMIC_YEAR_NOT_FOUND"
            );

          }


          /* ==================================================
             LOAD STUDENTS
          ================================================== */

          const dbStudents =
            await tx.student.findMany({

              where: {

                schoolId,

                id: {
                  in:
                    studentIds,
                },

                status:
                  "ACTIVE",

              },

              include: {

                class: {

                  include: {

                    academicYear:
                      true,

                  },

                },

                section:
                  true,

              },

            });


          /* ==================================================
             VERIFY ALL STUDENTS
          ================================================== */

          const dbStudentMap =
            new Map(
              dbStudents.map(
                student => [
                  student.id,
                  student,
                ]
              )
            );


          for (
            const studentId
              of studentIds
          ) {

            if (
              !dbStudentMap.has(
                studentId
              )
            ) {

              throw new Error(
                `STUDENT_NOT_FOUND:${studentId}`
              );

            }

          }


          /* ==================================================
             VERIFY SOURCE YEAR
          ================================================== */

          for (
            const student
              of dbStudents
          ) {

            if (
              student.class
                .academicYearId !==
              fromAcademicYearId
            ) {

              throw new Error(
                `STUDENT_NOT_IN_SOURCE_YEAR:${student.id}`
              );

            }

          }


          /* ==================================================
             CHECK EXISTING PROMOTIONS
          ================================================== */

          const existingPromotions =
            await tx.studentPromotion.findMany({

              where: {

                schoolId,

                studentId: {
                  in:
                    studentIds,
                },

                fromAcademicYearId,

                toAcademicYearId,

              },

              select: {

                studentId:
                  true,

              },

            });


          if (
            existingPromotions.length > 0
          ) {

            throw new Error(
              `PROMOTION_ALREADY_PROCESSED:${existingPromotions
                .map((item: { studentId: string }) => item.studentId)
                .join(",")}`
            );

          }


          /* ==================================================
             VERIFY TARGET CLASSES
          ================================================== */

          const targetClassIds =
            [
              ...new Set(
                students
                  .filter(
                    item =>
                      item.status !==
                      "NOT_PROMOTED"
                  )
                  .map(
                    item =>
                      item.toClassId
                  )
              ),
            ];


          const targetClasses =
            await tx.class.findMany({

              where: {

                schoolId,

                academicYearId:
                  toAcademicYearId,

                id: {
                  in:
                    targetClassIds,
                },

                isCompleted:
                  false,

              },

              select: {

                id:
                  true,

                classNumber:
                  true,

                displayName:
                  true,

              },

            });


          const targetClassMap =
            new Map(
              targetClasses.map(
                item => [
                  item.id,
                  item,
                ]
              )
            );


          for (
            const item
              of students
          ) {

            if (
              item.status ===
              "NOT_PROMOTED"
            ) {
              continue;
            }

            if (
              !targetClassMap.has(
                item.toClassId
              )
            ) {

              throw new Error(
                `TARGET_CLASS_NOT_FOUND:${item.toClassId}`
              );

            }

          }


          /* ==================================================
             VERIFY TARGET SECTIONS
          ================================================== */

          const targetSectionIds =
            [
              ...new Set(
                students
                  .filter(
                    item =>
                      item.status !==
                      "NOT_PROMOTED"
                  )
                  .map(
                    item =>
                      item.toSectionId
                  )
              ),
            ];


          const targetSections =
            await tx.section.findMany({

              where: {

                schoolId,

                id: {
                  in:
                    targetSectionIds,
                },

              },

              select: {

                id:
                  true,

                classId:
                  true,

                sectionName:
                  true,

              },

            });


          const targetSectionMap =
            new Map(
              targetSections.map(
                item => [
                  item.id,
                  item,
                ]
              )
            );


          for (
            const item
              of students
          ) {

            if (
              item.status ===
              "NOT_PROMOTED"
            ) {
              continue;
            }

            const section =
              targetSectionMap.get(
                item.toSectionId
              );


            if (!section) {

              throw new Error(
                `TARGET_SECTION_NOT_FOUND:${item.toSectionId}`
              );

            }


            if (
              section.classId !==
              item.toClassId
            ) {

              throw new Error(
                `SECTION_CLASS_MISMATCH:${item.studentId}`
              );

            }

          }


          /* ==================================================
             PENDING FEE CHECK
          ================================================== */

          for (
            const item
              of students
          ) {

            /*
             * Only normal PROMOTED status
             * is blocked by pending fee.
             *
             * Principal can still use
             * DEMOTED / REPEATED /
             * NOT_PROMOTED decisions.
             */

            if (
              item.status !==
              "PROMOTED"
            ) {
              continue;
            }


            const student =
              dbStudentMap.get(
                item.studentId
              )!;


            const pendingAmount =
              Number(
                student.pendingAmount ??
                0
              );


            if (
              !Number.isFinite(
                pendingAmount
              )
            ) {

              throw new Error(
                `INVALID_PENDING_AMOUNT:${student.id}`
              );

            }


            if (
              pendingAmount > 0
            ) {

              throw new Error(
                `PENDING_FEE:${student.id}`
              );

            }

          }


          /* ==================================================
             CREATE PROMOTIONS + UPDATE STUDENTS
          ================================================== */

          const processed = [];


          for (
            const item
              of students
          ) {

            const student =
              dbStudentMap.get(
                item.studentId
              )!;


            const targetClass =
              item.status !==
              "NOT_PROMOTED"
                ? targetClassMap.get(
                    item.toClassId
                  )!
                : null;


            const targetSection =
              item.status !==
              "NOT_PROMOTED"
                ? targetSectionMap.get(
                    item.toSectionId
                  )!
                : null;


            /* ----------------------------------------------
               CREATE HISTORY
            ---------------------------------------------- */

            const promotion =
              await tx.studentPromotion.create({

                data: {

                  schoolId,

                  studentId:
                    student.id,

                  fromAcademicYearId,

                  toAcademicYearId,

                  fromClassId:
                    student.classId,

                  fromSectionId:
                    student.sectionId,

                  toClassId:
                    targetClass?.id ??
                    null,

                  toSectionId:
                    targetSection?.id ??
                    null,

                  status:
                    item.status,

                  remark:
                    item.remark?.trim() ||
                    null,

                  promotedByUserId,

                },

              });


            /* ----------------------------------------------
               DON'T MOVE STUDENT FOR
               NOT_PROMOTED
            ---------------------------------------------- */

            if (
              item.status ===
              "NOT_PROMOTED"
            ) {

              processed.push({
                promotion,
                student,
              });

              continue;

            }


            /* ----------------------------------------------
               UPDATE STUDENT
            ---------------------------------------------- */

            const updatedStudent =
              await tx.student.update({

                where: {

                  id:
                    student.id,

                },

                data: {

                  classId:
                    targetClass!.id,

                  sectionId:
                    targetSection!.id,

                },

              });


            processed.push({
              promotion,
              student:
                updatedStudent,
            });

          }


          return processed;

        }
      );


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      message:
        "Bulk student promotion processed successfully",

      count:
        result.length,

      processed:
        result,

    });

  } catch (error: any) {

    console.error(
      "BULK STUDENT PROMOTION ERROR:",
      error
    );


    /* ========================================================
       KNOWN ERRORS
    ======================================================== */

    const message =
      error?.message ??
      "";


    if (
      message ===
      "ACADEMIC_YEAR_NOT_FOUND"
    ) {

      return res.status(404).json({
        message:
          "One or both academic years were not found",
      });

    }


    if (
      message.startsWith(
        "STUDENT_NOT_FOUND:"
      )
    ) {

      return res.status(404).json({
        message:
          `Student not found: ${message.split(":")[1]}`,
      });

    }


    if (
      message.startsWith(
        "STUDENT_NOT_IN_SOURCE_YEAR:"
      )
    ) {

      return res.status(400).json({
        message:
          "One or more students do not belong to the selected source academic year",
      });

    }


    if (
      message.startsWith(
        "PROMOTION_ALREADY_PROCESSED:"
      )
    ) {

      return res.status(409).json({
        message:
          "One or more students have already been processed for this academic-year transition",
      });

    }


    if (
      message.startsWith(
        "TARGET_CLASS_NOT_FOUND:"
      )
    ) {

      return res.status(404).json({
        message:
          "One or more target classes were not found",
      });

    }


    if (
      message.startsWith(
        "TARGET_SECTION_NOT_FOUND:"
      )
    ) {

      return res.status(404).json({
        message:
          "One or more target sections were not found",
      });

    }


    if (
      message.startsWith(
        "SECTION_CLASS_MISMATCH:"
      )
    ) {

      return res.status(400).json({
        message:
          "A selected section does not belong to its selected target class",
      });

    }


    if (
      message.startsWith(
        "PENDING_FEE:"
      )
    ) {

      return res.status(400).json({
        message:
          `Student ${message.split(":")[1]} has pending fees and cannot be promoted`,
      });

    }


    if (
      message.startsWith(
        "INVALID_PENDING_AMOUNT:"
      )
    ) {

      return res.status(400).json({
        message:
          "Invalid pending fee amount for one of the students",
      });

    }


    return handleErr(
      error,
      res
    );

  }

};

/* ============================================================
   EXPORT
============================================================ */

export const studentPromotionControllers = {

  getPromotionStudents,
  processStudentPromotion,
  processBulkStudentPromotion,

};