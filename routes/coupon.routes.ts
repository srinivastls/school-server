import { Express } from "express";
import { couponControllers } from "../controllers";
import { authJwt, couponMiddlewares } from "../middlewares";

const { createCoupon, getAllCoupons, editCouponStatus } = couponControllers;
const { checkDuplicateCoupon, checkCouponExists } = couponMiddlewares;

export const useCouponRoutes = (app: Express) => {
  app.post(
    "/api/coupon/create",
    [authJwt.verifyToken, authJwt.isSuperAdmin, checkDuplicateCoupon],
    createCoupon
  );

  app.get("/api/coupon/getAll", [authJwt.verifyToken], getAllCoupons);

  app.post(
    "/api/coupon/editstatus",
    [authJwt.verifyToken, checkCouponExists],
    editCouponStatus
  );
};
