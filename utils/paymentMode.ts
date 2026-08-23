import {
  PaymentMode as PrismaPaymentMode,
} from "@prisma/client";

import {
  PaymentMode,
} from "../types/entities.types";

/* ============================================================
   API -> PRISMA
============================================================ */

export const toPrismaPaymentMode = (
  paymentMode: PaymentMode
): PrismaPaymentMode | null => {
  switch (paymentMode) {
    case PaymentMode.CASH:
      return PrismaPaymentMode.CASH;

    case PaymentMode.WALLET:
      return PrismaPaymentMode.WALLET;

    default:
      return null;
  }
};

/* ============================================================
   PRISMA -> API
============================================================ */

export const toApiPaymentMode = (
  paymentMode: PrismaPaymentMode
): PaymentMode => {
  switch (paymentMode) {
    case PrismaPaymentMode.CASH:
      return PaymentMode.CASH;

    case PrismaPaymentMode.WALLET:
      return PaymentMode.WALLET;

    default:
      throw new Error(
        `Unsupported payment mode: ${paymentMode}`
      );
  }
};