import { Request } from "express";

import { prisma } from "../config";

import {
  CouponStatus,
  CouponType,
  CreateCouponRequest,
  EditCouponStatusRequest,
  GetAllCouponsResponse,
  RequestWithBody,
  Response,
} from "../types";

import { handleErr } from "../utils";

import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (req: any): string | undefined => {
  return (
    req.user?.schoolId ??
    req.body?.schoolId ??
    req.query?.schoolId
  );
};

/* ============================================================
   CREATE COUPON
============================================================ */

const createCoupon = async (
  req: RequestWithBody<CreateCouponRequest>,
  res: Response
) => {
  const {
    code,
    discount,
    createdAt,
    classNumber,
    academicYearId,
  } = req.body as any;

  const schoolId = getSchoolId(req);

  if (
    !schoolId ||
    !code ||
    !discount ||
    !createdAt ||
    !classNumber ||
    !academicYearId
  ) {
    return res.status(400).json({
      message:
        "schoolId, code, discount, createdAt, classNumber and academicYearId are required",
    });
  }

  try {
    /* --------------------------------------------------------
       FIND CLASS INSIDE THIS SCHOOL + ACADEMIC YEAR
    -------------------------------------------------------- */

    const classDocument =
      await prisma.class.findFirst({
        where: {
          schoolId,
          academicYearId,
          classNumber,
        },
      });

    if (!classDocument) {
      return res.status(400).json({
        message: "Class doesn't exist",
      });
    }

    /* --------------------------------------------------------
       CHECK DUPLICATE COUPON
    -------------------------------------------------------- */

    const existingCoupon =
      await prisma.coupon.findUnique({
        where: {
          schoolId_code: {
            schoolId,
            code,
          },
        },
      });

    if (existingCoupon) {
      return res.status(409).json({
        message:
          "Coupon with this code already exists in this school",
      });
    }

    /* --------------------------------------------------------
       CREATE COUPON
    -------------------------------------------------------- */

    await prisma.coupon.create({
      data: {
        schoolId,

        code,
        discount,

        status:
          CouponStatus.ACTIVE,

        classId:
          classDocument.id,

        createdByUserId:
          req.user?.id ?? null,
      } as any,
    });

    return res.status(201).json({
      message:
        "Coupon created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   GET ALL COUPONS
============================================================ */

const getAllCoupons = async (
  req: Request,
  res: Response<GetAllCouponsResponse>
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const activeCouponsList: CouponType[] = [];
    const appliedCouponsList: CouponType[] = [];

    const coupons =
      await prisma.coupon.findMany({
        where: {
          schoolId,
        },
        include: {
          class: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    coupons.forEach((coupon) => {
      const {
        code,
        status,
        discount,
        createdAt,
        class: classDetails,
      } = coupon;

      if (classDetails) {
        const couponData: CouponType = {
          code,
          discount,
          status:
            status as CouponStatus,

          createdAt:
            dayjs(createdAt).format(
              "DD-MM-YYYY"
            ),

          classNumber:
            classDetails.classNumber,
        };

        if (
          status ===
          CouponStatus.ACTIVE
        ) {
          activeCouponsList.push(
            couponData
          );
        } else {
          appliedCouponsList.push(
            couponData
          );
        }
      }
    });

    return res.status(200).json({
      coupons: [
        ...activeCouponsList,
        ...appliedCouponsList,
      ],
    });
  } catch (err) {
    console.log("err", err);

    return handleErr(err, res);
  }
};

/* ============================================================
   EDIT COUPON STATUS
============================================================ */

const editCouponStatus = async (
  req: RequestWithBody<EditCouponStatusRequest>,
  res: Response
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    if (!req.body.code) {
      return res.status(400).json({
        message:
          "Coupon code is required",
      });
    }

    /* --------------------------------------------------------
       FIND COUPON USING COMPOUND UNIQUE KEY
    -------------------------------------------------------- */

    const coupon =
      await prisma.coupon.findUnique({
        where: {
          schoolId_code: {
            schoolId,
            code: req.body.code,
          },
        },
      });

    if (!coupon) {
      return res.status(404).json({
        message: "Coupon not found",
      });
    }

    /* --------------------------------------------------------
       UPDATE
    -------------------------------------------------------- */

    await prisma.coupon.update({
      where: {
        id: coupon.id,
      },

      data: {
        status:
          req.body.status,
      },
    });

    return res.status(200).json({
      message:
        "Coupon status updated successfully.",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

/* ============================================================
   EXPORT
============================================================ */

export const couponControllers = {
  createCoupon,
  getAllCoupons,
  editCouponStatus,
};