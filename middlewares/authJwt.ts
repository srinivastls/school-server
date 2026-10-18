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
        code: "TOKEN_MISSING",
      });
    }

    jwt.verify(
      token,
      authConfig.secret,
      (err, decoded) => {
        if (err) {
          // This is the important distinction for automatic refresh.
          if (err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
              message: "Access token expired",
              code: "TOKEN_EXPIRED",
            });
          }

          console.error(
            "JWT verification error:",
            err.name,
            err.message
          );

          return res.status(401).json({
            message: "Invalid access token",
            code: "INVALID_TOKEN",
          });
        }

        if (
          typeof decoded !== "object" ||
          decoded === null
        ) {
          return res.status(401).json({
            message: "Invalid access token",
            code: "INVALID_TOKEN",
          });
        }

        const payload = decoded as JwtPayload;

        if (!payload.id) {
          return res.status(401).json({
            message: "Invalid auth token",
            code: "INVALID_TOKEN",
          });
        }

        req.userId = payload.id;

        req.user = {
          id: payload.id,
          schoolId: payload.schoolId,
          schoolCode: payload.schoolCode,
          role: payload.role,
          type: payload.type,
        };

        next();
      }
    );
  } catch (err) {
    return handleErr(err, res);
  }
};

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

    if (req.user?.type !== "PLATFORM_ADMIN") {
      return res.status(403).json({
        message: "Invalid platform authentication",
      });
    }

    const platformAdmin =
      await prisma.platformAdmin.findUnique({
        where: { id: userId },
      });

    if (!platformAdmin) {
      return res.status(403).json({
        message: "Require platform admin access",
      });
    }

    if (!platformAdmin.isActive) {
      return res.status(403).json({
        message: "Platform admin account is inactive",
      });
    }

    if (
      platformAdmin.role !==
      PlatformAdminRole.PLATFORM_ADMIN
    ) {
      return res.status(403).json({
        message: "Require platform admin access",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

const getAuthenticatedSchoolUser = async (
  req: Request,
  res: Response
) => {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return null;
  }

  if (!user.isActive) {
    res.status(403).json({
      message: "User account is inactive",
    });
    return null;
  }

  req.user = {
    id: user.id,
    schoolId: user.schoolId,
    schoolCode: req.user?.schoolCode,
    role: user.role,
    type: "SCHOOL_USER",
  };

  return user;
};

const isPrincipal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getAuthenticatedSchoolUser(req, res);
    if (!user) return;

    if (user.role !== RoleName.PRINCIPAL) {
      return res.status(403).json({
        message: "Require principal role",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

const isPrincipalOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const role = req.user?.role;

  if (
    role !== RoleName.PRINCIPAL &&
    role !== RoleName.ADMIN
  ) {
    return res.status(403).json({
      message:
        "Access denied. Principal or Admin role required.",
    });
  }

  next();
};

const isOwner = isPrincipal;

const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getAuthenticatedSchoolUser(req, res);
    if (!user) return;

    if (
      user.role !== RoleName.ADMIN &&
      user.role !== RoleName.PRINCIPAL
    ) {
      return res.status(403).json({
        message: "Require admin role",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

const isTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getAuthenticatedSchoolUser(req, res);
    if (!user) return;

    if (user.role !== RoleName.TEACHER) {
      return res.status(403).json({
        message: "Require teacher role",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

const isParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getAuthenticatedSchoolUser(req, res);
    if (!user) return;

    if (user.role !== RoleName.PARENT) {
      return res.status(403).json({
        message: "Require parent role",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

const isSchoolUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getAuthenticatedSchoolUser(req, res);
    if (!user) return;

    if (req.user?.type === "PLATFORM_ADMIN") {
      return res.status(403).json({
        message:
          "School user authentication required",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

export const authJwt = {
  verifyToken,
  isSuperAdmin,
  isSchoolUser,
  isPrincipal,
  isAdmin,
  isTeacher,
  isParent,
  isPrincipalOrAdmin,
  isOwner,
};
