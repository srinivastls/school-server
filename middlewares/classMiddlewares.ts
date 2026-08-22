import { NextFunction } from "express";
import { prisma } from "../config";
import {
  CreateClassRequest,
  EditClassRequest,
  RequestWithBody,
  Response,
} from "../types";
import { handleErr } from "../utils";

const checkDuplicateClass = (
  req: RequestWithBody<CreateClassRequest>,
  res: Response,
  next: NextFunction
) => {
  prisma.class
    .findUnique({ where: { classNumber: req.body.classNumber } })
    .then((oldClass) => {
      if (oldClass) {
        return res.status(400).json({ message: "Class already exists" });
      }
      next();
    })
    .catch((err) => handleErr(err, res));
};

const checkClassExists = (
  req: RequestWithBody<EditClassRequest>,
  res: Response,
  next: NextFunction
) => {
  prisma.class
    .findUnique({ where: { classNumber: req.body.classNumber } })
    .then((oldClass) => {
      if (!oldClass) {
        return res.status(400).json({ message: "Class doesn't exist" });
      }
      next();
    })
    .catch((err) => handleErr(err, res));
};

export const classMiddleWares = { checkDuplicateClass, checkClassExists };
