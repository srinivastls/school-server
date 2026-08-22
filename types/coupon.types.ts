import { CouponType } from "./entities.types";

export type CreateCouponRequest = Omit<CouponType, "status">;

export type GetAllCouponsResponse = { coupons: CouponType[] };

export type EditCouponStatusRequest = Pick<CouponType, "code" | "status">;
