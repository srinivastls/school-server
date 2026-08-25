import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import {
  RoleName,
  PlatformAdminRole,
} from "@prisma/client";

import {
  prisma,
  authConfig,
} from "../config";

import {
  AuthSigninRequest,
  AuthSigninResponse,
  PlatformAdminSigninRequest,
  PlatformAdminSigninResponse,
  CreatePrincipalRequest,
  CreateAdminRequest,
  CreateTeacherRequest,
  CreateParentRequest,
  DeleteUserRequest,
  RequestWithBody,
  Response,
  ChangePasswordRequest,
} from "../types";

import { handleErr } from "../utils";

/* ============================================================
   CONSTANTS
============================================================ */

const ACCESS_TOKEN_TTL = 86400;

/* ============================================================
   HELPERS
============================================================ */

const normalizeEmail = (
  email: string
): string => {
  return email.trim().toLowerCase();
};

const normalizeSchoolCode = (
  schoolCode: string
): string => {
  return schoolCode.trim().toUpperCase();
};

const getAuthenticatedSchoolId = (
  req: any
): string | undefined => {
  return req.user?.schoolId;
};

/* ============================================================
   SCHOOL USER SIGN IN
   ------------------------------------------------------------
   Login:
      schoolCode + email + password
============================================================ */

const signin = async (
  req: RequestWithBody<AuthSigninRequest>,
  res: Response<AuthSigninResponse>
) => {
  try {
    const {
      schoolCode,
      email,
      password,
    } = req.body;

    /* --------------------------------------------------------
       VALIDATION
    -------------------------------------------------------- */

    if (
      !schoolCode ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "schoolCode, email and password are required",
      });
    }

    const normalizedSchoolCode =
      normalizeSchoolCode(
        schoolCode
      );

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       FIND SCHOOL
    -------------------------------------------------------- */

    const school =
      await prisma.school.findUnique({
        where: {
          code:
            normalizedSchoolCode,
        },
      });

    if (!school) {
      return res.status(401).json({
        message:
          "Invalid school code or credentials",
      });
    }

    /* --------------------------------------------------------
       SCHOOL STATUS
    -------------------------------------------------------- */

    if (school.status !== "ACTIVE") {
      return res.status(403).json({
        message:
          "School account is not active",
      });
    }

    /* --------------------------------------------------------
       FIND USER
       
       Email is unique within a school.
    -------------------------------------------------------- */

    const user =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId:
              school.id,

            email:
              normalizedEmail,
          },
        },
      });

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid school code or credentials",
      });
    }

    /* --------------------------------------------------------
       USER STATUS
    -------------------------------------------------------- */

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "User account is inactive",
      });
    }

    /* --------------------------------------------------------
       PASSWORD
    -------------------------------------------------------- */

    const passwordValid =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordValid) {
      return res.status(401).json({
        message:
          "Invalid school code or credentials",
      });
    }

    /* --------------------------------------------------------
       LAST LOGIN
    -------------------------------------------------------- */

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        lastLogin:
          new Date(),
      },
    });

    /* --------------------------------------------------------
       JWT
    -------------------------------------------------------- */

    const accessToken =
      jwt.sign(
        {
          id:
            user.id,

          schoolId:
            school.id,

          schoolCode:
            school.code,

          role:
            user.role,

          type:
            "SCHOOL_USER",
        },

        authConfig.secret,

        {
          expiresIn:
            ACCESS_TOKEN_TTL,
        }
      );

    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({
  id: user.id,

  accessToken,

  accessTokenTTL: ACCESS_TOKEN_TTL,

  name: user.name,

  email: user.email,

  role: user.role,

  designation: user.designation,

  schoolId: school.id,

  schoolCode: school.code,

  schoolName: school.name,

  mustChangePassword:
    user.mustChangePassword,
});
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

const changePassword = async (
  req: RequestWithBody<ChangePasswordRequest>,
  res: Response
) => {
  try {
    const userId = req.userId;

    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        message:
          "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters",
      });
    }

    if (
      currentPassword === newPassword
    ) {
      return res.status(400).json({
        message:
          "New password must be different from current password",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "User account is inactive",
      });
    }

    const passwordValid =
      await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );

    if (!passwordValid) {
      return res.status(401).json({
        message:
          "Current password is incorrect",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        10
      );

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return res.status(200).json({
      message:
        "Password changed successfully",
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   PLATFORM ADMIN SIGN IN
============================================================ */

const platformAdminSignin = async (
  req: RequestWithBody<PlatformAdminSigninRequest>,
  res: Response<PlatformAdminSigninResponse>
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    /* --------------------------------------------------------
       VALIDATION
    -------------------------------------------------------- */

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       FIND PLATFORM ADMIN
    -------------------------------------------------------- */

    const platformAdmin =
      await prisma.platformAdmin.findUnique({
        where: {
          email:
            normalizedEmail,
        },
      });

    if (!platformAdmin) {
      return res.status(401).json({
        message:
          "Invalid credentials",
      });
    }

    /* --------------------------------------------------------
       ACTIVE CHECK
    -------------------------------------------------------- */

    if (!platformAdmin.isActive) {
      return res.status(403).json({
        message:
          "Platform admin account is inactive",
      });
    }

    /* --------------------------------------------------------
       PASSWORD
    -------------------------------------------------------- */

    const passwordValid =
      await bcrypt.compare(
        password,
        platformAdmin.passwordHash
      );

    if (!passwordValid) {
      return res.status(401).json({
        message:
          "Invalid credentials",
      });
    }

    /* --------------------------------------------------------
       LAST LOGIN
    -------------------------------------------------------- */

    await prisma.platformAdmin.update({
      where: {
        id:
          platformAdmin.id,
      },

      data: {
        lastLogin:
          new Date(),
      },
    });

    /* --------------------------------------------------------
       JWT
    -------------------------------------------------------- */

    const accessToken =
      jwt.sign(
        {
          id:
            platformAdmin.id,

          role:
            platformAdmin.role,

          type:
            "PLATFORM_ADMIN",
        },

        authConfig.secret,

        {
          expiresIn:
            ACCESS_TOKEN_TTL,
        }
      );

    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    return res.status(200).json({
      id:
        platformAdmin.id,

      accessToken,

      accessTokenTTL:
        ACCESS_TOKEN_TTL,

      name:
        platformAdmin.name,

      email:
        platformAdmin.email,

      role:
        platformAdmin.role,

      type:
        "PLATFORM_ADMIN",
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   CREATE PRINCIPAL
   ------------------------------------------------------------
   PLATFORM ADMIN ONLY
============================================================ */

const createPrincipal = async (
  req: RequestWithBody<CreatePrincipalRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      designation,
      phone,
      department,
      employeeId,
    } = req.body;

    const schoolId =
      req.params.schoolId;

    /* --------------------------------------------------------
       VALIDATION
    -------------------------------------------------------- */

    if (
      !schoolId ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "schoolId, name, email and password are required",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       FIND SCHOOL
    -------------------------------------------------------- */

    const school =
      await prisma.school.findUnique({
        where: {
          id: schoolId,
        },
      });

    if (!school) {
      return res.status(404).json({
        message:
          "School not found",
      });
    }

    /* --------------------------------------------------------
       SCHOOL STATUS
    -------------------------------------------------------- */

    if (
      school.status === "SUSPENDED" ||
      school.status === "EXPIRED"
    ) {
      return res.status(403).json({
        message:
          "School is not available",
      });
    }

    /* --------------------------------------------------------
       ONE PRINCIPAL PER SCHOOL
    -------------------------------------------------------- */

    const existingPrincipal =
      await prisma.user.findFirst({
        where: {
          schoolId,

          role:
            RoleName.PRINCIPAL,
        },
      });

    if (existingPrincipal) {
      return res.status(409).json({
        message:
          "This school already has a principal",
      });
    }

    /* --------------------------------------------------------
       CHECK EMAIL
    -------------------------------------------------------- */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email:
              normalizedEmail,
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
       PASSWORD
    -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    /* --------------------------------------------------------
       CREATE PRINCIPAL
    -------------------------------------------------------- */

    const principal =
      await prisma.user.create({
        data: {
          schoolId,

          name,

          email:
            normalizedEmail,

          passwordHash,

          role:
            RoleName.PRINCIPAL,

          designation:
            designation ??
            "Principal",

          phone:
            phone ?? null,

          department:
            department ?? null,

          employeeId:
            employeeId ?? null,
        },
      });

    return res.status(201).json({
      message:
        "Principal created successfully",

      id:
        principal.id,
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   CREATE SCHOOL ADMIN
   ------------------------------------------------------------
   PRINCIPAL ONLY
============================================================ */

const createAdmin = async (
  req: RequestWithBody<CreateAdminRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      designation,
      phone,
      department,
      employeeId,
    } = req.body;

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (
      !schoolId ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "name, email and password are required",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       SCHOOL
    -------------------------------------------------------- */

    const school =
      await prisma.school.findUnique({
        where: {
          id: schoolId,
        },
      });

    if (!school) {
      return res.status(404).json({
        message:
          "School not found",
      });
    }

    if (school.status !== "ACTIVE") {
      return res.status(403).json({
        message:
          "School account is not active",
      });
    }

    /* --------------------------------------------------------
       DUPLICATE EMAIL
    -------------------------------------------------------- */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email:
              normalizedEmail,
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
       CREATE ADMIN
    -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    const admin =
      await prisma.user.create({
        data: {
          schoolId,

          name,

          email:
            normalizedEmail,

          passwordHash,

          role:
            RoleName.ADMIN,

          designation:
            designation ??
            "School Admin",

          phone:
            phone ?? null,

          department:
            department ?? null,

          employeeId:
            employeeId ?? null,
        },
      });

    return res.status(201).json({
      message:
        "School admin created successfully",

      id:
        admin.id,
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   CREATE TEACHER
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */

const createTeacher = async (
  req: RequestWithBody<CreateTeacherRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      designation,
      phone,
      department,
      employeeId,
    } = req.body;

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (
      !schoolId ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "name, email and password are required",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       DUPLICATE
    -------------------------------------------------------- */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email:
              normalizedEmail,
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
       CREATE TEACHER
    -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    const teacher =
      await prisma.user.create({
        data: {
          schoolId,

          name,

          email:
            normalizedEmail,

          passwordHash,

          role:
            RoleName.TEACHER,

          designation:
            designation ??
            "Teacher",

          phone:
            phone ?? null,

          department:
            department ?? null,

          employeeId:
            employeeId ?? null,
        },
      });

    return res.status(201).json({
      message:
        "Teacher created successfully",

      id:
        teacher.id,
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   CREATE PARENT
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */

const createParent = async (
  req: RequestWithBody<CreateParentRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      phone,
    } = req.body;

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (
      !schoolId ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "name, email and password are required",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       DUPLICATE
    -------------------------------------------------------- */

    const existingUser =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email:
              normalizedEmail,
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
       CREATE PARENT
    -------------------------------------------------------- */

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    const parent =
      await prisma.user.create({
        data: {
          schoolId,

          name,

          email:
            normalizedEmail,

          passwordHash,

          role:
            RoleName.PARENT,

          phone:
            phone ?? null,
        },
      });

    return res.status(201).json({
      message:
        "Parent account created successfully",

      id:
        parent.id,
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   DELETE SCHOOL USER
   ------------------------------------------------------------
   PRINCIPAL ONLY
============================================================ */

const deleteUser = async (
  req: RequestWithBody<DeleteUserRequest>,
  res: Response
) => {
  try {
    const {
      email,
    } = req.body;

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message:
          "Authenticated school is missing",
      });
    }

    if (!email) {
      return res.status(400).json({
        message:
          "Email is required",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    /* --------------------------------------------------------
       FIND USER
    -------------------------------------------------------- */

    const user =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,

            email:
              normalizedEmail,
          },
        },
      });

    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }

    /* --------------------------------------------------------
       NEVER DELETE PRINCIPAL HERE
       
       Principal should be managed by Platform Admin.
    -------------------------------------------------------- */

    if (
      user.role ===
      RoleName.PRINCIPAL
    ) {
      return res.status(403).json({
        message:
          "Principal account can only be managed by platform admin",
      });
    }

    /* --------------------------------------------------------
       DELETE
    -------------------------------------------------------- */

    await prisma.user.delete({
      where: {
        id:
          user.id,
      },
    });

    return res.status(200).json({
      message:
        "User deleted successfully",
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   EXPORT
============================================================ */

export const authController = {
  signin,
  platformAdminSignin,

  createPrincipal,
  createAdmin,
  createTeacher,
  createParent,
  changePassword,

  delete:
    deleteUser,
};