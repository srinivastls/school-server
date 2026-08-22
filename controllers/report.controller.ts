import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import { prisma } from "../config";

import {
  ClassType,
  GetMonthOrDateReportRequest,
  GetPercUnpaidStudentRequest,
  GetPercUnpaidStudentResponse,
  GetStudentMonthOrDateReportRequest,
  RequestWithBody,
  RequestWithQuery,
  Response,
  StudentType,
  TxnResponse,
} from "../types";

import { getMonthDateRange, handleErr } from "../utils";

dayjs.extend(customParseFormat);

const getMonthOrDateFilter = (
  date: string,
  month: string,
  year: string
) => {
  if (date) {
    return [date];
  }

  return getMonthDateRange(month ?? "1", year);
};

const getTotalFee = (
  student: StudentType,
  classDetails: ClassType
) => {
  const {
    tuitionFee,
    textBookFee,
    noteBookFee,
    diary,
  } = classDetails;

  const { tie, belt, arrears } = student;

  return (
    +tuitionFee +
    +textBookFee +
    +noteBookFee +
    +diary +
    +tie.amount +
    +belt.amount +
    +arrears.amount
  );
};

const getPercUnpaidStudents = async (
  req: RequestWithQuery<GetPercUnpaidStudentRequest>,
  res: Response<GetPercUnpaidStudentResponse>
) => {
  try {
    const { classNumber, perc } = req.query;

    if (!classNumber || !perc) {
      return res.status(400).json({
        message: "Request query missing some parameters",
      });
    }

    if (isNaN(+perc)) {
      return res.status(400).json({
        message: "Invalid percentage",
      });
    }

    const classDetails = await prisma.class.findUnique({
      where: {
        classNumber,
      },
      include: {
        students: true,
      },
    });

    if (!classDetails) {
      return res.status(400).json({
        message: "Class doesn't exist.",
      });
    }

    const result: GetPercUnpaidStudentResponse = [];

    for (const student of classDetails.students) {
      const totalFee =
        +classDetails.tuitionFee +
        +classDetails.textBookFee +
        +classDetails.noteBookFee +
        +classDetails.diary +
        +student.tieAmount +
        +student.beltAmount +
        +student.arrearsAmount;

      if (+student.pendingAmount * (100 / totalFee) >= +perc) {
        result.push({
          name: student.name,
          admissionNo: student.admissionNo,
        });
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    return handleErr(error, res);
  }
};

const getMonthOrDateReport = async (
  req: RequestWithBody<GetMonthOrDateReportRequest>,
  res: Response<TxnResponse[]>
) => {
  try {
    const { classNumber, month, date, year } = req.body;

    if (!classNumber || !year || (!month && !date)) {
      return res.status(400).json({
        message: "Request body is missing some params",
      });
    }

    const dates = getMonthOrDateFilter(
      date ?? "",
      month ?? "",
      year
    );

    const txns = await prisma.transaction.findMany({
      where: {
        classNumber,
        date: {
          in: dates,
        },
      },
      include: {
        student: {
          include: {
            class: true,
            coupon: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const response: TxnResponse[] = txns.map((txn) => ({
      date: txn.date,
      classNumber: txn.classNumber,
      id: txn.id,
      pendingAmount: txn.pendingAmount,
      paymentMode: txn.paymentMode as any,
      amount: txn.amount,
      amountDetails: {
        tie: txn.tieAmount,
        diary: txn.diaryAmount,
        belt: txn.beltAmount,
        arrears: txn.arrearsAmount,
        tuitionFee: txn.tuitionFeeAmount,
        textBookFee: txn.textBookFeeAmount,
        noteBookFee: txn.noteBookFeeAmount,
      },
      student: txn.student as any,
      adminId: txn.adminId,
    }));

    return res.status(200).json(response);
  } catch (error) {
    return handleErr(error, res);
  }
};

const getStudentMonthOrDateReport = async (
  req: RequestWithBody<GetStudentMonthOrDateReportRequest>,
  res: Response<TxnResponse[]>
) => {
  try {
    const { admissionNo, month, date, year } = req.body;

    if (!admissionNo || !year || (!month && !date)) {
      return res.status(400).json({
        message: "Request body is missing some params",
      });
    }

    const student = await prisma.student.findUnique({
      where: {
        admissionNo,
      },
    });

    if (!student) {
      return res.status(400).json({
        message: "Student not found",
      });
    }

    const dates = getMonthOrDateFilter(
      date ?? "",
      month ?? "",
      year
    );

    const txns = await prisma.transaction.findMany({
      where: {
        studentId: student.id,
        date: {
          in: dates,
        },
      },
      include: {
        student: {
          include: {
            class: true,
            coupon: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const response: TxnResponse[] = txns.map((txn) => ({
      date: txn.date,
      classNumber: txn.classNumber,
      id: txn.id,
      pendingAmount: txn.pendingAmount,
      paymentMode: txn.paymentMode as any,
      amount: txn.amount,
      amountDetails: {
        tie: txn.tieAmount,
        diary: txn.diaryAmount,
        belt: txn.beltAmount,
        arrears: txn.arrearsAmount,
        tuitionFee: txn.tuitionFeeAmount,
        textBookFee: txn.textBookFeeAmount,
        noteBookFee: txn.noteBookFeeAmount,
      },
      student: txn.student as any,
      adminId: txn.adminId,
    }));

    return res.status(200).json(response);
  } catch (error) {
    return handleErr(error, res);
  }
};

export const reportControllers = {
  getPercUnpaidStudents,
  getMonthOrDateReport,
  getStudentMonthOrDateReport,
};