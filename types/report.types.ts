export type GetPercUnpaidStudentRequest = { classNumber: string; perc: string };
export type GetPercUnpaidStudentResponse = {
  name: string;
  admissionNo: string;
}[];

export type GetMonthOrDateReportRequest = {
  classNumber: string;
  month?: string;
  date?: string;
  year: string;
};

export type GetStudentMonthOrDateReportRequest = {
  admissionNo: string;
  month?: string;
  date?: string;
  year: string;
};
