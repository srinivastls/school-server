"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMode = exports.CouponStatus = exports.Roles = void 0;
var Roles;
(function (Roles) {
    Roles["owner"] = "owner";
    Roles["admin"] = "admin";
    Roles["superadmin"] = "superadmin";
})(Roles || (exports.Roles = Roles = {}));
var CouponStatus;
(function (CouponStatus) {
    CouponStatus["ACTIVE"] = "ACTIVE";
    CouponStatus["APPLIED"] = "APPLIED";
})(CouponStatus || (exports.CouponStatus = CouponStatus = {}));
var PaymentMode;
(function (PaymentMode) {
    PaymentMode["cash"] = "cash";
    PaymentMode["wallet"] = "wallet";
})(PaymentMode || (exports.PaymentMode = PaymentMode = {}));
