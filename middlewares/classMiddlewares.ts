import { NextFunction } from "express";

import { prisma } from "../config";

import {
  CreateClassRequest,
  EditClassRequest,
  RequestWithBody,
  Response,
} from "../types";

import { handleErr } from "../utils";

/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (req: any): string | undefined => {
  return req.user?.schoolId ?? req.body?.schoolId;
};

/* ============================================================
   CHECK DUPLICATE CLASS
============================================================ */

const checkDuplicateClass = async (
  req: RequestWithBody<CreateClassRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const {
      classNumber,
      academicYearId,
    } = req.body as any;

    if (!classNumber) {
      return res.status(400).json({
        message: "classNumber is required",
      });
    }

    /*
     * New schema:
     *
     * @@unique([
     *   schoolId,
     *   academicYearId,
     *   classNumber
     * ])
     *
     * Therefore classNumber alone is NOT unique.
     */

    if (!academicYearId) {
      return res.status(400).json({
        message: "academicYearId is required",
      });
    }

    const oldClass = await prisma.class.findUnique({
      where: {
        schoolId_academicYearId_classNumber: {
          schoolId,
          academicYearId,
          classNumber,
        },
      },
    });

    if (oldClass) {
      return res.status(400).json({
        message: "Class already exists",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   CHECK CLASS EXISTS
============================================================ */

const checkClassExists = async (
  req: RequestWithBody<EditClassRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const {
      classNumber,
      academicYearId,
    } = req.body as any;

    if (!classNumber) {
      return res.status(400).json({
        message: "classNumber is required",
      });
    }

    if (!academicYearId) {
      return res.status(400).json({
        message: "academicYearId is required",
      });
    }

    const oldClass = await prisma.class.findUnique({
      where: {
        schoolId_academicYearId_classNumber: {
          schoolId,
          academicYearId,
          classNumber,
        },
      },
    });

    if (!oldClass) {
      return res.status(400).json({
        message: "Class doesn't exist",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   EXPORT
============================================================ */

export const classMiddleWares = {
  checkDuplicateClass,
  checkClassExists,
};