ALTER TYPE "SchoolStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchoolDataOperationType') THEN
    CREATE TYPE "SchoolDataOperationType" AS ENUM (
      'FULL_EXPORT', 'ACADEMIC_YEAR_EXPORT', 'ACADEMIC_YEAR_DELETE',
      'SCHOOL_ARCHIVE', 'SCHOOL_RESTORE', 'SCHOOL_DELETE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SchoolDataOperationStatus') THEN
    CREATE TYPE "SchoolDataOperationStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school_data_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolCode" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "academicYearId" TEXT,
  "academicYearName" TEXT,
  "operation" "SchoolDataOperationType" NOT NULL,
  "status" "SchoolDataOperationStatus" NOT NULL DEFAULT 'PENDING',
  "fileName" TEXT,
  "downloadPath" TEXT,
  "checksum" TEXT,
  "fileSize" INTEGER,
  "metadata" JSONB,
  "createdByPlatformAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  CONSTRAINT "school_data_operations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_data_operations_schoolId_createdAt_idx" ON "school_data_operations" ("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "school_data_operations_schoolId_operation_status_idx" ON "school_data_operations" ("schoolId", "operation", "status");

CREATE TABLE IF NOT EXISTS "platform_data_deletion_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "schoolCode" TEXT NOT NULL,
  "schoolName" TEXT NOT NULL,
  "academicYearId" TEXT,
  "academicYearName" TEXT,
  "operation" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedByPlatformAdminId" TEXT,
  "details" JSONB,
  CONSTRAINT "platform_data_deletion_audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "platform_data_deletion_audits_schoolId_deletedAt_idx" ON "platform_data_deletion_audits" ("schoolId", "deletedAt");
CREATE INDEX IF NOT EXISTS "platform_data_deletion_audits_schoolCode_deletedAt_idx" ON "platform_data_deletion_audits" ("schoolCode", "deletedAt");
