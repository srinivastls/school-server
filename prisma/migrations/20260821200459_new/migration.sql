/*
  Warnings:

  - You are about to drop the `siblings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `student_arrears` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `student_belts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `student_ties` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[classNumber]` on the table `classes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `arrearsAmount` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `arrearsPendingAmount` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `beltAmount` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `beltPendingAmount` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `siblings` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tieAmount` to the `students` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tiePendingAmount` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('cash', 'wallet');

-- DropForeignKey
ALTER TABLE "siblings" DROP CONSTRAINT "siblings_studentId_fkey";

-- DropForeignKey
ALTER TABLE "student_arrears" DROP CONSTRAINT "student_arrears_studentId_fkey";

-- DropForeignKey
ALTER TABLE "student_belts" DROP CONSTRAINT "student_belts_studentId_fkey";

-- DropForeignKey
ALTER TABLE "student_ties" DROP CONSTRAINT "student_ties_studentId_fkey";

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "arrearsAmount" TEXT NOT NULL,
ADD COLUMN     "arrearsPendingAmount" TEXT NOT NULL,
ADD COLUMN     "beltAmount" TEXT NOT NULL,
ADD COLUMN     "beltPendingAmount" TEXT NOT NULL,
ADD COLUMN     "siblings" JSONB NOT NULL,
ADD COLUMN     "tieAmount" TEXT NOT NULL,
ADD COLUMN     "tiePendingAmount" TEXT NOT NULL;

-- DropTable
DROP TABLE "siblings";

-- DropTable
DROP TABLE "student_arrears";

-- DropTable
DROP TABLE "student_belts";

-- DropTable
DROP TABLE "student_ties";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "pendingAmount" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "transactionId" TEXT,
    "classNumber" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "studentId" TEXT,
    "tieAmount" TEXT NOT NULL,
    "diaryAmount" TEXT NOT NULL,
    "beltAmount" TEXT NOT NULL,
    "arrearsAmount" TEXT NOT NULL,
    "tuitionFeeAmount" TEXT NOT NULL,
    "textBookFeeAmount" TEXT NOT NULL,
    "noteBookFeeAmount" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_adminId_key" ON "users"("adminId");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE UNIQUE INDEX "classes_classNumber_key" ON "classes"("classNumber");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
