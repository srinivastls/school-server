import { NextFunction } from "express";
import { prisma } from "../config";
import {
  CreateCouponRequest,
  EditCouponStatusRequest,
  RequestWithBody,
  Response,
} from "../types";
import { handleErr } from "../utils";

const checkDuplicateCoupon = async (
  req: RequestWithBody<CreateCouponRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code: req.body.code },
    });
    if (coupon) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }
  } catch (err) {
    return handleErr(err, res);
  }

  next();
};

const checkCouponExists = async (
  req: RequestWithBody<EditCouponStatusRequest>,
  res: Response,
  next: NextFunction
) => {
  if (!req.body.code) {
    next();
    return;
  }

  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code: req.body.code },
    });
    if (!coupon) {
      return res.status(400).json({ message: "Coupon doesn't exist" });
    }
  } catch (err) {
    return handleErr(err, res);
  }

  next();
};

export const couponMiddlewares = { checkDuplicateCoupon, checkCouponExists };
