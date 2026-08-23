import { NextFunction } from "express";

import { prisma } from "../config";

import {
  AuthSignupRequest,
  RequestWithBody,
  Response,
} from "../types";

import { RoleName } from "@prisma/client";

import { handleErr } from "../utils";

/* ============================================================
   CHECK DUPLICATE EMAIL
   ------------------------------------------------------------
   Email is unique PER SCHOOL in the new multi-tenant schema.
============================================================ */

const checkDuplicateEmail = async (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      email,
      schoolId,
    } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email,
          },
        },
      });

    if (user) {
      return res.status(400).json({
        message:
          "Email ID is already in use in this school!",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   CHECK SCHOOL EXISTS
============================================================ */

const checkSchoolExists = async (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { schoolId } =
      req.body;

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const school =
      await prisma.school.findUnique({
        where: {
          id: schoolId,
        },
      });

    if (!school) {
      return res.status(404).json({
        message: "School not found",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   CHECK ROLE
   ------------------------------------------------------------
   New roles:
     PRINCIPAL
     ADMIN
     TEACHER
     PARENT
============================================================ */

const checkRole = (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response,
  next: NextFunction
) => {
  const role =
    req.body.role;

  /* ----------------------------------------------------------
     Role is optional because auth.controller.ts defaults
     missing role to ADMIN.
  ---------------------------------------------------------- */

  if (!role) {
    next();
    return;
  }

  if (
    !Object.values(RoleName).includes(
      role
    )
  ) {
    return res.status(400).json({
      message:
        `Invalid role: ${role}. ` +
        `Allowed roles: ${Object.values(RoleName).join(", ")}`,
    });
  }

  next();
};

/* ============================================================
   EXPORT
============================================================ */

export const verifySignup = {
  checkDuplicateEmail,
  checkSchoolExists,
  checkRole,
};