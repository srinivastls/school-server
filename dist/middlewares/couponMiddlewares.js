"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponMiddlewares = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return req.user?.schoolId ?? req.body?.schoolId;
};
/* ============================================================
   CHECK DUPLICATE COUPON
============================================================ */
const checkDuplicateCoupon = async (req, res, next) => {
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
        const coupon = await config_1.prisma.coupon.findUnique({
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
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   CHECK COUPON EXISTS
============================================================ */
const checkCouponExists = async (req, res, next) => {
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
        const coupon = await config_1.prisma.coupon.findUnique({
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
        req.couponId = coupon.id;
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.couponMiddlewares = {
    checkDuplicateCoupon,
    checkCouponExists,
};
