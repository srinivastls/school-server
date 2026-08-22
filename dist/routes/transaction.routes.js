"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTransactionRoutes = void 0;
const transaction_controller_1 = require("../controllers/transaction.controller");
const middlewares_1 = require("../middlewares");
const { verifyToken, isSuperAdmin } = middlewares_1.authJwt;
const { recordTxn, getStudentTxns, getTotalTxnAmount } = transaction_controller_1.transactionControllers;
const useTransactionRoutes = (app) => {
    app.post("/api/txn/record", [verifyToken], recordTxn);
    app.post("/api/txn/getByStudent", [verifyToken], getStudentTxns);
    app.post("/api/txn/getTotalTxnAmount", [verifyToken, isSuperAdmin], getTotalTxnAmount);
};
exports.useTransactionRoutes = useTransactionRoutes;
