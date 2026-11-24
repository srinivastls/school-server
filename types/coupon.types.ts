import { CouponType } from "./entities.types";

export type CreateCouponRequest = Omit<CouponType, "status">;

export type GetAllCouponsResponse = { coupons: CouponType[] };

export type EditCouponStatusRequest = Pick<CouponType, "code" | "status">;

export type UpdateCouponRequest = Partial<
  Pick<CouponType, "code" | "discount" | "discountType" | "classNumber">
> & {
  currentCode: string;
  academicYearId?: string;
};

export type DeleteCouponRequest = Pick<CouponType, "code">;
