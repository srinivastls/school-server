/*
  Multi-tenant foundation

  This migration represents the tenant foundation:
    - schools
    - school_id on existing tenant-owned tables
    - foreign keys from existing tables to schools

  IMPORTANT:
  The current Railway database already contains these changes.
  Therefore this migration must be marked as applied there with
  `prisma migrate resolve --applied`.

  Fresh databases will execute this migration normally.
*/

-- ============================================================
-- SCHOOL / TENANT
-- ============================================================

CREATE TABLE "schools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    "subscription_plan" VARCHAR(50) NOT NULL DEFAULT 'FREE',
    "status" VARCHAR(50) NOT NULL DEFAULT 'ONBOARDING',
    "max_students" INTEGER NOT NULL DEFAULT 100,
    "max_staff_accounts" INTEGER NOT NULL DEFAULT 5,
    "grace_period_days" INTEGER NOT NULL DEFAULT 7,
    "feature_flags" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- EXISTING TABLES → SCHOOL
-- ============================================================

ALTER TABLE "users"
ADD COLUMN "school_id" UUID NOT NULL;

ALTER TABLE "classes"
ADD COLUMN "school_id" UUID NOT NULL;

ALTER TABLE "students"
ADD COLUMN "school_id" UUID NOT NULL;

ALTER TABLE "coupons"
ADD COLUMN "school_id" UUID NOT NULL;

ALTER TABLE "transactions"
ADD COLUMN "school_id" UUID NOT NULL;

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE "users"
ADD CONSTRAINT "users_school_id_fkey"
FOREIGN KEY ("school_id")
REFERENCES "schools"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;

ALTER TABLE "classes"
ADD CONSTRAINT "classes_school_id_fkey"
FOREIGN KEY ("school_id")
REFERENCES "schools"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;

ALTER TABLE "students"
ADD CONSTRAINT "students_school_id_fkey"
FOREIGN KEY ("school_id")
REFERENCES "schools"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;

ALTER TABLE "coupons"
ADD CONSTRAINT "coupons_school_id_fkey"
FOREIGN KEY ("school_id")
REFERENCES "schools"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_school_id_fkey"
FOREIGN KEY ("school_id")
REFERENCES "schools"("id")
ON DELETE NO ACTION
ON UPDATE NO ACTION;