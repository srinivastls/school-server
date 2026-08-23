import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import {
  RoleName,
  PlatformAdminRole,
} from "@prisma/client";

import { prisma, authConfig } from "../config";

import {
  AuthSigninRequest,
  AuthSigninResponse,
  AuthSignupRequest,
  CreateSuperAdminRequest,
  DeleteUserRequest,
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
   SIGN UP
============================================================ */

const signup = async (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      designation,
      schoolId,
      role,
    } = req.body;

    /*
     * Prefer schoolId from authenticated JWT.
     * Fall back to request body for signup.
     */
    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (
      !name ||
      !email ||
      !password ||
      !resolvedSchoolId
    ) {
      return res.status(400).json({
        message:
          "name, email, password and schoolId are required",
      });
    }

    /* --------------------------------------------------------
       Verify school exists
    -------------------------------------------------------- */

    const school = await prisma.school.findUnique({
      where: {
        id: resolvedSchoolId,
      },
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found",
      });
    }

    /* --------------------------------------------------------
       Validate role
    -------------------------------------------------------- */

    const userRole: RoleName =
      role &&
      Object.values(RoleName).includes(role)
        ? role
        : RoleName.ADMIN;

    /* --------------------------------------------------------
       Check duplicate email within school
    -------------------------------------------------------- */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId: resolvedSchoolId,
            email,
          },
        },
      });

    if (existingUser) {
      return res.status(409).json({
        message:
          "User with this email already exists in this school",
      });
    }

    /* --------------------------------------------------------
       Hash password
    -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(password, 8);

    /* --------------------------------------------------------
       Create user
    -------------------------------------------------------- */

    await prisma.user.create({
      data: {
        schoolId: resolvedSchoolId,
        name,
        email,
        designation: designation ?? null,
        passwordHash,
        role: userRole,
      },
    });

    /*
     * Do NOT return id here.
     *
     * Your current generic Response type only supports:
     *
     * { message: unknown }
     */
    return res.status(201).json({
      message: "User created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   SIGN IN
============================================================ */

const signin = async (
  req: RequestWithBody<AuthSigninRequest>,
  res: Response<AuthSigninResponse>
) => {
  try {
    const {
      email,
      password,
      schoolId,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    /* --------------------------------------------------------
       Resolve school / tenant
    -------------------------------------------------------- */

    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (!resolvedSchoolId) {
      return res.status(400).json({
        message:
          "schoolId is required for school user login",
      });
    }

    /* --------------------------------------------------------
       Find user inside school
    -------------------------------------------------------- */

    const user =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId: resolvedSchoolId,
            email,
          },
        },
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    /* --------------------------------------------------------
       Check active status
    -------------------------------------------------------- */

    if (!user.isActive) {
      return res.status(403).json({
        message: "User account is inactive",
      });
    }

    /* --------------------------------------------------------
       Verify password
    -------------------------------------------------------- */

    const isPasswordValid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Password incorrect",
      });
    }

    /* --------------------------------------------------------
       Update last login
    -------------------------------------------------------- */

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLogin: new Date(),
      },
    });

    /* --------------------------------------------------------
       Create JWT
    -------------------------------------------------------- */

    const token = jwt.sign(
      {
        id: user.id,
        schoolId: user.schoolId,
        role: user.role,
        type: "SCHOOL_USER",
      },
      authConfig.secret,
      {
        expiresIn: 86400,
      }
    );

    /* --------------------------------------------------------
       Response
    -------------------------------------------------------- */

    return res.status(200).json({
      id: user.id,
      accessToken: token,
      accessTokenTTL: 86400,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      schoolId: user.schoolId,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   DELETE USER
============================================================ */

const deleteUser = async (
  req: RequestWithBody<DeleteUserRequest>,
  res: Response
) => {
  try {
    const {
      email,
      schoolId,
    } = req.body;

    /*
     * For authenticated requests, JWT schoolId
     * should take precedence over body schoolId.
     */
    const resolvedSchoolId =
      getSchoolId(req) ?? schoolId;

    if (!email) {
      return res.status(400).json({
        message:
          "Email field missing in request body",
      });
    }

    if (!resolvedSchoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    /* --------------------------------------------------------
       Find user inside current school
    -------------------------------------------------------- */

    const user =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId: resolvedSchoolId,
            email,
          },
        },
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /* --------------------------------------------------------
       Delete
    -------------------------------------------------------- */

    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   CREATE PLATFORM ADMIN
============================================================ */

const createSuperAdmin = async (
  req: RequestWithBody<CreateSuperAdminRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "name, email and password are required",
      });
    }

    /* --------------------------------------------------------
       Platform admin email is globally unique
    -------------------------------------------------------- */

    const existingAdmin =
      await prisma.platformAdmin.findUnique({
        where: {
          email,
        },
      });

    if (existingAdmin) {
      return res.status(409).json({
        message:
          "Platform admin with this email already exists",
      });
    }

    /* --------------------------------------------------------
       Hash password
    -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(password, 8);

    /* --------------------------------------------------------
       Create platform admin
    -------------------------------------------------------- */

    await prisma.platformAdmin.create({
      data: {
        name,
        email,
        passwordHash,
        role:
          PlatformAdminRole.PLATFORM_ADMIN,
      },
    });

    return res.status(201).json({
      message:
        "Platform admin created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   EXPORT
============================================================ */

export const authController = {
  signin,
  signup,
  delete: deleteUser,
  createSuperAdmin,
};