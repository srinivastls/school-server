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
  userId?: string;

  schoolId?: string;
  schoolCode?: string;

  role?: RoleName;

  type?:
    | "PLATFORM_ADMIN"
    | "SCHOOL_USER";
};

/* ============================================================
   REQUEST USER
============================================================ */

type AuthenticatedUser = {
  id: string;

  schoolId?: string;

  schoolCode?: string;

  role?: RoleName;

  type?:
    | "PLATFORM_ADMIN"
    | "SCHOOL_USER";
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
    const header =
      req.headers["x-access-token"];

    const token =
      typeof header === "string"
        ? header
        : header?.length
        ? header[0]
        : undefined;

    if (!token) {
      return res.status(403).json({
        message:
          "No auth token provided",
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
            message:
              "Unauthorized",
          });
        }

        const payload =
          decoded as JwtPayload;

        if (!payload.id) {
          return res.status(401).json({
            message:
              "Invalid auth token",
          });
        }

        /*
         * Backward compatibility.
         */
        req.userId =
          payload.id;

        /*
         * Store complete authentication
         * context.
         */
        req.user = {
          id:
            payload.id,

          schoolId:
            payload.schoolId,

          schoolCode:
            payload.schoolCode,

          role:
            payload.role,

          type:
            payload.type,
        };

        next();
      }
    );
  } catch (err) {
    return handleErr(
      err,
      res
    );
  }
};

/* ============================================================
   PLATFORM ADMIN
============================================================ */

const isSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.userId;

    if (!userId) {
      return res.status(401).json({
        message:
          "Unauthorized",
      });
    }

    /*
     * Platform admins live in
     * PlatformAdmin, not User.
     */
    const platformAdmin =
      await prisma.platformAdmin.findUnique({
        where: {
          id: userId,
        },
      });

    if (!platformAdmin) {
      return res.status(403).json({
        message:
          "Require platform admin access",
      });
    }

    if (!platformAdmin.isActive) {
      return res.status(403).json({
        message:
          "Platform admin account is inactive",
      });
    }

    if (
      platformAdmin.role !==
      PlatformAdminRole.PLATFORM_ADMIN
    ) {
      return res.status(403).json({
        message:
          "Require platform admin access",
      });
    }

    /*
     * Make sure this is actually
     * a platform token.
     */
    if (
      req.user?.type &&
      req.user.type !==
        "PLATFORM_ADMIN"
    ) {
      return res.status(403).json({
        message:
          "Invalid platform authentication",
      });
    }

    next();
  } catch (err) {
    return handleErr(
      err,
      res
    );
  }
};

/* ============================================================
   LOAD SCHOOL USER
============================================================ */

const getAuthenticatedSchoolUser =
  async (
    req: Request,
    res: Response
  ) => {
    const userId =
      req.userId;

    if (!userId) {
      res.status(401).json({
        message:
          "Unauthorized",
      });

      return null;
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

    if (!user) {
      res.status(401).json({
        message:
          "Unauthorized",
      });

      return null;
    }

    if (!user.isActive) {
      res.status(403).json({
        message:
          "User account is inactive",
      });

      return null;
    }

    /*
     * The school from the database is
     * the authoritative tenant.
     */
    req.user = {
      id:
        user.id,

      schoolId:
        user.schoolId,

      schoolCode:
        req.user?.schoolCode,

      role:
        user.role,

      type:
        "SCHOOL_USER",
    };

    return user;
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
    const user =
      await getAuthenticatedSchoolUser(
        req,
        res
      );

    if (!user) {
      return;
    }

    if (
      user.role !==
      RoleName.PRINCIPAL
    ) {
      return res.status(403).json({
        message:
          "Require principal role",
      });
    }

    next();
  } catch (err) {
    return handleErr(
      err,
      res
    );
  }
};

/* ============================================================
   OWNER
============================================================ */

/*
 * Old application used OWNER.
 *
 * New schema uses PRINCIPAL.
 *
 * Keep alias so existing routes
 * don't immediately break.
 */
const isOwner =
  isPrincipal;

/* ============================================================
   ADMIN
============================================================ */

const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user =
      await getAuthenticatedSchoolUser(
        req,
        res
      );

    if (!user) {
      return;
    }

    /*
     * Principal has all admin permissions.
     */
    if (
      user.role !==
        RoleName.ADMIN &&
      user.role !==
        RoleName.PRINCIPAL
    ) {
      return res.status(403).json({
        message:
          "Require admin role",
      });
    }

    next();
  } catch (err) {
    return handleErr(
      err,
      res
    );
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
    const user =
      await getAuthenticatedSchoolUser(
        req,
        res
      );

    if (!user) {
      return;
    }

    if (
      user.role !==
      RoleName.TEACHER
    ) {
      return res.status(403).json({
        message:
          "Require teacher role",
      });
    }

    next();
  } catch (err) {
    return handleErr(
      err,
      res
    );
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
    const user =
      await getAuthenticatedSchoolUser(
        req,
        res
      );

    if (!user) {
      return;
    }

    if (
      user.role !==
      RoleName.PARENT
    ) {
      return res.status(403).json({
        message:
          "Require parent role",
      });
    }

    next();
  } catch (err) {
    return handleErr(
      err,
      res
    );
  }
};

/* ============================================================
   SCHOOL USER
============================================================ */

const isSchoolUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user =
      await getAuthenticatedSchoolUser(
        req,
        res
      );

    if (!user) {
      return;
    }

    /*
     * Ensure this is not a platform
     * administrator token.
     */
    if (
      req.user?.type ===
      "PLATFORM_ADMIN"
    ) {
      return res.status(403).json({
        message:
          "School user authentication required",
      });
    }

    next();
  } catch (err) {
    return handleErr(
      err,
      res
    );
  }
};

/* ============================================================
   EXPORT
============================================================ */

export const authJwt = {
  verifyToken,

  /* Platform */
  isSuperAdmin,

  /* School */
  isSchoolUser,
  isPrincipal,
  isAdmin,
  isTeacher,
  isParent,

  /* Compatibility */
  isOwner,
};