"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionControllers = void 0;
const config_1 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
const recordTxn = async (req, res) => {
    try {
        const { amount, paymentMode, date, studentAdmissionNo, adminId, amountDetails, transactionId, } = req.body;
        if (!amount ||
            !amountDetails ||
            !paymentMode ||
            !date ||
            !studentAdmissionNo ||
            !adminId ||
            (paymentMode === types_1.PaymentMode.wallet && !transactionId)) {
            return res
                .status(400)
                .json({ message: "Some params missing in request body" });
        }
        const student = await config_1.prisma.student.findUnique({
            where: {
                admissionNo: studentAdmissionNo,
            },
            include: {
                class: true,
            },
        });
        if (!student) {
            return res.status(400).json({ message: "Student not found" });
        }
        if (+amountDetails.tie > +student.tiePendingAmount ||
            +amountDetails.belt > +student.beltPendingAmount ||
            +amountDetails.arrears > +student.arrearsPendingAmount ||
            +amountDetails.diary > +student.pendingDiaryAmount ||
            +amountDetails.tuitionFee > +student.pendingTuitionFee ||
            +amountDetails.textBookFee > +student.pendingTextbookFee ||
            +amountDetails.noteBookFee > +student.pendingNotebookFee ||
            +amount > +student.pendingAmount) {
            return res
                .status(400)
                .json({ message: "Amount cannot be greater than pending amount" });
        }
        const { tie, diary, belt, arrears, tuitionFee, textBookFee, noteBookFee } = amountDetails;
        const newPendingAmount = `${+student.pendingAmount - +amount}`;
        /*
         * Prisma transaction ensures that:
         * 1. Transaction is created
         * 2. Student pending amounts are updated
         *
         * Both succeed together or both are rolled back.
         */
        const txn = await config_1.prisma.$transaction(async (tx) => {
            const createdTxn = await tx.transaction.create({
                data: {
                    amount: `${amount}`,
                    paymentMode,
                    date,
                    studentId: student.id,
                    adminId,
                    transactionId: transactionId ?? null,
                    classNumber: student.class?.classNumber ?? "(class deleted)",
                    pendingAmount: newPendingAmount,
                    tieAmount: `${tie}`,
                    diaryAmount: `${diary}`,
                    beltAmount: `${belt}`,
                    arrearsAmount: `${arrears}`,
                    tuitionFeeAmount: `${tuitionFee}`,
                    textBookFeeAmount: `${textBookFee}`,
                    noteBookFeeAmount: `${noteBookFee}`,
                },
            });
            await tx.student.update({
                where: {
                    admissionNo: studentAdmissionNo,
                },
                data: {
                    tiePendingAmount: `${+student.tiePendingAmount - +tie}`,
                    beltPendingAmount: `${+student.beltPendingAmount - +belt}`,
                    arrearsPendingAmount: `${+student.arrearsPendingAmount - +arrears}`,
                    pendingTuitionFee: `${+student.pendingTuitionFee - +tuitionFee}`,
                    pendingNotebookFee: `${+student.pendingNotebookFee - +noteBookFee}`,
                    pendingTextbookFee: `${+student.pendingTextbookFee - +textBookFee}`,
                    pendingDiaryAmount: `${+student.pendingDiaryAmount - +diary}`,
                    pendingAmount: newPendingAmount,
                },
            });
            return createdTxn;
        });
        return res.status(200).json({
            amount: txn.amount,
            paymentMode: txn.paymentMode,
            date: txn.date,
            student: txn.studentId,
            adminId: txn.adminId,
            transactionId: txn.transactionId ?? undefined,
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
            id: txn.id,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const getStudentTxns = async (req, res) => {
    try {
        if (!req.body.admissionNo) {
            return res
                .status(400)
                .json({ message: "admissionNo missing in request body" });
        }
        const student = await config_1.prisma.student.findUnique({
            where: {
                admissionNo: req.body.admissionNo,
            },
        });
        if (!student) {
            return res.status(400).json({ message: "Student not found" });
        }
        /*
         * We only filter by studentId.
         *
         * This is important because after a student is promoted,
         * old transactions should still be visible.
         */
        const txns = await config_1.prisma.transaction.findMany({
            where: {
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
            transactionId: txn.transactionId ?? undefined,
        }));
        return res.status(200).json(response);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
const getTotalTxnAmount = async (req, res) => {
    try {
        const { dates } = req.body;
        if (!dates) {
            return res
                .status(400)
                .json({ message: "dates field is missing in request body" });
        }
        if (dates.length === 0) {
            return res.status(200).json({
                total: 0,
                walletTotal: 0,
            });
        }
        const txns = await config_1.prisma.transaction.findMany({
            where: {
                date: {
                    in: dates,
                },
            },
        });
        let total = 0;
        let walletTotal = 0;
        for (const txn of txns) {
            total += +txn.amount;
            if (txn.paymentMode === types_1.PaymentMode.wallet) {
                walletTotal += +txn.amount;
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
exports.transactionControllers = {
    recordTxn,
    getStudentTxns,
    getTotalTxnAmount,
};
