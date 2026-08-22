import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { authConfig } from "../config";
import { prisma } from "../config";
import { Roles } from "../types";
import { handleErr } from "../utils";

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers["x-access-token"];
  const token =
    typeof header === "string"
      ? header
      : header?.length
      ? header[0]
      : undefined;

  if (!token) {
    return res.status(403).json({ message: "No auth token provided" });
  }

  jwt.verify(token, authConfig.secret, (err, decoded) => {
    if (err || typeof decoded !== "object") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    //@ts-ignore
    req.userId = decoded.id;
    next();
  });
};

const isSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //@ts-ignore
    const userId = req.userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const hasRole = user.roles.some((role) => role.name === Roles.superadmin);
    if (!hasRole) {
      return res.status(403).json({ message: "Require superadmin role" });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

const isOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    //@ts-ignore
    const userId = req.userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const hasRole = user.roles.some((role) => role.name === Roles.owner);
    if (!hasRole) {
      return res.status(403).json({ message: "Require owner role" });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

export const authJwt = { verifyToken, isSuperAdmin, isOwner };
