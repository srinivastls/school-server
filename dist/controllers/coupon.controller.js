"use strict";
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
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return (req.user?.schoolId ??
        req.body?.schoolId ??
        req.query?.schoolId);
};
/* ============================================================
   CREATE COUPON
============================================================ */
const createCoupon = async (req, res) => {
    const { code, discount, createdAt, classNumber, academicYearId, } = req.body;
    const schoolId = getSchoolId(req);
    if (!schoolId ||
        !code ||
        !discount ||
        !createdAt ||
        !classNumber ||
        !academicYearId) {
        return res.status(400).json({
            message: "schoolId, code, discount, createdAt, classNumber and academicYearId are required",
        });
    }
    try {
        /* --------------------------------------------------------
           FIND CLASS INSIDE THIS SCHOOL + ACADEMIC YEAR
        -------------------------------------------------------- */
        const classDocument = await config_1.prisma.class.findFirst({
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
        const existingCoupon = await config_1.prisma.coupon.findUnique({
            where: {
                schoolId_code: {
                    schoolId,
                    code,
                },
            },
        });
        if (existingCoupon) {
            return res.status(409).json({
                message: "Coupon with this code already exists in this school",
            });
        }
        /* --------------------------------------------------------
           CREATE COUPON
        -------------------------------------------------------- */
        await config_1.prisma.coupon.create({
            data: {
                schoolId,
                code,
                discount,
                status: types_1.CouponStatus.ACTIVE,
                classId: classDocument.id,
                createdByUserId: req.user?.id ?? null,
            },
        });
        return res.status(201).json({
            message: "Coupon created successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET ALL COUPONS
============================================================ */
const getAllCoupons = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const activeCouponsList = [];
        const appliedCouponsList = [];
        const coupons = await config_1.prisma.coupon.findMany({
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
            const { code, status, discount, createdAt, class: classDetails, } = coupon;
            if (classDetails) {
                const couponData = {
                    code,
                    discount,
                    status: status,
                    createdAt: (0, dayjs_1.default)(createdAt).format("DD-MM-YYYY"),
                    classNumber: classDetails.classNumber,
                };
                if (status ===
                    types_1.CouponStatus.ACTIVE) {
                    activeCouponsList.push(couponData);
                }
                else {
                    appliedCouponsList.push(couponData);
                }
            }
        });
        return res.status(200).json({
            coupons: [
                ...activeCouponsList,
                ...appliedCouponsList,
            ],
        });
    }
    catch (err) {
        console.log("err", err);
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EDIT COUPON STATUS
============================================================ */
const editCouponStatus = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!req.body.code) {
            return res.status(400).json({
                message: "Coupon code is required",
            });
        }
        /* --------------------------------------------------------
           FIND COUPON USING COMPOUND UNIQUE KEY
        -------------------------------------------------------- */
        const coupon = await config_1.prisma.coupon.findUnique({
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
        await config_1.prisma.coupon.update({
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
};
/* ============================================================
   EXPORT
============================================================ */
exports.couponControllers = {
    createCoupon,
    getAllCoupons,
    editCouponStatus,
};
