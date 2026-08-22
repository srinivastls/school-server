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
exports.reportControllers = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
const config_1 = require("../config");
const utils_1 = require("../utils");
dayjs_1.default.extend(customParseFormat_1.default);
const getMonthOrDateFilter = (date, month, year) => {
    if (date) {
        return [date];
    }
    return (0, utils_1.getMonthDateRange)(month !== null && month !== void 0 ? month : "1", year);
};
const getTotalFee = (student, classDetails) => {
    const { tuitionFee, textBookFee, noteBookFee, diary, } = classDetails;
    const { tie, belt, arrears } = student;
    return (+tuitionFee +
        +textBookFee +
        +noteBookFee +
        +diary +
        +tie.amount +
        +belt.amount +
        +arrears.amount);
};
const getPercUnpaidStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { classNumber, perc } = req.query;
        if (!classNumber || !perc) {
            return res.status(400).json({
                message: "Request query missing some parameters",
            });
        }
        if (isNaN(+perc)) {
            return res.status(400).json({
                message: "Invalid percentage",
            });
        }
        const classDetails = yield config_1.prisma.class.findUnique({
            where: {
                classNumber,
            },
            include: {
                students: true,
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist.",
            });
        }
        const result = [];
        for (const student of classDetails.students) {
            const totalFee = +classDetails.tuitionFee +
                +classDetails.textBookFee +
                +classDetails.noteBookFee +
                +classDetails.diary +
                +student.tieAmount +
                +student.beltAmount +
                +student.arrearsAmount;
            if (+student.pendingAmount * (100 / totalFee) >= +perc) {
                result.push({
                    name: student.name,
                    admissionNo: student.admissionNo,
                });
            }
        }
        return res.status(200).json(result);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
});
const getMonthOrDateReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { classNumber, month, date, year } = req.body;
        if (!classNumber || !year || (!month && !date)) {
            return res.status(400).json({
                message: "Request body is missing some params",
            });
        }
        const dates = getMonthOrDateFilter(date !== null && date !== void 0 ? date : "", month !== null && month !== void 0 ? month : "", year);
        const txns = yield config_1.prisma.transaction.findMany({
            where: {
                classNumber,
                date: {
                    in: dates,
                },
            },
            include: {
                student: {
                    include: {
                        class: true,
                        coupon: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        const response = txns.map((txn) => ({
            date: txn.date,
            classNumber: txn.classNumber,
            id: txn.id,
            pendingAmount: txn.pendingAmount,
            paymentMode: txn.paymentMode,
            amount: txn.amount,
            amountDetails: {
                tie: txn.tieAmount,
                diary: txn.diaryAmount,
                belt: txn.beltAmount,
                arrears: txn.arrearsAmount,
                tuitionFee: txn.tuitionFeeAmount,
                textBookFee: txn.textBookFeeAmount,
                noteBookFee: txn.noteBookFeeAmount,
            },
            student: txn.student,
            adminId: txn.adminId,
        }));
        return res.status(200).json(response);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
});
const getStudentMonthOrDateReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { admissionNo, month, date, year } = req.body;
        if (!admissionNo || !year || (!month && !date)) {
            return res.status(400).json({
                message: "Request body is missing some params",
            });
        }
        const student = yield config_1.prisma.student.findUnique({
            where: {
                admissionNo,
            },
        });
        if (!student) {
            return res.status(400).json({
                message: "Student not found",
            });
        }
        const dates = getMonthOrDateFilter(date !== null && date !== void 0 ? date : "", month !== null && month !== void 0 ? month : "", year);
        const txns = yield config_1.prisma.transaction.findMany({
            where: {
                studentId: student.id,
                date: {
                    in: dates,
                },
            },
            include: {
                student: {
                    include: {
                        class: true,
                        coupon: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        const response = txns.map((txn) => ({
            date: txn.date,
            classNumber: txn.classNumber,
            id: txn.id,
            pendingAmount: txn.pendingAmount,
            paymentMode: txn.paymentMode,
            amount: txn.amount,
            amountDetails: {
                tie: txn.tieAmount,
                diary: txn.diaryAmount,
                belt: txn.beltAmount,
                arrears: txn.arrearsAmount,
                tuitionFee: txn.tuitionFeeAmount,
                textBookFee: txn.textBookFeeAmount,
                noteBookFee: txn.noteBookFeeAmount,
            },
            student: txn.student,
            adminId: txn.adminId,
        }));
        return res.status(200).json(response);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
});
exports.reportControllers = {
    getPercUnpaidStudents,
    getMonthOrDateReport,
    getStudentMonthOrDateReport,
};
