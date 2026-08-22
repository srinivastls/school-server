export enum Roles {
  owner = "owner",
  admin = "admin",
  superadmin = "superadmin",
}

export type RoleType = {
  name: Roles;
};

export type UserType = {
  email: string;
  name: string;
  designation: string;
  adminId: string;
  roles: { name: Roles }[];
  password?: string;
};

export type ClassType = {
  classNumber: string;
  tuitionFee: string;
  textBookFee: string;
  noteBookFee: string;
  diary: string;
  year: string;
};

export enum CouponStatus {
  ACTIVE = "ACTIVE",
  APPLIED = "APPLIED",
}
export type CouponType = {
  createdAt: string;
  classNumber: string;
  code: string;
  discount: string;
  status: CouponStatus;
};

export type Sibling = {
  admissionNo: string;
  name: string;
};

export type FeeLine = {
  amount: string;
  pendingAmount: string;
};

export type StudentType = {
  admissionNo: string;
  name: string;
  aadhaar: string;
  fatherName: string;
  dob: string;
  doj: string;
  phoneNo: string;
  classNumber: string;
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
  adminId: string;
};

export enum PaymentMode {
  cash = "cash",
  wallet = "wallet",
}

export type TransactionType = {
  date: string;
  student: StudentType | string | null;
  adminId: string;
  amount: string;
  amountDetails: {
    tie: string;
    diary: string;
    belt: string;
    arrears: string;
  } & Pick<ClassType, "tuitionFee" | "textBookFee" | "noteBookFee"> & {
      other?: string;
    };
  pendingAmount: string;
  paymentMode: PaymentMode;
  classNumber: string;
  transactionId?: string;
};
