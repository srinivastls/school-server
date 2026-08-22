import {
  ClassType,
  CouponType,
  FeeLine,
  Sibling,
  StudentType,
} from "./entities.types";

export type CreateStudentRequest = Omit<
  StudentType,
  | "siblings"
  | "pendingTuitionFee"
  | "pendingTextbookFee"
  | "pendingNotebookFee"
  | "pendingDiaryAmount"
> & {
  siblings: Omit<Sibling, "name">[];
  siblingStudentsFromDb: Pick<StudentType, "admissionNo" | "name">[];
};

export type GetClassStudentsRequest = Pick<ClassType, "classNumber">;
export type GetClassStudentsResponse = {
  students: Pick<StudentType, "admissionNo" | "name">[];
};

export type GetStudentRequest = Pick<StudentType, "admissionNo">;
export type GetStudentResponse = StudentType;

export type GetStudentByCoupon = Pick<CouponType, "code">;

export type EditStudentRequest = Omit<
  StudentType,
  "tie" | "belt" | "arrears"
> & {
  oldAdmissionNo: string;
  siblingStudentsFromDb: Pick<StudentType, "admissionNo" | "name">[];
  tie: Pick<FeeLine, "amount">;
  belt: Pick<FeeLine, "amount">;
  arrears: Pick<FeeLine, "amount">;
};

export type ClassStudentCountResponse = {
  countData: { classNumber: string; count: string }[];
};

export type PromoteDemoteRequest = { fromClass: string; toClass: string };

export type MarkClassCompleteRequest = { classNumber: string };
