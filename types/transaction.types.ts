import { TransactionType } from "./entities.types";

export type TxnResponse = TransactionType & {
  id: string;
};

export type RecordTxnRequest = Omit<
  TransactionType,
  "pendingAmount" | "student"
> & { studentAdmissionNo: string };
export type RecordTxnResponse = TxnResponse;

export type StudentTxnsRequest = {
  admissionNo: string;
};
export type StudentTxnsResponse = TxnResponse[];

export type GetTotalTxnAmountRequest = { dates: string[] };
export type GetTotalTxnAmountResponse = { total: number; walletTotal: number };
