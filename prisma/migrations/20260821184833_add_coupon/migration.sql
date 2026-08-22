-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aadhaar" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "dob" TEXT NOT NULL,
    "doj" TEXT NOT NULL,
    "phoneNo" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "couponId" TEXT,
    "pendingTuitionFee" TEXT NOT NULL,
    "pendingTextbookFee" TEXT NOT NULL,
    "pendingNotebookFee" TEXT NOT NULL,
    "pendingDiaryAmount" TEXT NOT NULL,
    "pendingAmount" TEXT NOT NULL,
    "tcNo" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_ties" (
    "id" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "pendingAmount" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "student_ties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_belts" (
    "id" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "pendingAmount" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "student_belts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_arrears" (
    "id" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "pendingAmount" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "student_arrears_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siblings" (
    "id" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "siblings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_admissionNo_key" ON "students"("admissionNo");

-- CreateIndex
CREATE UNIQUE INDEX "students_aadhaar_key" ON "students"("aadhaar");

-- CreateIndex
CREATE UNIQUE INDEX "student_ties_studentId_key" ON "student_ties"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_belts_studentId_key" ON "student_belts"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_arrears_studentId_key" ON "student_arrears"("studentId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_ties" ADD CONSTRAINT "student_ties_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_belts" ADD CONSTRAINT "student_belts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_arrears" ADD CONSTRAINT "student_arrears_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siblings" ADD CONSTRAINT "siblings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
