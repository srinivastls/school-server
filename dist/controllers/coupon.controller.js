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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponControllers = void 0;
const config_1 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
const dayjs_1 = __importDefault(require("dayjs"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
dayjs_1.default.extend(customParseFormat_1.default);
const createCoupon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, discount, createdAt, classNumber } = req.body;
    if (!code || !discount || !createdAt || !classNumber) {
        return res
            .status(400)
            .json({ message: "Some fields are missing in request body" });
    }
    try {
        const classDocument = yield config_1.prisma.class.findUnique({
            where: {
                classNumber,
            },
        });
        if (!classDocument) {
            return res.status(400).json({
                message: "Class doesn't exist",
            });
        }
        yield config_1.prisma.coupon.create({
            data: {
                code,
                discount,
                status: types_1.CouponStatus.ACTIVE,
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
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
});
const getAllCoupons = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const activeCouponsList = [];
        const appliedCouponsList = [];
        const coupons = yield config_1.prisma.coupon.findMany({
            include: {
                class: true,
            },
        });
        coupons.forEach((coupon) => {
            const { code, status, discount, createdAt, class: classDetails } = coupon;
            if (classDetails) {
                const couponData = {
                    code,
                    discount,
                    status: status,
                    createdAt: (0, dayjs_1.default)(createdAt).format("DD-MM-YYYY"),
                    classNumber: classDetails.classNumber,
                };
                if (status === types_1.CouponStatus.ACTIVE) {
                    activeCouponsList.push(couponData);
                }
                else {
                    appliedCouponsList.push(couponData);
                }
            }
        });
        activeCouponsList.sort((a, b) => {
            const dateA = (0, dayjs_1.default)(a.createdAt, "DD-MM-YYYY");
            const dateB = (0, dayjs_1.default)(b.createdAt, "DD-MM-YYYY");
            return dateB.diff(dateA);
        });
        appliedCouponsList.sort((a, b) => {
            const dateA = (0, dayjs_1.default)(a.createdAt, "DD-MM-YYYY");
            const dateB = (0, dayjs_1.default)(b.createdAt, "DD-MM-YYYY");
            return dateB.diff(dateA);
        });
        return res.status(200).json({
            coupons: [...activeCouponsList, ...appliedCouponsList],
        });
    }
    catch (err) {
        console.log("err", err);
        return (0, utils_1.handleErr)(err, res);
    }
});
const editCouponStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const coupon = yield config_1.prisma.coupon.findUnique({
            where: {
                code: req.body.code,
            },
        });
        if (!coupon) {
            return res.status(404).json({
                message: "Coupon not found",
            });
        }
        yield config_1.prisma.coupon.update({
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
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
});
exports.couponControllers = {
    createCoupon,
    getAllCoupons,
    editCouponStatus,
};
