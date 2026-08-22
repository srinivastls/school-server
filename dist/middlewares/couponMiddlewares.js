"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponMiddlewares = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const checkDuplicateCoupon = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const coupon = yield config_1.prisma.coupon.findUnique({
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
});
const checkCouponExists = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.body.code) {
        next();
        return;
    }
    try {
        const coupon = yield config_1.prisma.coupon.findUnique({
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
});
exports.couponMiddlewares = { checkDuplicateCoupon, checkCouponExists };
