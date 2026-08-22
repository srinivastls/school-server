"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponMiddlewares = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const checkDuplicateCoupon = async (req, res, next) => {
    try {
        const coupon = await config_1.prisma.coupon.findUnique({
            where: { code: req.body.code },
        });
        if (coupon) {
            return res.status(400).json({ message: "Coupon code already exists" });
        }
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
    next();
};
const checkCouponExists = async (req, res, next) => {
    if (!req.body.code) {
        next();
        return;
    }
    try {
        const coupon = await config_1.prisma.coupon.findUnique({
            where: { code: req.body.code },
        });
        if (!coupon) {
            return res.status(400).json({ message: "Coupon doesn't exist" });
        }
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
    next();
};
exports.couponMiddlewares = { checkDuplicateCoupon, checkCouponExists };
