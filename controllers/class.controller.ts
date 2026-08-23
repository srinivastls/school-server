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
   EXPORT
============================================================ */

export const classControllers = {
  createClass,
  getAllClasses,
  deleteClass,
  getClassDetails,
  editClassDetails,
  markClassAsCompleted,
};