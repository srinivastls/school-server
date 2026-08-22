import { NextFunction } from "express";
import { prisma } from "../config";
import { AuthSignupRequest, RequestWithBody, Response } from "../types";
import { handleErr } from "../utils";

const VALID_ROLES = ["owner", "admin", "superadmin"] as const;

const checkDuplicateEmail = (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response,
  next: NextFunction
) => {
  prisma.user
    .findUnique({ where: { email: req.body.email } })
    .then((user) => {
      if (user) {
        return res.status(400).json({ message: "Email ID is already in use!" });
      }
      next();
    })
    .catch((err) => handleErr(err, res));
};

const checkDuplicateAdminId = (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response,
  next: NextFunction
) => {
  prisma.user
    .findUnique({ where: { adminId: req.body.adminId } })
    .then((user) => {
      if (user) {
        return res.status(400).json({ message: "Admin ID is already in use!" });
      }
      next();
    })
    .catch((err) => handleErr(err, res));
};

const checkRolesExist = (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.roles) {
    next();
    return;
  }
  for (const role of req.body.roles) {
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ message: `ERROR: Role ${role} does not exist` });
      return;
    }
  }
  next();
};

export const verifySignup = {
  checkDuplicateEmail,
  checkRolesExist,
  checkDuplicateAdminId,
};
