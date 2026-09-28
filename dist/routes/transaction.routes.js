"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTransactionRoutes = void 0;
const transaction_controller_1 = require("../controllers/transaction.controller");
const middlewares_1 = require("../middlewares");
const { verifyToken, isPrincipalOrAdmin, } = middlewares_1.authJwt;
const { recordTxn, getStudentTxns, getTotalTxnAmount, } = transaction_controller_1.transactionControllers;
const useTransactionRoutes = (app) => {
    /**
     * Record fee payment
     * Accessible to Principal and School Admin
     */
    app.post("/api/txn/record", [verifyToken, isPrincipalOrAdmin], recordTxn);
    /**
     * Get transactions for a student
     * Accessible to Principal and School Admin
     */
    app.post("/api/txn/getByStudent", [verifyToken, isPrincipalOrAdmin], getStudentTxns);
    /**
     * Get total transaction amount
     * Accessible to Principal and School Admin
     */
    app.post("/api/txn/getTotalTxnAmount", [verifyToken, isPrincipalOrAdmin], getTotalTxnAmount);
};
exports.useTransactionRoutes = useTransactionRoutes;
