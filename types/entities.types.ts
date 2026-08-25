import {
  PaymentMode,
  RoleName,
} from "@prisma/client";

/* ============================================================
   ROLE
============================================================ */

export type RoleType = {
  name: RoleName;
};

/* ============================================================
   USER
============================================================ */

export type UserType = {
  id?: string;

  email: string;
  name: string;

  designation: string | null;

  phone?: string | null;

  department?: string | null;

  employeeId?: string | null;

  schoolId?: string;

  role: RoleName;

  password?: string;
};

/* ============================================================
   CLASS
============================================================ */

export type ClassType = {
  id?: string;

  classNumber: string;

  displayName?: string;

  tuitionFee: string;

  textBookFee: string;

  noteBookFee: string;

  diaryFee: string;

  academicYearId?: string;

  academicYear?: string;

  isCompleted?: boolean;

  schoolId?: string;
};

/* ============================================================
   COUPON
============================================================ */

export enum CouponStatus {
  ACTIVE = "ACTIVE",
  APPLIED = "APPLIED",
}

export type CouponType = {
  id?: string;

  createdAt: string;

  classNumber: string;

  code: string;

  discount: string;

  status: CouponStatus;
};

/* ============================================================
   SIBLING
============================================================ */

export type Sibling = {
  admissionNo: string;
  name: string;
};

/* ============================================================
   FEE LINE
============================================================ */

export type FeeLine = {
  amount: string;
  pendingAmount: string;
};

/* ============================================================
   STUDENT
============================================================ */

export type StudentType = {
  id?: string;

  schoolId?: string;

  admissionNo: string;

  name: string;

  aadhaar?: string | null;

  fatherName: string;

  motherName?: string | null;

  dob: string;

  doj: string;

  phone?: string | null;

  classNumber: string;

  /**
   * Academic year associated with this student.
   */
  academicYearId?: string;

  sectionId?: string;

  sectionName?: string;

  tie: FeeLine;

  belt: FeeLine;

  arrears: FeeLine;

  pendingAmount: string;

  pendingTuitionFee: string;

  pendingTextbookFee: string;

  pendingNotebookFee: string;

  pendingDiaryAmount: string;

  couponCode?: string;

  tcNo?: string;

  siblings: Sibling[];

  /**
   * Legacy compatibility only.
   *
   * Student.createdByAdminId is the Prisma field.
   */
  adminId?: string;
};

export type CreateStudentFormFields = {
  admissionNo: string;

  name: string;

  aadhaar: string;

  fatherName: string;

  motherName?: string;

  dob: string;

  doj: string;

  phoneNo: string;

  tcNo?: string;

  classNumber: string;

  academicYearId: string;

  tie: string;

  diary: string;

  belt: string;

  arrears: string;

  couponCode?: string;

  siblings: Sibling[];
};
/* ============================================================
   PAYMENT MODE
============================================================ */

/*
 * Use Prisma PaymentMode directly.
 *
 * Prisma enum:
 *
 * CASH
 * WALLET
 * ONLINE
 */
export { PaymentMode };



/* ============================================================
   TRANSACTION
============================================================ */

export type TransactionType = {
  id?: string;

  date: string;

  student: StudentType | string | null;

  amount: string;

  amountDetails: {
    tie: string;

    diary: string;

    belt: string;

    arrears: string;

    tuitionFee: string;

    textBookFee: string;

    noteBookFee: string;

    other?: string;
  };

  pendingAmount: string;

  paymentMode: PaymentMode;

  classNumber: string;

  transactionId?: string;

  /*
   * New Prisma schema fields.
   */
  receiptNumber: string;

  recordedByUserId: string;
};


export type CreatePrincipalRequest = {
  name: string;
  email: string;
  password: string;

  designation?: string;
  phone?: string;
  department?: string;
  employeeId?: string;
};


export type CreateSchoolRequest = {
  code: string;
  name: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
  board?: string;

  subscriptionPlan?: string;

  maxStudents?: number;
  maxStaffAccounts?: number;

  gracePeriodDays?: number;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

