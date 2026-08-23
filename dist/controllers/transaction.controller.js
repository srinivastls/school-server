"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionControllers = void 0;
const crypto_1 = require("crypto");
const config_1 = require("../config");
const client_1 = require("@prisma/client");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return (req.user?.schoolId ??
        req.body?.schoolId);
};
const getUserId = (req) => {
    return req.user?.id;
};
/* ============================================================
   PAYMENT MODE NORMALIZER
============================================================ */
/*
 * Frontend may send:
 *
 * CASH
 * cash
 * WALLET
 * wallet
 * ONLINE
 * online
 *
 * Internally we always use Prisma enum values.
 */
const normalizePaymentMode = (value) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.toUpperCase();
    if (Object.values(client_1.PaymentMode).includes(normalized)) {
        return normalized;
    }
    return undefined;
};
/* ============================================================
   RECORD TRANSACTION
============================================================ */
const recordTxn = async (req, res) => {
    try {
        const { amount, paymentMode, date, studentAdmissionNo, amountDetails, transactionId, } = req.body;
        /* --------------------------------------------------------
           AUTHENTICATION
        -------------------------------------------------------- */
        const schoolId = getSchoolId(req);
        const userId = getUserId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!userId) {
            return res.status(401).json({
                message: "Authenticated user not found",
            });
        }
        /* --------------------------------------------------------
           BASIC VALIDATION
        -------------------------------------------------------- */
        if (amount === undefined ||
            amountDetails === undefined ||
            !paymentMode ||
            !date ||
            !studentAdmissionNo) {
            return res.status(400).json({
                message: "Some params missing in request body",
            });
        }
        /* --------------------------------------------------------
           PAYMENT MODE
        -------------------------------------------------------- */
        const prismaPaymentMode = normalizePaymentMode(paymentMode);
        if (!prismaPaymentMode) {
            return res.status(400).json({
                message: "Invalid payment mode",
            });
        }
        /* --------------------------------------------------------
           WALLET VALIDATION
        -------------------------------------------------------- */
        if (prismaPaymentMode ===
            client_1.PaymentMode.WALLET &&
            !transactionId) {
            return res.status(400).json({
                message: "transactionId is required for wallet payment",
            });
        }
        /* --------------------------------------------------------
           FIND STUDENT
        -------------------------------------------------------- */
        const student = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo: studentAdmissionNo,
                },
            },
            include: {
                class: true,
            },
        });
        if (!student) {
            return res.status(404).json({
                message: "Student not found",
            });
        }
        /* --------------------------------------------------------
           CONVERT AMOUNTS
        -------------------------------------------------------- */
        const transactionAmount = Number(amount);
        const tie = Number(amountDetails.tie ?? 0);
        const diary = Number(amountDetails.diary ?? 0);
        const belt = Number(amountDetails.belt ?? 0);
        const arrears = Number(amountDetails.arrears ?? 0);
        const tuitionFee = Number(amountDetails.tuitionFee ?? 0);
        const textBookFee = Number(amountDetails.textBookFee ?? 0);
        const noteBookFee = Number(amountDetails.noteBookFee ?? 0);
        /* --------------------------------------------------------
           NUMERIC VALIDATION
        -------------------------------------------------------- */
        const allAmounts = [
            transactionAmount,
            tie,
            diary,
            belt,
            arrears,
            tuitionFee,
            textBookFee,
            noteBookFee,
        ];
        if (allAmounts.some((value) => !Number.isFinite(value))) {
            return res.status(400).json({
                message: "Invalid amount",
            });
        }
        /* --------------------------------------------------------
           NEGATIVE AMOUNT VALIDATION
        -------------------------------------------------------- */
        if (allAmounts.some((value) => value < 0)) {
            return res.status(400).json({
                message: "Amounts cannot be negative",
            });
        }
        /* --------------------------------------------------------
           PENDING AMOUNT VALIDATION
        -------------------------------------------------------- */
        if (tie >
            Number(student.tiePendingAmount) ||
            belt >
                Number(student.beltPendingAmount) ||
            arrears >
                Number(student.arrearsPendingAmount) ||
            tuitionFee >
                Number(student.pendingTuitionFee) ||
            textBookFee >
                Number(student.pendingTextbookFee) ||
            noteBookFee >
                Number(student.pendingNotebookFee) ||
            diary >
                Number(student.pendingDiaryAmount) ||
            transactionAmount >
                Number(student.pendingAmount)) {
            return res.status(400).json({
                message: "Amount cannot be greater than pending amount",
            });
        }
        /* --------------------------------------------------------
           COMPONENT TOTAL
        -------------------------------------------------------- */
        const componentTotal = tie +
            diary +
            belt +
            arrears +
            tuitionFee +
            textBookFee +
            noteBookFee;
        const difference = Math.abs(componentTotal -
            transactionAmount);
        if (difference > 0.001) {
            return res.status(400).json({
                message: "Amount does not match amount details",
            });
        }
        /* --------------------------------------------------------
           NEW PENDING AMOUNT
        -------------------------------------------------------- */
        const newPendingAmount = Math.max(0, Number(student.pendingAmount) -
            transactionAmount).toString();
        /* --------------------------------------------------------
           CLASS NUMBER
        -------------------------------------------------------- */
        const classNumber = student.class?.classNumber ??
            "(class deleted)";
        /* --------------------------------------------------------
           RECEIPT NUMBER
        -------------------------------------------------------- */
        const receiptNumber = `RCP-${Date.now()}-${(0, crypto_1.randomUUID)()
            .slice(0, 8)
            .toUpperCase()}`;
        /* ========================================================
           DATABASE TRANSACTION
        ======================================================== */
        const txn = await config_1.prisma.$transaction(async (tx) => {
            /* --------------------------------------------------
               CREATE TRANSACTION
            -------------------------------------------------- */
            const createdTxn = await tx.transaction.create({
                data: {
                    schoolId,
                    amount: transactionAmount.toString(),
                    paymentMode: prismaPaymentMode,
                    date,
                    studentId: student.id,
                    transactionId: transactionId ??
                        null,
                    receiptNumber,
                    recordedByUserId: userId,
                    classNumber,
                    pendingAmount: newPendingAmount,
                    tieAmount: tie.toString(),
                    diaryAmount: diary.toString(),
                    beltAmount: belt.toString(),
                    arrearsAmount: arrears.toString(),
                    tuitionFeeAmount: tuitionFee.toString(),
                    textBookFeeAmount: textBookFee.toString(),
                    noteBookFeeAmount: noteBookFee.toString(),
                },
            });
            /* --------------------------------------------------
               UPDATE STUDENT
            -------------------------------------------------- */
            await tx.student.update({
                where: {
                    id: student.id,
                },
                data: {
                    tiePendingAmount: Math.max(0, Number(student.tiePendingAmount) -
                        tie).toString(),
                    beltPendingAmount: Math.max(0, Number(student.beltPendingAmount) -
                        belt).toString(),
                    arrearsPendingAmount: Math.max(0, Number(student.arrearsPendingAmount) -
                        arrears).toString(),
                    pendingTuitionFee: Math.max(0, Number(student.pendingTuitionFee) -
                        tuitionFee).toString(),
                    pendingTextbookFee: Math.max(0, Number(student.pendingTextbookFee) -
                        textBookFee).toString(),
                    pendingNotebookFee: Math.max(0, Number(student.pendingNotebookFee) -
                        noteBookFee).toString(),
                    pendingDiaryAmount: Math.max(0, Number(student.pendingDiaryAmount) -
                        diary).toString(),
                    pendingAmount: newPendingAmount,
                },
            });
            return createdTxn;
        });
        /* ========================================================
           RESPONSE
        ======================================================== */
        return res.status(200).json({
            id: txn.id,
            amount: txn.amount,
            paymentMode: txn.paymentMode,
            date: txn.date,
            student: txn.studentId,
            transactionId: txn.transactionId ??
                undefined,
            receiptNumber: txn.receiptNumber,
            recordedByUserId: txn.recordedByUserId,
            classNumber: txn.classNumber,
            pendingAmount: txn.pendingAmount,
            amountDetails: {
                tie: txn.tieAmount,
                diary: txn.diaryAmount,
                belt: txn.beltAmount,
                arrears: txn.arrearsAmount,
                tuitionFee: txn.tuitionFeeAmount,
                textBookFee: txn.textBookFeeAmount,
                noteBookFee: txn.noteBookFeeAmount,
            },
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET STUDENT TRANSACTIONS
============================================================ */
const getStudentTxns = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const admissionNo = req.body.admissionNo;
        if (!admissionNo) {
            return res.status(400).json({
                message: "admissionNo missing in request body",
            });
        }
        /* --------------------------------------------------------
           FIND STUDENT
        -------------------------------------------------------- */
        const student = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo,
                },
            },
        });
        if (!student) {
            return res.status(404).json({
                message: "Student not found",
            });
        }
        /* --------------------------------------------------------
           FIND TRANSACTIONS
        -------------------------------------------------------- */
        const txns = await config_1.prisma.transaction.findMany({
            where: {
                schoolId,
                studentId: student.id,
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
        /* --------------------------------------------------------
           RESPONSE
        -------------------------------------------------------- */
        const response = txns.map((txn) => ({
            id: txn.id,
            date: txn.date,
            classNumber: txn.classNumber,
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
            transactionId: txn.transactionId ??
                undefined,
            receiptNumber: txn.receiptNumber,
            recordedByUserId: txn.recordedByUserId,
        }));
        return res.status(200).json(response);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET TOTAL TRANSACTION AMOUNT
============================================================ */
const getTotalTxnAmount = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { dates, } = req.body;
        if (!dates) {
            return res.status(400).json({
                message: "dates field is missing in request body",
            });
        }
        if (dates.length === 0) {
            return res.status(200).json({
                total: 0,
                walletTotal: 0,
            });
        }
        /* --------------------------------------------------------
           SCHOOL-SCOPED TRANSACTIONS
        -------------------------------------------------------- */
        const txns = await config_1.prisma.transaction.findMany({
            where: {
                schoolId,
                date: {
                    in: dates,
                },
            },
        });
        let total = 0;
        let walletTotal = 0;
        for (const txn of txns) {
            total +=
                Number(txn.amount);
            if (txn.paymentMode ===
                client_1.PaymentMode.WALLET) {
                walletTotal +=
                    Number(txn.amount);
            }
        }
        return res.status(200).json({
            total,
            walletTotal,
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.transactionControllers = {
    recordTxn,
    getStudentTxns,
    getTotalTxnAmount,
};
