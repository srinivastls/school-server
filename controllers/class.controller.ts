import { prisma } from "../config";

import {
  CreateClassRequest,
  DeleteClassRequest,
  EditClassRequest,
  GetAllClassesResponse,
  GetClassRequest,
  GetClassResponse,
  MarkClassCompleteRequest,
  Request,
  RequestWithBody,
  RequestWithQuery,
  Response,
} from "../types";

import { handleErr } from "../utils";

/* ============================================================
   HELPERS
============================================================ */

/**
 * Resolve schoolId.
 *
 * For authenticated requests:
 *   JWT schoolId takes priority.
 *
 * For non-authenticated requests such as create/login flows:
 *   body/query schoolId can be used.
 */
const getSchoolId = (req: any): string | undefined => {
  return (
    req.user?.schoolId ??
    req.body?.schoolId ??
    req.query?.schoolId
  );
};

/* ============================================================
   CREATE CLASS
============================================================ */

const createClass = async (
  req: RequestWithBody<CreateClassRequest>,
  res: Response
) => {
  try {
    const {
      classNumber,
      displayName,
      tuitionFee,
      textBookFee,
      noteBookFee,
      diaryFee,
      academicYearId,
      schoolId,
    } = req.body as any;

    /*
     * Prefer authenticated JWT schoolId.
     * Fall back to body schoolId.
     */
    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (
      !classNumber ||
      tuitionFee === undefined ||
      textBookFee === undefined ||
      noteBookFee === undefined ||
      diaryFee === undefined ||
      !academicYearId ||
      !resolvedSchoolId
    ) {
      return res.status(400).json({
        message:
          "classNumber, tuitionFee, textBookFee, noteBookFee, diaryFee, academicYearId and schoolId are required",
      });
    }

    /* --------------------------------------------------------
       Verify academic year belongs to school
    -------------------------------------------------------- */

    const academicYear =
      await prisma.academicYear.findFirst({
        where: {
          id: academicYearId,
          schoolId: resolvedSchoolId,
        },
      });

    if (!academicYear) {
      return res.status(400).json({
        message:
          "Academic year not found for this school",
      });
    }

    /* --------------------------------------------------------
       Prevent duplicate class
    -------------------------------------------------------- */

    const existingClass =
      await prisma.class.findFirst({
        where: {
          schoolId: resolvedSchoolId,
          academicYearId,
          classNumber,
        },
      });

    if (existingClass) {
      return res.status(409).json({
        message:
          "Class already exists for this academic year",
      });
    }

    /* --------------------------------------------------------
       Create class
    -------------------------------------------------------- */

    await prisma.class.create({
      data: {
        schoolId: resolvedSchoolId,
        academicYearId,
        classNumber,
        displayName:
          displayName ?? classNumber,
        tuitionFee,
        textBookFee,
        noteBookFee,
        diaryFee,
      },
    });

    return res.status(201).json({
      message:
        "Class created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   GET ALL CLASSES
============================================================ */

const getAllClasses = async (
  req: Request,
  res: Response<GetAllClassesResponse>
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

    const classes =
      await prisma.class.findMany({
        where: {
          schoolId,
          isCompleted: false,
        },

        include: {
          academicYear: true,
        },

        orderBy: {
          classNumber: "asc",
        },
      });

    const classList =
      classes.map((classDetails) => ({
        id: classDetails.id,

        classNumber:
          classDetails.classNumber,

        displayName:
          classDetails.displayName,

        tuitionFee:
          classDetails.tuitionFee,

        textBookFee:
          classDetails.textBookFee,

        noteBookFee:
          classDetails.noteBookFee,

        diaryFee:
          classDetails.diaryFee,

        academicYearId:
          classDetails.academicYearId,

        academicYear:
          classDetails.academicYear.name,

        isCompleted:
          classDetails.isCompleted,
      }));

    return res.status(200).json({
      classes: classList as any,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   DELETE CLASS
============================================================ */

const deleteClass = async (
  req: RequestWithBody<DeleteClassRequest>,
  res: Response
) => {
  try {
    const {
      classNumber,
      academicYearId,
      schoolId,
    } = req.body as any;

    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (
      !resolvedSchoolId ||
      !classNumber
    ) {
      return res.status(400).json({
        message:
          "schoolId and classNumber are required",
      });
    }

    const classDetails =
      await prisma.class.findFirst({
        where: {
          schoolId:
            resolvedSchoolId,

          classNumber,

          ...(academicYearId
            ? { academicYearId }
            : {}),
        },

        include: {
          students: true,
          sections: true,
          subjects: true,
        },
      });

    if (!classDetails) {
      return res.status(404).json({
        message:
          "Class doesn't exist",
      });
    }

    /* --------------------------------------------------------
       Prevent deletion when students exist
    -------------------------------------------------------- */

    if (
      classDetails.students.length > 0
    ) {
      return res.status(400).json({
        message:
          "Cannot delete class because it has students",
      });
    }

    /* --------------------------------------------------------
       Prevent deletion when sections/subjects exist
    -------------------------------------------------------- */

    if (
      classDetails.sections.length > 0 ||
      classDetails.subjects.length > 0
    ) {
      return res.status(400).json({
        message:
          "Cannot delete class because it has sections or subjects",
      });
    }

    await prisma.class.delete({
      where: {
        id: classDetails.id,
      },
    });

    return res.status(200).json({
      message:
        "Class deleted successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   GET CLASS DETAILS
============================================================ */

const getClassDetails = async (
  req: RequestWithQuery<GetClassRequest>,
  res: Response<GetClassResponse>
) => {
  try {
    const {
      classNumber,
      academicYearId,
      schoolId,
    } = req.query as any;

    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (
      !resolvedSchoolId ||
      !classNumber
    ) {
      return res.status(400).json({
        message:
          "schoolId and classNumber are required",
      });
    }

    const classDetails =
      await prisma.class.findFirst({
        where: {
          schoolId:
            resolvedSchoolId,

          classNumber,

          ...(academicYearId
            ? { academicYearId }
            : {}),
        },

        include: {
          academicYear: true,
        },
      });

    if (!classDetails) {
      return res.status(404).json({
        message:
          "Class not found",
      });
    }

    return res.status(200).json({
      id: classDetails.id,

      classNumber:
        classDetails.classNumber,

      displayName:
        classDetails.displayName,

      tuitionFee:
        classDetails.tuitionFee,

      textBookFee:
        classDetails.textBookFee,

      noteBookFee:
        classDetails.noteBookFee,

      diaryFee:
        classDetails.diaryFee,

      academicYearId:
        classDetails.academicYearId,

      academicYear:
        classDetails.academicYear.name,

      isCompleted:
        classDetails.isCompleted,
    } as any);
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   EDIT CLASS
============================================================ */

const editClassDetails = async (
  req: RequestWithBody<EditClassRequest>,
  res: Response
) => {
  try {
    const {
      classNumber,
      displayName,
      tuitionFee,
      textBookFee,
      noteBookFee,
      diaryFee,
      academicYearId,
      schoolId,
    } = req.body as any;

    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (
      !resolvedSchoolId ||
      !classNumber
    ) {
      return res.status(400).json({
        message:
          "schoolId and classNumber are required",
      });
    }

    /* --------------------------------------------------------
       Find class in current school
    -------------------------------------------------------- */

    const existingClass =
      await prisma.class.findFirst({
        where: {
          schoolId:
            resolvedSchoolId,

          classNumber,

          ...(academicYearId
            ? { academicYearId }
            : {}),
        },
      });

    if (!existingClass) {
      return res.status(404).json({
        message:
          "Class not found",
      });
    }

    /* --------------------------------------------------------
       If academic year is changing,
       make sure it belongs to same school
    -------------------------------------------------------- */

    if (academicYearId) {
      const academicYear =
        await prisma.academicYear.findFirst({
          where: {
            id: academicYearId,
            schoolId:
              resolvedSchoolId,
          },
        });

      if (!academicYear) {
        return res.status(400).json({
          message:
            "Academic year not found for this school",
        });
      }
    }

    /* --------------------------------------------------------
       Update only supplied fields
    -------------------------------------------------------- */

    await prisma.class.update({
      where: {
        id: existingClass.id,
      },

      data: {
        ...(displayName !== undefined && {
          displayName,
        }),

        ...(tuitionFee !== undefined && {
          tuitionFee,
        }),

        ...(textBookFee !== undefined && {
          textBookFee,
        }),

        ...(noteBookFee !== undefined && {
          noteBookFee,
        }),

        ...(diaryFee !== undefined && {
          diaryFee,
        }),

        ...(academicYearId !== undefined && {
          academicYearId,
        }),
      },
    });

    return res.status(200).json({
      message:
        "Class details updated successfully.",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   MARK CLASS AS COMPLETED
============================================================ */

const markClassAsCompleted = async (
  req: RequestWithBody<MarkClassCompleteRequest>,
  res: Response
) => {
  const {
    classNumber,
    academicYearId,
    schoolId,
  } = req.body as any;

  const resolvedSchoolId =
    getSchoolId(req) ?? schoolId;

  if (
    !resolvedSchoolId ||
    !classNumber
  ) {
    return res.status(400).json({
      message:
        "schoolId and classNumber are required",
    });
  }

  try {
    const classDetails =
      await prisma.class.findFirst({
        where: {
          schoolId:
            resolvedSchoolId,

          classNumber,

          ...(academicYearId
            ? { academicYearId }
            : {}),
        },
      });

    if (!classDetails) {
      return res.status(404).json({
        message:
          "Source class doesn't exist",
      });
    }

    await prisma.class.update({
      where: {
        id: classDetails.id,
      },

      data: {
        isCompleted: true,
      },
    });

    return res.status(200).json({
      message:
        "Class marked as completed successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   COPY CLASSES TO NEW ACADEMIC YEAR
============================================================ */

type CopyClassesToAcademicYearRequest = {
  sourceAcademicYearId: string;
  targetAcademicYearId: string;
};


const copyClassesToAcademicYear = async (
  req: RequestWithBody<
    CopyClassesToAcademicYearRequest
  >,
  res: Response
) => {

  try {

    const {
      sourceAcademicYearId,
      targetAcademicYearId,
    } = req.body;

    const schoolId =
      getSchoolId(req);

    /* --------------------------------------------------------
       VALIDATION
    -------------------------------------------------------- */

    if (!schoolId) {

      return res.status(400).json({
        message:
          "schoolId is required",
      });

    }

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


    /* --------------------------------------------------------
       VERIFY SOURCE YEAR
    -------------------------------------------------------- */

    const sourceAcademicYear =
      await prisma.academicYear.findFirst({

        where: {

          id:
            sourceAcademicYearId,

          schoolId,

        },

      });


    if (!sourceAcademicYear) {

      return res.status(404).json({
        message:
          "Source academic year not found",
      });

    }


    /* --------------------------------------------------------
       VERIFY TARGET YEAR
    -------------------------------------------------------- */

    const targetAcademicYear =
      await prisma.academicYear.findFirst({

        where: {

          id:
            targetAcademicYearId,

          schoolId,

        },

      });


    if (!targetAcademicYear) {

      return res.status(404).json({
        message:
          "Target academic year not found",
      });

    }


    /* --------------------------------------------------------
       GET SOURCE CLASSES
    -------------------------------------------------------- */

    const sourceClasses =
      await prisma.class.findMany({

        where: {

          schoolId,

          academicYearId:
            sourceAcademicYearId,

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


    /* --------------------------------------------------------
       EXISTING TARGET CLASSES
    -------------------------------------------------------- */

    const existingTargetClasses =
      await prisma.class.findMany({

        where: {

          schoolId,

          academicYearId:
            targetAcademicYearId,

        },

        select: {

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


    /* --------------------------------------------------------
       CREATE MISSING CLASSES
    -------------------------------------------------------- */

    const classesToCreate =
      sourceClasses.filter(
        sourceClass =>
          !existingClassNumbers.has(
            sourceClass.classNumber
          )
      );


    if (
      classesToCreate.length === 0
    ) {

      return res.status(409).json({
        message:
          "All classes already exist in the target academic year",
      });

    }


    /* ========================================================
       TRANSACTION
    ======================================================== */

    const createdClasses =
      await prisma.$transaction(
        async tx => {

          const created = [];

          for (
            const sourceClass
              of classesToCreate
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
                   * New academic year
                   * should start as incomplete.
                   */

                  isCompleted:
                    false,

                },

              });


            created.push(
              newClass
            );

          }

          return created;

        }
      );


    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(201).json({

      message:
        "Classes copied successfully",

      sourceAcademicYear: {

        id:
          sourceAcademicYear.id,

        name:
          sourceAcademicYear.name,

      },

      targetAcademicYear: {

        id:
          targetAcademicYear.id,

        name:
          targetAcademicYear.name,

      },

      count:
        createdClasses.length,

      classes:
        createdClasses,

      skipped:
        sourceClasses.length -
        classesToCreate.length,

    });

  } catch (error) {

    console.error(
      "COPY CLASSES ERROR:",
      error
    );

    return handleErr(
      error as any,
      res
    );

  }

};

/* ============================================================
   COPY CLASSES TO NEW ACADEMIC YEAR
============================================================ */

type CopyClassesRequest = {
  fromAcademicYearId: string;
  toAcademicYearId: string;
};

// const copyClassesToAcademicYear = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const {
//       fromAcademicYearId,
//       toAcademicYearId,
//     } = req.body as CopyClassesRequest;

//     const schoolId =
//       getSchoolId(req);

//     /* ========================================================
//        VALIDATION
//     ======================================================== */

//     if (!schoolId) {
//       return res.status(400).json({
//         message:
//           "schoolId is required",
//       });
//     }

//     if (
//       !fromAcademicYearId ||
//       !toAcademicYearId
//     ) {
//       return res.status(400).json({
//         message:
//           "fromAcademicYearId and toAcademicYearId are required",
//       });
//     }

//     if (
//       fromAcademicYearId ===
//       toAcademicYearId
//     ) {
//       return res.status(400).json({
//         message:
//           "Source and target academic years cannot be the same",
//       });
//     }

//     /* ========================================================
//        VERIFY ACADEMIC YEARS
//     ======================================================== */

//     const academicYears =
//       await prisma.academicYear.findMany({
//         where: {
//           schoolId,
//           id: {
//             in: [
//               fromAcademicYearId,
//               toAcademicYearId,
//             ],
//           },
//         },

//         select: {
//           id: true,
//           name: true,
//           startDate: true,
//           endDate: true,
//           isCurrent: true,
//         },
//       });

//     if (
//       academicYears.length !== 2
//     ) {
//       return res.status(404).json({
//         message:
//           "One or both academic years were not found",
//       });
//     }

//     /* ========================================================
//        SOURCE CLASSES
//     ======================================================== */

//     const sourceClasses =
//       await prisma.class.findMany({
//         where: {
//           schoolId,
//           academicYearId:
//             fromAcademicYearId,
//         },

//         select: {
//           id: true,
//           classNumber: true,
//           displayName: true,

//           tuitionFee: true,
//           textBookFee: true,
//           noteBookFee: true,
//           diaryFee: true,

//           isCompleted: true,
//         },

//         orderBy: {
//           classNumber: "asc",
//         },
//       });

//     if (
//       sourceClasses.length === 0
//     ) {
//       return res.status(404).json({
//         message:
//           "No classes found in source academic year",
//       });
//     }

//     /* ========================================================
//        EXISTING TARGET CLASSES
//     ======================================================== */

//     const existingTargetClasses =
//       await prisma.class.findMany({
//         where: {
//           schoolId,
//           academicYearId:
//             toAcademicYearId,
//         },

//         select: {
//           id: true,
//           classNumber: true,
//         },
//       });

//     const existingClassNumbers =
//       new Set(
//         existingTargetClasses.map(
//           item =>
//             item.classNumber
//         )
//       );

//     /* ========================================================
//        PREPARE CLASSES
//     ======================================================== */

//     const classesToCreate =
//       sourceClasses.filter(
//         sourceClass =>
//           !existingClassNumbers.has(
//             sourceClass.classNumber
//           )
//       );

//     const skippedClasses =
//       sourceClasses
//         .filter(
//           sourceClass =>
//             existingClassNumbers.has(
//               sourceClass.classNumber
//             )
//         )
//         .map(
//           sourceClass => ({
//             classNumber:
//               sourceClass.classNumber,

//             displayName:
//               sourceClass.displayName,

//             reason:
//               "Class already exists in target academic year",
//           })
//         );

//     /* ========================================================
//        CREATE
//     ======================================================== */

//     const result =
//       await prisma.$transaction(
//         async tx => {

//           const createdClasses = [];

//           for (
//             const sourceClass
//               of classesToCreate
//           ) {

//             const created =
//               await tx.class.create({
//                 data: {
//                   schoolId,

//                   academicYearId:
//                     toAcademicYearId,

//                   classNumber:
//                     sourceClass.classNumber,

//                   displayName:
//                     sourceClass.displayName,

//                   tuitionFee:
//                     sourceClass.tuitionFee,

//                   textBookFee:
//                     sourceClass.textBookFee,

//                   noteBookFee:
//                     sourceClass.noteBookFee,

//                   diaryFee:
//                     sourceClass.diaryFee,

//                   /*
//                    * Always start the new
//                    * academic year as active.
//                    */
//                   isCompleted:
//                     false,
//                 },

//                 select: {
//                   id: true,
//                   classNumber: true,
//                   displayName: true,

//                   tuitionFee: true,
//                   textBookFee: true,
//                   noteBookFee: true,
//                   diaryFee: true,

//                   academicYearId: true,
//                   isCompleted: true,
//                 },
//               });

//             createdClasses.push(
//               created
//             );
//           }

//           return {
//             createdClasses,
//           };
//         }
//       );

//     /* ========================================================
//        RESPONSE
//     ======================================================== */

//     return res.status(201).json({
//       message:
//         "Classes copied successfully",

//       fromAcademicYearId,

//       toAcademicYearId,

//       createdCount:
//         result.createdClasses.length,

//       skippedCount:
//         skippedClasses.length,

//       classes:
//         result.createdClasses,

//       skipped:
//         skippedClasses,
//     });

//   } catch (error) {

//     console.error(
//       "COPY CLASSES ERROR:",
//       error
//     );

//     return handleErr(
//       error as any,
//       res
//     );
//   }
// };
/* ============================================================
   EXPORT
============================================================ */

export const classControllers = {
  createClass,
  getAllClasses,
  deleteClass,
  getClassDetails,
  editClassDetails,
  markClassAsCompleted,
  copyClassesToAcademicYear,
};