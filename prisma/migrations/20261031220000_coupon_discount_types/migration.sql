CREATE TYPE "CouponDiscountType" AS ENUM ('AMOUNT', 'PERCENT');

ALTER TABLE "coupons"
ADD COLUMN "discount_type" "CouponDiscountType" NOT NULL DEFAULT 'AMOUNT';
