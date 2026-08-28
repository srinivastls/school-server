-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "classNumber" TEXT NOT NULL,
    "tuitionFee" TEXT NOT NULL,
    "textBookFee" TEXT NOT NULL,
    "noteBookFee" TEXT NOT NULL,
    "diary" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);
