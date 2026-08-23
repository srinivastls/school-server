import { NextFunction } from "express";

import { prisma } from "../config";

import {
  CreateCouponRequest,
  EditCouponStatusRequest,
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
   CHECK DUPLICATE COUPON
============================================================ */

const checkDuplicateCoupon = async (
  req: RequestWithBody<CreateCouponRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        message: "Coupon code is required",
      });
    }

    /*
     * Coupon code is unique only within a school.
     *
     * New Prisma schema:
     *
     * @@unique([schoolId, code])
     *
     * Therefore:
     *
     * schoolId_code
     * must be used with findUnique().
     */

    const coupon = await prisma.coupon.findUnique({
      where: {
        schoolId_code: {
          schoolId,
          code,
        },
      },
    });

    if (coupon) {
      return res.status(400).json({
        message: "Coupon code already exists",
      });
    }

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   CHECK COUPON EXISTS
============================================================ */

const checkCouponExists = async (
  req: RequestWithBody<EditCouponStatusRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.body;

    /*
     * If no code was supplied, allow the next
     * middleware/controller to handle validation.
     */
    if (!code) {
      next();
      return;
    }

    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const coupon = await prisma.coupon.findUnique({
      where: {
        schoolId_code: {
          schoolId,
          code,
        },
      },
    });

    if (!coupon) {
      return res.status(400).json({
        message: "Coupon doesn't exist",
      });
    }

    /*
     * Store the coupon ID on the request if you want
     * controllers to avoid querying it again.
     *
     * This is optional.
     */
    (req as any).couponId = coupon.id;

    next();
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   EXPORT
============================================================ */

export const couponMiddlewares = {
  checkDuplicateCoupon,
  checkCouponExists,
};