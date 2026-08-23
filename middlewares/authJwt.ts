import {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

import {
  authConfig,
  prisma,
} from "../config";

import {
  PlatformAdminRole,
  RoleName,
} from "@prisma/client";

import { handleErr } from "../utils";

/* ============================================================
   JWT PAYLOAD
============================================================ */

type JwtPayload = {
  id: string;

  /*
   * School users have schoolId.
   * Platform admins do not.
   */
  schoolId?: string;

  /*
   * School-user role.
   */
  role?: RoleName;

  /*
   * Identifies what kind of account generated the token.
   */
  type?: "PLATFORM_ADMIN" | "SCHOOL_USER";
};

/* ============================================================
   REQUEST USER
============================================================ */

type AuthenticatedUser = {
  id: string;
  schoolId?: string;
  role?: RoleName;
};

/* ============================================================
   VERIFY TOKEN
============================================================ */

const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const header = req.headers["x-access-token"];

    const token =
      typeof header === "string"
        ? header
        : header?.length
        ? header[0]
        : undefined;

    if (!token) {
      return res.status(403).json({
        message: "No auth token provided",
      });
    }

    jwt.verify(
      token,
      authConfig.secret,
      (err, decoded) => {
        if (
          err ||
          typeof decoded !== "object" ||
          decoded === null
        ) {
          return res.status(401).json({
            message: "Unauthorized",
          });
        }

        const payload =
          decoded as JwtPayload;

        if (!payload.id) {
          return res.status(401).json({
            message: "Invalid auth token",
          });
        }

        /*
         * Keep backward compatibility.
         */
        req.userId = payload.id;

        /*
         * New multi-tenant request context.
         */
        req.user = {
          id: payload.id,
          schoolId: payload.schoolId,
          role: payload.role,
        };

        next();
      }
    );
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   SUPER ADMIN / PLATFORM ADMIN
============================================================ */

/*
 * Platform admins are NOT stored in User.
 *
 * They are stored in:
 *
 *   PlatformAdmin
 *
 * Therefore this middleware must verify against
 * prisma.platformAdmin.
 */
const isSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const platformAdmin =
      await prisma.platformAdmin.findUnique({
        where: {
          id: userId,
        },
      });

    if (!platformAdmin) {
      return res.status(403).json({
        message: "Require superadmin access",
      });
    }

    /*
     * Verify actual PlatformAdmin role.
     */
    if (
      platformAdmin.role !==
      PlatformAdminRole.PLATFORM_ADMIN
    ) {
      return res.status(403).json({
        message: "Require superadmin access",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   PRINCIPAL
============================================================ */

const isPrincipal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User account is inactive",
      });
    }

    if (
      user.role !==
      RoleName.PRINCIPAL
    ) {
      return res.status(403).json({
        message: "Require principal role",
      });
    }

    /*
     * Make sure request context matches
     * the actual database user.
     */
    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
    };

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   OWNER
============================================================ */

/*
 * New schema has:
 *
 * PRINCIPAL
 * ADMIN
 * TEACHER
 * PARENT
 *
 * There is no OWNER role.
 *
 * Existing routes still reference isOwner,
 * therefore keep this alias for compatibility.
 *
 * OWNER -> PRINCIPAL
 */

const isOwner = isPrincipal;

/* ============================================================
   ADMIN
============================================================ */

/*
 * ADMIN-level operations are allowed for:
 *
 *   PRINCIPAL
 *   ADMIN
 */

const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User account is inactive",
      });
    }

    if (
      user.role !== RoleName.ADMIN &&
      user.role !== RoleName.PRINCIPAL
    ) {
      return res.status(403).json({
        message: "Require admin role",
      });
    }

    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
    };

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   TEACHER
============================================================ */

const isTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User account is inactive",
      });
    }

    if (
      user.role !== RoleName.TEACHER
    ) {
      return res.status(403).json({
        message: "Require teacher role",
      });
    }

    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
    };

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   PARENT
============================================================ */

const isParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User account is inactive",
      });
    }

    if (
      user.role !== RoleName.PARENT
    ) {
      return res.status(403).json({
        message: "Require parent role",
      });
    }

    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
    };

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   SCHOOL USER
============================================================ */

/*
 * Allows any authenticated school user.
 *
 * PRINCIPAL
 * ADMIN
 * TEACHER
 * PARENT
 */

const isSchoolUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User account is inactive",
      });
    }

    req.user = {
      id: user.id,
      schoolId: user.schoolId,
      role: user.role,
    };

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   EXPORTS
============================================================ */

export const authJwt = {
  verifyToken,

  /*
   * Platform level
   */
  isSuperAdmin,

  /*
   * School level
   */
  isPrincipal,
  isAdmin,
  isTeacher,
  isParent,
  isSchoolUser,

  /*
   * Backward compatibility.
   */
  isOwner,
};