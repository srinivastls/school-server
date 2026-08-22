"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCouponRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { createCoupon, getAllCoupons, editCouponStatus } = controllers_1.couponControllers;
const { checkDuplicateCoupon, checkCouponExists } = middlewares_1.couponMiddlewares;
const useCouponRoutes = (app) => {
    app.post("/api/coupon/create", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isSuperAdmin, checkDuplicateCoupon], createCoupon);
    app.get("/api/coupon/getAll", [middlewares_1.authJwt.verifyToken], getAllCoupons);
    app.post("/api/coupon/editstatus", [middlewares_1.authJwt.verifyToken, checkCouponExists], editCouponStatus);
};
exports.useCouponRoutes = useCouponRoutes;
