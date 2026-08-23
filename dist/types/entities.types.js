"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMode = exports.CouponStatus = void 0;
const client_1 = require("@prisma/client");
Object.defineProperty(exports, "PaymentMode", { enumerable: true, get: function () { return client_1.PaymentMode; } });
/* ============================================================
   COUPON
============================================================ */
var CouponStatus;
(function (CouponStatus) {
    CouponStatus["ACTIVE"] = "ACTIVE";
    CouponStatus["APPLIED"] = "APPLIED";
})(CouponStatus || (exports.CouponStatus = CouponStatus = {}));
