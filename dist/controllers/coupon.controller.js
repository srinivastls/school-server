"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.couponControllers = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const config_1 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
const getSchoolId = (req) => req.user?.schoolId ?? req.body?.schoolId ?? req.query?.schoolId;
const getValidDiscount = (value, type) => {
    if (value === undefined || value === null || String(value).trim() === "") {
        return undefined;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) ||
        numericValue <= 0 ||
        (type === types_1.CouponDiscountType.PERCENT && numericValue > 100)) {
        return undefined;
    }
    return String(value);
};
const createCoupon = async (req, res) => {
    const { code, discount, discountType = types_1.CouponDiscountType.AMOUNT, classNumber, academicYearId, } = req.body;
    const schoolId = getSchoolId(req);
    const validDiscount = getValidDiscount(discount, discountType);
    if (!schoolId ||
        !code ||
        !classNumber ||
        !academicYearId ||
        !Object.values(types_1.CouponDiscountType).includes(discountType) ||
        !validDiscount) {
        return res.status(400).json({
            message: "schoolId, code, a valid discount, classNumber and academicYearId are required",
        });
    }
    try {
        const classDocument = await config_1.prisma.class.findFirst({
            where: { schoolId, academicYearId, classNumber },
        });
        if (!classDocument) {
            return res.status(400).json({ message: "Class doesn't exist" });
        }
        const existingCoupon = await config_1.prisma.coupon.findUnique({
            where: { schoolId_code: { schoolId, code } },
        });
        if (existingCoupon) {
            return res.status(409).json({
                message: "Coupon with this code already exists in this school",
            });
        }
        await config_1.prisma.coupon.create({
            data: {
                schoolId,
                code,
                discount: validDiscount,
                discountType,
                status: types_1.CouponStatus.ACTIVE,
                classId: classDocument.id,
                createdByUserId: req.user?.id ?? null,
            },
        });
        return res.status(201).json({ message: "Coupon created successfully" });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const getAllCoupons = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({ message: "schoolId is required" });
        }
        const coupons = await config_1.prisma.coupon.findMany({
            where: { schoolId },
            include: { class: true },
            orderBy: { createdAt: "desc" },
        });
        const result = coupons
            .filter((coupon) => coupon.class)
            .map((coupon) => ({
            id: coupon.id,
            code: coupon.code,
            discount: coupon.discount,
            discountType: coupon.discountType,
            status: coupon.status,
            createdAt: (0, dayjs_1.default)(coupon.createdAt).format("DD-MM-YYYY"),
            classNumber: coupon.class.classNumber,
        }));
        return res.status(200).json({
            coupons: [
                ...result.filter(({ status }) => status === types_1.CouponStatus.ACTIVE),
                ...result.filter(({ status }) => status !== types_1.CouponStatus.ACTIVE),
            ],
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const editCouponStatus = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const { code, status } = req.body;
        if (!schoolId) {
            return res.status(400).json({ message: "schoolId is required" });
        }
        if (!code || !Object.values(types_1.CouponStatus).includes(status)) {
            return res.status(400).json({
                message: "Coupon code and a valid status are required",
            });
        }
        const coupon = await config_1.prisma.coupon.findUnique({
            where: { schoolId_code: { schoolId, code } },
        });
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        await config_1.prisma.coupon.update({
            where: { id: coupon.id },
            data: { status },
        });
        return res
            .status(200)
            .json({ message: "Coupon status updated successfully." });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const updateCoupon = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const { currentCode, code, discount, discountType, classNumber, academicYearId, } = req.body;
        if (!schoolId || !currentCode) {
            return res.status(400).json({
                message: "schoolId and currentCode are required",
            });
        }
        if ((classNumber && !academicYearId) || (!classNumber && academicYearId)) {
            return res.status(400).json({
                message: "classNumber and academicYearId must be provided together",
            });
        }
        const coupon = await config_1.prisma.coupon.findUnique({
            where: { schoolId_code: { schoolId, code: currentCode } },
        });
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        const nextType = discountType ?? coupon.discountType;
        if (!Object.values(types_1.CouponDiscountType).includes(nextType)) {
            return res.status(400).json({ message: "Invalid discountType" });
        }
        const nextDiscount = getValidDiscount(discount === undefined ? coupon.discount : discount, nextType);
        if (!nextDiscount) {
            return res.status(400).json({
                message: "discount must be a positive number and percent must not exceed 100",
            });
        }
        const nextCode = code?.trim() || coupon.code;
        if (nextCode !== coupon.code) {
            const duplicate = await config_1.prisma.coupon.findUnique({
                where: { schoolId_code: { schoolId, code: nextCode } },
            });
            if (duplicate) {
                return res.status(409).json({
                    message: "Coupon with this code already exists in this school",
                });
            }
        }
        let classId = coupon.classId;
        if (classNumber && academicYearId) {
            const classDocument = await config_1.prisma.class.findFirst({
                where: { schoolId, academicYearId, classNumber },
            });
            if (!classDocument) {
                return res.status(400).json({ message: "Class doesn't exist" });
            }
            classId = classDocument.id;
        }
        await config_1.prisma.coupon.update({
            where: { id: coupon.id },
            data: {
                code: nextCode,
                discount: nextDiscount,
                discountType: nextType,
                classId,
            },
        });
        return res.status(200).json({ message: "Coupon updated successfully" });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const deleteCoupon = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const { code } = req.body;
        if (!schoolId || !code) {
            return res.status(400).json({ message: "schoolId and code are required" });
        }
        const coupon = await config_1.prisma.coupon.findUnique({
            where: { schoolId_code: { schoolId, code } },
        });
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }
        const studentCount = await config_1.prisma.student.count({
            where: { schoolId, couponId: coupon.id },
        });
        if (studentCount > 0) {
            return res.status(409).json({
                message: "Coupon cannot be deleted because it is assigned to a student",
            });
        }
        await config_1.prisma.coupon.delete({ where: { id: coupon.id } });
        return res.status(200).json({ message: "Coupon deleted successfully" });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.couponControllers = {
    createCoupon,
    getAllCoupons,
    editCouponStatus,
    updateCoupon,
    deleteCoupon,
};
