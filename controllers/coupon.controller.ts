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

const createCoupon = async (
  req: RequestWithBody<CreateCouponRequest>,
  res: Response
) => {
  const { code, discount, createdAt, classNumber } = req.body;

  if (!code || !discount || !createdAt || !classNumber) {
    return res
      .status(400)
      .json({ message: "Some fields are missing in request body" });
  }

  try {
    const classDocument = await prisma.class.findUnique({
      where: {
        classNumber,
      },
    });

    if (!classDocument) {
      return res.status(400).json({
        message: "Class doesn't exist",
      });
    }

    await prisma.coupon.create({
      data: {
        code,
        discount,
        status: CouponStatus.ACTIVE,
        class: {
          connect: {
            id: classDocument.id,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Coupon created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const getAllCoupons = async (
  req: Request,
  res: Response<GetAllCouponsResponse>
) => {
  try {
    const activeCouponsList: CouponType[] = [];
    const appliedCouponsList: CouponType[] = [];

    const coupons = await prisma.coupon.findMany({
      include: {
        class: true,
      },
    });

    coupons.forEach((coupon) => {
      const { code, status, discount, createdAt, class: classDetails } =
        coupon;

      if (classDetails) {
        const couponData: CouponType = {
          code,
          discount,
          status: status as CouponStatus,
          createdAt: dayjs(createdAt).format("DD-MM-YYYY"),
          classNumber: classDetails.classNumber,
        };

        if (status === CouponStatus.ACTIVE) {
          activeCouponsList.push(couponData);
        } else {
          appliedCouponsList.push(couponData);
        }
      }
    });

    activeCouponsList.sort((a, b) => {
      const dateA = dayjs(a.createdAt, "DD-MM-YYYY");
      const dateB = dayjs(b.createdAt, "DD-MM-YYYY");

      return dateB.diff(dateA);
    });

    appliedCouponsList.sort((a, b) => {
      const dateA = dayjs(a.createdAt, "DD-MM-YYYY");
      const dateB = dayjs(b.createdAt, "DD-MM-YYYY");

      return dateB.diff(dateA);
    });

    return res.status(200).json({
      coupons: [...activeCouponsList, ...appliedCouponsList],
    });
  } catch (err) {
    console.log("err", err);
    return handleErr(err, res);
  }
};

const editCouponStatus = async (
  req: RequestWithBody<EditCouponStatusRequest>,
  res: Response
) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: {
        code: req.body.code,
      },
    });

    if (!coupon) {
      return res.status(404).json({
        message: "Coupon not found",
      });
    }

    await prisma.coupon.update({
      where: {
        id: coupon.id,
      },
      data: {
        status: req.body.status,
      },
    });

    return res.status(200).json({
      message: "Coupon status updated successfully.",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

export const couponControllers = {
  createCoupon,
  getAllCoupons,
  editCouponStatus,
};