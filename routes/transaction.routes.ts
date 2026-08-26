import { Express } from "express";
import { transactionControllers } from "../controllers/transaction.controller";
import { authJwt } from "../middlewares";

const { verifyToken, isPrincipal } = authJwt;
const { recordTxn, getStudentTxns, getTotalTxnAmount } = transactionControllers;

export const useTransactionRoutes = (app: Express) => {
  app.post("/api/txn/record", [verifyToken], recordTxn);

  app.post("/api/txn/getByStudent", [verifyToken], getStudentTxns);

  app.post(
    "/api/txn/getTotalTxnAmount",
    [verifyToken, isPrincipal],
    getTotalTxnAmount
  );
};
