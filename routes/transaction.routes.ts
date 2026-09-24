import { Express } from "express";

import {
  transactionControllers,
} from "../controllers/transaction.controller";

import { authJwt } from "../middlewares";

const {
  verifyToken,
  isPrincipalOrAdmin,
} = authJwt;

const {
  recordTxn,
  getStudentTxns,
  getTotalTxnAmount,
} = transactionControllers;

export const useTransactionRoutes = (app: Express) => {
  /**
   * Record fee payment
   * Accessible to Principal and School Admin
   */
  app.post(
    "/api/txn/record",
    [verifyToken, isPrincipalOrAdmin],
    recordTxn
  );

  /**
   * Get transactions for a student
   * Accessible to Principal and School Admin
   */
  app.post(
    "/api/txn/getByStudent",
    [verifyToken, isPrincipalOrAdmin],
    getStudentTxns
  );

  /**
   * Get total transaction amount
   * Accessible to Principal and School Admin
   */
  app.post(
    "/api/txn/getTotalTxnAmount",
    [verifyToken, isPrincipalOrAdmin],
    getTotalTxnAmount
  );
};