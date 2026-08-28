import dayjs from "dayjs";

import { prisma } from "../config";

import {
  Request,
  Response,
} from "../types";

import {
  handleErr,
} from "../utils";

/* ============================================================
   TYPES
============================================================ */

type CreateAcademicYearBody = {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
};


/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (
  req: any
): string | undefined => {
  return (
    req.user?.schoolId ??
    req.body?.schoolId
  );
};


/* ============================================================
   PARSE DATE
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
   GET ALL ACADEMIC YEARS
============================================================ */

const getAcademicYears = async (
  req: Request,
  res: Response
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


    const academicYears =
      await prisma.academicYear.findMany({

        where: {
          schoolId,
        },

        select: {

          id: true,

          name: true,

          startDate: true,

          endDate: true,

          isCurrent: true,

          createdAt: true,

          updatedAt: true,

        },

        orderBy: {
          startDate: "desc",
        },

      });


    return res.status(200).json({
      academicYears,
    });

  } catch (error) {

    return handleErr(
      error as any,
      res
    );

  }

};


/* ============================================================
   GET CURRENT ACADEMIC YEAR
============================================================ */

const getCurrentAcademicYear = async (
  req: Request,
  res: Response
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

          isCurrent: true,

          createdAt: true,

          updatedAt: true,

        },

      });


    if (!academicYear) {

      return res.status(404).json({
        message:
          "Current academic year not found",
      });

    }


    return res.status(200).json(
      academicYear
    );

  } catch (error) {

    return handleErr(
      error as any,
      res
    );

  }

};


/* ============================================================
   CREATE ACADEMIC YEAR
============================================================ */

const createAcademicYear = async (
  req: Request<
    any,
    CreateAcademicYearBody
  >,
  res: Response
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
      name,
      startDate,
      endDate,
      isCurrent = false,
    } = req.body;


    /* --------------------------------------------------------
       VALIDATE NAME
    -------------------------------------------------------- */

    const academicYearName =
      name?.trim();

    if (!academicYearName) {

      return res.status(400).json({
        message:
          "Academic year name is required",
      });

    }


    /* --------------------------------------------------------
       PARSE DATES
    -------------------------------------------------------- */

    const parsedStartDate =
      parseDate(startDate);

    const parsedEndDate =
      parseDate(endDate);


    if (!parsedStartDate) {

      return res.status(400).json({
        message:
          "Invalid start date. Use DD/MM/YYYY",
      });

    }


    if (!parsedEndDate) {

      return res.status(400).json({
        message:
          "Invalid end date. Use DD/MM/YYYY",
      });

    }


    /* --------------------------------------------------------
       DATE ORDER
    -------------------------------------------------------- */

    if (
      parsedEndDate <=
      parsedStartDate
    ) {

      return res.status(400).json({
        message:
          "End date must be after start date",
      });

    }


    /* --------------------------------------------------------
       DUPLICATE NAME
    -------------------------------------------------------- */

    const existingYear =
      await prisma.academicYear.findUnique({

        where: {

          schoolId_name: {

            schoolId,

            name:
              academicYearName,

          },

        },

        select: {
          id: true,
        },

      });


    if (existingYear) {

      return res.status(409).json({
        message:
          "Academic year already exists",
      });

    }


    /* --------------------------------------------------------
       OVERLAPPING YEAR CHECK
       
       Existing:
       2025-26
       01/04/2025 → 31/03/2026

       New year cannot overlap it.
    -------------------------------------------------------- */

    const overlappingYear =
      await prisma.academicYear.findFirst({

        where: {

          schoolId,

          AND: [

            {
              startDate: {
                lte:
                  parsedEndDate,
              },
            },

            {
              endDate: {
                gte:
                  parsedStartDate,
              },
            },

          ],

        },

        select: {

          id: true,

          name: true,

        },

      });


    if (overlappingYear) {

      return res.status(409).json({

        message:
          `Academic year dates overlap with ${overlappingYear.name}`,

      });

    }


    /* ========================================================
       CREATE
    ======================================================== */

    const academicYear =
      await prisma.$transaction(
        async (tx) => {

          /*
           * If this new academic year
           * becomes current, first remove
           * current flag from existing year.
           */

          if (isCurrent) {

            await tx.academicYear.updateMany({

              where: {

                schoolId,

                isCurrent: true,

              },

              data: {

                isCurrent: false,

              },

            });

          }


          return tx.academicYear.create({

            data: {

              schoolId,

              name:
                academicYearName,

              startDate:
                parsedStartDate,

              endDate:
                parsedEndDate,

              isCurrent:
                Boolean(isCurrent),

            },

            select: {

              id: true,

              name: true,

              startDate: true,

              endDate: true,

              isCurrent: true,

              createdAt: true,

              updatedAt: true,

            },

          });

        }
      );


    return res.status(201).json({

      message:
        "Academic year created successfully",

      academicYear,

    });

  } catch (error) {

    return handleErr(
      error as any,
      res
    );

  }

};


/* ============================================================
   SET CURRENT ACADEMIC YEAR
============================================================ */

const setCurrentAcademicYear = async (
  req: Request,
  res: Response
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


    const academicYearId =
      String(
        req.params?.academicYearId ??
        ""
      ).trim();


    if (!academicYearId) {

      return res.status(400).json({
        message:
          "academicYearId is required",
      });

    }


    /* --------------------------------------------------------
       FIND YEAR
    -------------------------------------------------------- */

    const academicYear =
      await prisma.academicYear.findFirst({

        where: {

          id:
            academicYearId,

          schoolId,

        },

      });


    if (!academicYear) {

      return res.status(404).json({
        message:
          "Academic year not found",
      });

    }


    /* --------------------------------------------------------
       ALREADY CURRENT
    -------------------------------------------------------- */

    if (
      academicYear.isCurrent
    ) {

      return res.status(200).json({

        message:
          "Academic year is already current",

        academicYear,

      });

    }


    /* ========================================================
       CHANGE CURRENT YEAR
    ======================================================== */

    const updated =
      await prisma.$transaction(
        async (tx) => {

          await tx.academicYear.updateMany({

            where: {

              schoolId,

              isCurrent: true,

            },

            data: {

              isCurrent: false,

            },

          });


          return tx.academicYear.update({

            where: {

              id:
                academicYear.id,

            },

            data: {

              isCurrent: true,

            },

            select: {

              id: true,

              name: true,

              startDate: true,

              endDate: true,

              isCurrent: true,

              createdAt: true,

              updatedAt: true,

            },

          });

        }
      );


    return res.status(200).json({

      message:
        "Current academic year updated successfully",

      academicYear:
        updated,

    });

  } catch (error) {

    return handleErr(
      error as any,
      res
    );

  }

};


/* ============================================================
   GET ACADEMIC YEAR BY ID
============================================================ */

const getAcademicYearById = async (
  req: Request,
  res: Response
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


    const academicYearId =
      String(
        req.params?.academicYearId ??
        ""
      ).trim();


    if (!academicYearId) {

      return res.status(400).json({
        message:
          "academicYearId is required",
      });

    }


    const academicYear =
      await prisma.academicYear.findFirst({

        where: {

          id:
            academicYearId,

          schoolId,

        },

        select: {

          id: true,

          name: true,

          startDate: true,

          endDate: true,

          isCurrent: true,

          createdAt: true,

          updatedAt: true,

        },

      });


    if (!academicYear) {

      return res.status(404).json({
        message:
          "Academic year not found",
      });

    }


    return res.status(200).json(
      academicYear
    );

  } catch (error) {

    return handleErr(
      error as any,
      res
    );

  }

};

type PopulateAcademicYearBody = {
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
};


/* ============================================================
   POPULATE
============================================================ */

const populateAcademicYear = async (
  req: Request<
    any,
    PopulateAcademicYearBody
  >,
  res: Response
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
      sourceAcademicYearId,
      targetAcademicYearId,
    } = req.body;


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
       VERIFY ACADEMIC YEARS
    ======================================================== */

    const academicYears =
      await prisma.academicYear.findMany({
        where: {
          schoolId,

          id: {
            in: [
              sourceAcademicYearId,
              targetAcademicYearId,
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
          "Source or target academic year not found",
      });
    }


    const sourceYear =
      academicYears.find(
        year =>
          year.id ===
          sourceAcademicYearId
      );

    const targetYear =
      academicYears.find(
        year =>
          year.id ===
          targetAcademicYearId
      );


    /* ========================================================
       TRANSACTION
    ======================================================== */

    const result =
      await prisma.$transaction(
        async tx => {

          /* ==================================================
             SOURCE CLASSES
          ================================================== */

          const sourceClasses =
            await tx.class.findMany({

              where: {
                schoolId,

                academicYearId:
                  sourceAcademicYearId,
              },

              include: {

                sections: {
                  orderBy: {
                    sectionName:
                      "asc",
                  },
                },

                subjects: {
                  orderBy: {
                    code:
                      "asc",
                  },
                },

              },

              orderBy: {
                classNumber:
                  "asc",
              },

            });


          if (
            sourceClasses.length === 0
          ) {
            throw new Error(
              "SOURCE_CLASSES_NOT_FOUND"
            );
          }


          /* ==================================================
             EXISTING TARGET CLASSES
          ================================================== */

          const existingTargetClasses =
            await tx.class.findMany({

              where: {
                schoolId,

                academicYearId:
                  targetAcademicYearId,
              },

              select: {
                id: true,
                classNumber: true,
              },

            });


          const existingClassNumbers =
            new Set(
              existingTargetClasses.map(
                item =>
                  item.classNumber
              )
            );


          /* ==================================================
             PREVENT PARTIAL DUPLICATION
          ================================================== */

          const duplicateClasses =
            sourceClasses.filter(
              sourceClass =>
                existingClassNumbers.has(
                  sourceClass.classNumber
                )
            );


          if (
            duplicateClasses.length > 0
          ) {

            throw new Error(
              `TARGET_CLASSES_ALREADY_EXIST:${duplicateClasses
                .map(
                  item =>
                    item.classNumber
                )
                .join(",")}`
            );

          }


          /* ==================================================
             CREATE CLASSES
          ================================================== */

          const createdClasses = [];


          for (
            const sourceClass
              of sourceClasses
          ) {

            const newClass =
              await tx.class.create({

                data: {

                  schoolId,

                  academicYearId:
                    targetAcademicYearId,

                  classNumber:
                    sourceClass.classNumber,

                  displayName:
                    sourceClass.displayName,

                  tuitionFee:
                    sourceClass.tuitionFee,

                  textBookFee:
                    sourceClass.textBookFee,

                  noteBookFee:
                    sourceClass.noteBookFee,

                  diaryFee:
                    sourceClass.diaryFee,

                  /*
                   * New academic year classes
                   * are not completed.
                   */

                  isCompleted:
                    false,

                },

              });


            createdClasses.push({
              sourceClass,
              newClass,
            });

          }


          /* ==================================================
             CREATE SECTIONS + SUBJECTS
          ================================================== */

          let sectionsCreated = 0;
          let subjectsCreated = 0;


          for (
            const item
              of createdClasses
          ) {

            const {
              sourceClass,
              newClass,
            } = item;


            /* ================================================
               SECTIONS
            ================================================ */

            for (
              const sourceSection
                of sourceClass.sections
            ) {

              await tx.section.create({

                data: {

                  schoolId,

                  classId:
                    newClass.id,

                  sectionName:
                    sourceSection.sectionName,

                  /*
                   * Do NOT copy classTeacherId.
                   *
                   * Principal will assign teachers
                   * separately for the new year.
                   */

                  classTeacherId:
                    null,

                },

              });


              sectionsCreated++;

            }


            /* ================================================
               SUBJECTS
            ================================================ */

            for (
              const sourceSubject
                of sourceClass.subjects
            ) {

              await tx.subject.create({

                data: {

                  schoolId,

                  classId:
                    newClass.id,

                  name:
                    sourceSubject.name,

                  code:
                    sourceSubject.code,

                  isOptional:
                    sourceSubject.isOptional,

                },

              });


              subjectsCreated++;

            }

          }


          return {
            classesCreated:
              createdClasses.length,

            sectionsCreated,

            subjectsCreated,

          };

        }
      );


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(201).json({

      message:
        "Academic year populated successfully",

      sourceAcademicYear: {
        id:
          sourceYear!.id,

        name:
          sourceYear!.name,
      },

      targetAcademicYear: {
        id:
          targetYear!.id,

        name:
          targetYear!.name,
      },

      summary: result,

    });

  } catch (error: any) {

    console.error(
      "POPULATE ACADEMIC YEAR ERROR:",
      error
    );


    /* ========================================================
       KNOWN ERRORS
    ======================================================== */

    if (
      error?.message ===
      "SOURCE_CLASSES_NOT_FOUND"
    ) {

      return res.status(404).json({
        message:
          "No classes found in the source academic year",
      });

    }


    if (
      error?.message?.startsWith(
        "TARGET_CLASSES_ALREADY_EXIST:"
      )
    ) {

      const classes =
        error.message
          .split(":")[1];

      return res.status(409).json({

        message:
          `The following classes already exist in the target academic year: ${classes}`,

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

export const academicYearControllers = {

  getAcademicYears,

  getCurrentAcademicYear,

  getAcademicYearById,

  createAcademicYear,

  setCurrentAcademicYear,

  populateAcademicYear,

};