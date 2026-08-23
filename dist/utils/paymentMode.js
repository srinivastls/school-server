"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toApiPaymentMode = exports.toPrismaPaymentMode = void 0;
const client_1 = require("@prisma/client");
const entities_types_1 = require("../types/entities.types");
/* ============================================================
   API -> PRISMA
============================================================ */
const toPrismaPaymentMode = (paymentMode) => {
    switch (paymentMode) {
        case entities_types_1.PaymentMode.CASH:
            return client_1.PaymentMode.CASH;
        case entities_types_1.PaymentMode.WALLET:
            return client_1.PaymentMode.WALLET;
        default:
            return null;
    }
};
exports.toPrismaPaymentMode = toPrismaPaymentMode;
/* ============================================================
   PRISMA -> API
============================================================ */
const toApiPaymentMode = (paymentMode) => {
    switch (paymentMode) {
        case client_1.PaymentMode.CASH:
            return entities_types_1.PaymentMode.CASH;
        case client_1.PaymentMode.WALLET:
            return entities_types_1.PaymentMode.WALLET;
        default:
            throw new Error(`Unsupported payment mode: ${paymentMode}`);
    }
};
exports.toApiPaymentMode = toApiPaymentMode;
