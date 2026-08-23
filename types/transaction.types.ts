import {
  PaymentMode,
  StudentType,
} from "./entities.types";

/* ============================================================
   TRANSACTION RESPONSE
============================================================ */

export type TxnResponse = {
  id: string;

  date: string;

  student: StudentType | string | null;

  amount: string;

  pendingAmount: string;

  paymentMode: PaymentMode;

  classNumber: string;

  transactionId?: string;

  receiptNumber: string;

  recordedByUserId: string;

  amountDetails: {
    tie: string;

    diary: string;

    belt: string;

    arrears: string;

    tuitionFee: string;

    textBookFee: string;

    noteBookFee: string;

    other?: string;
  };
};

/* ============================================================
   RECORD TRANSACTION REQUEST
============================================================ */

export type RecordTxnRequest = {
  amount: string | number;

  paymentMode: PaymentMode;

  date: string;

  studentAdmissionNo: string;

  amountDetails: {
    tie?: string | number;

    diary?: string | number;

    belt?: string | number;

    arrears?: string | number;

    tuitionFee?: string | number;

    textBookFee?: string | number;

    noteBookFee?: string | number;

    other?: string | number;
  };

  transactionId?: string;
};

/* ============================================================
   RECORD TRANSACTION RESPONSE
============================================================ */

export type RecordTxnResponse = TxnResponse;

/* ============================================================
   STUDENT TRANSACTIONS
============================================================ */

export type StudentTxnsRequest = {
  admissionNo: string;
};

export type StudentTxnsResponse = TxnResponse[];

/* ============================================================
   TOTAL TRANSACTION AMOUNT
============================================================ */

export type GetTotalTxnAmountRequest = {
  dates: string[];
};

export type GetTotalTxnAmountResponse = {
  total: number;

  walletTotal: number;
};