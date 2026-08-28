import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import { prisma } from "../config";

import {
  GetMonthOrDateReportRequest,
  GetPercUnpaidStudentRequest,
  GetPercUnpaidStudentResponse,
  GetStudentMonthOrDateReportRequest,
  RequestWithBody,
  RequestWithQuery,
  Response,
  TxnResponse,
} from "../types";

import {
  getMonthDateRange,
  handleErr,
} from "../utils";

dayjs.extend(customParseFormat);

/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (
  req: any
): string | undefined => {
  return (
    req.user?.schoolId ??
    req.body?.schoolId ??
    req.query?.schoolId
  );
};

const getMonthOrDateFilter = (
  date: string,
  month: string,
  year: string
): string[] => {
  if (date) {
    return [date];
  }

  return getMonthDateRange(
    month ?? "1",
    year
  );
};

/* ============================================================
   GET STUDENTS WITH PERCENTAGE UNPAID
============================================================ */

const getPercUnpaidStudents = async (
  req: RequestWithQuery<GetPercUnpaidStudentRequest>,
  res: Response<GetPercUnpaidStudentResponse>
) => {
  try {
    const {
      classNumber,
      perc,
    } = req.query;

    /* --------------------------------------------------------
       VALIDATE REQUEST
    -------------------------------------------------------- */

    if (!classNumber || !perc) {
      return res.status(400).json({
        message:
          "Request query missing some parameters",
      });
    }

    const percentage = Number(perc);

    if (
      !Number.isFinite(percentage) ||
      percentage < 0 ||
      percentage > 100
    ) {
      return res.status(400).json({
        message:
          "Invalid percentage",
      });
    }

    /* --------------------------------------------------------
       SCHOOL
    -------------------------------------------------------- */

    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message:
          "schoolId is required",
      });
    }

    /* --------------------------------------------------------
       FIND CLASS
       
       classNumber is unique only together with:
       schoolId + academicYearId + classNumber

       This API currently does not receive academicYearId,
       so we use schoolId + classNumber and only active classes.
    -------------------------------------------------------- */

    const classDetails =
      await prisma.class.findFirst({
        where: {
          schoolId,
          classNumber,
          isCompleted: false,
        },

        include: {
          students: true,
        },
      });

    if (!classDetails) {
      return res.status(404).json({
        message:
          "Class doesn't exist.",
      });
    }

    /* --------------------------------------------------------
       CALCULATE RESULT
    -------------------------------------------------------- */

    const result: GetPercUnpaidStudentResponse =
      [];

    for (
      const student of classDetails.students
    ) {
      const totalFee =
        Number(
          classDetails.tuitionFee
        ) +
        Number(
          classDetails.textBookFee
        ) +
        Number(
          classDetails.noteBookFee
        ) +
        Number(
          classDetails.diaryFee
        ) +
        Number(
          student.tieAmount
        ) +
        Number(
          student.beltAmount
        ) +
        Number(
          student.arrearsAmount
        );

      /* ------------------------------------------------------
         Avoid division by zero
      ------------------------------------------------------ */

      if (totalFee <= 0) {
        continue;
      }

      const unpaidPercentage =
        Number(student.pendingAmount) *
        (100 / totalFee);

      if (
        unpaidPercentage >= percentage
      ) {
        result.push({
          name: student.name,
          admissionNo:
            student.admissionNo,
        });
      }
    }

    return res.status(200).json(
      result
    );
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};


/* ============================================================
   GET PENDING DUES
   ------------------------------------------------------------
   Supports:
   - All classes
   - Specific class
   - Percentage filter
   - Full fee breakdown
   - Class-wise sorting
============================================================ */

const getPendingDues = async (
  req: RequestWithQuery<{
    classNumber?: string;
    perc?: string;
  }>,
  res: Response
) => {
  try {

    const {
      classNumber,
      perc = "100",
    } = req.query;


    /* ========================================================
       VALIDATE PERCENTAGE
    ======================================================== */

    const percentage =
      Number(perc);

    if (
      !Number.isFinite(
        percentage
      ) ||
      percentage < 0 ||
      percentage > 100
    ) {

      return res.status(400).json({
        message:
          "Invalid pending percentage",
      });

    }


    /* ========================================================
       SCHOOL
    ======================================================== */

    const schoolId =
      getSchoolId(req);

    if (!schoolId) {

      return res.status(400).json({
        message:
          "schoolId is required",
      });

    }


    /* ========================================================
       FETCH CLASSES
       
       If classNumber is supplied:
         -> only that class

       If not supplied:
         -> ALL active classes
    ======================================================== */

    const classes =
      await prisma.class.findMany({

        where: {

          schoolId,

          isCompleted:
            false,

          ...(classNumber
            ? {
                classNumber,
              }
            : {}),
        },

        include: {

          students: true,

        },

        orderBy: {

          classNumber:
            "asc",

        },

      });


    /* ========================================================
       CLASS NOT FOUND
       
       Only return error when a SPECIFIC class was requested.
    ======================================================== */

    if (
      classNumber &&
      classes.length === 0
    ) {

      return res.status(404).json({
        message:
          "Class doesn't exist.",
      });

    }


    /* ========================================================
       RESULT
    ======================================================== */

    const result: any[] = [];


    /* ========================================================
       PROCESS EACH CLASS
    ======================================================== */

    for (
      const classDetails
      of classes
    ) {

      /* ======================================================
         PROCESS EACH STUDENT
      ====================================================== */

      for (
        const student
        of classDetails.students
      ) {

        /* ====================================================
           TOTAL FEE
           
           EXACTLY SAME CALCULATION AS
           getPercUnpaidStudents
        ==================================================== */

        const totalFee =

          Number(
            classDetails.tuitionFee
          ) +

          Number(
            classDetails.textBookFee
          ) +

          Number(
            classDetails.noteBookFee
          ) +

          Number(
            classDetails.diaryFee
          ) +

          Number(
            student.tieAmount
          ) +

          Number(
            student.beltAmount
          ) +

          Number(
            student.arrearsAmount
          );


        /* ====================================================
           AVOID DIVISION BY ZERO
        ==================================================== */

        if (
          totalFee <= 0
        ) {

          continue;

        }


        /* ====================================================
           PENDING AMOUNT
        ==================================================== */

        const pendingAmount =
          Number(
            student.pendingAmount
          );


        /* ====================================================
           UNPAID %
           
           SAME FORMULA AS EXISTING API
        ==================================================== */

        const unpaidPercentage =
          pendingAmount *
          (100 / totalFee);


        /* ====================================================
           PERCENTAGE FILTER
        ==================================================== */

        if (
          unpaidPercentage <
          percentage
        ) {

          continue;

        }


        /* ====================================================
           PUSH STUDENT
        ==================================================== */

        result.push({

          id:
            student.id,

          admissionNo:
            student.admissionNo,

          name:
            student.name,

          classNumber:
            classDetails.classNumber,

          sectionName:
            student.sectionId ??
            "",

          totalFee,

          unpaidPercentage:

            Number(
              unpaidPercentage.toFixed(
                2
              )
            ),

          pendingAmount,

          pendingTuitionFee:

            Number(
              student.pendingTuitionFee ??
                0
            ),

          pendingTextbookFee:

            Number(
              student.pendingTextbookFee ??
                0
            ),

          pendingNotebookFee:

            Number(
              student.pendingNotebookFee ??
                0
            ),

          pendingDiaryAmount:

            Number(
              student.pendingDiaryAmount ??
                0
            ),

          tie: {

            amount:
              Number(
                student.tieAmount ??
                  0
              ),

            pendingAmount:
              Number(
                student.tiePendingAmount ??
                  0
              ),

          },

          belt: {

            amount:
              Number(
                student.beltAmount ??
                  0
              ),

            pendingAmount:
              Number(
                student.beltPendingAmount ??
                  0
              ),

          },

          arrears: {

            amount:
              Number(
                student.arrearsAmount ??
                  0
              ),

            pendingAmount:
              Number(
                student.arrearsPendingAmount ??
                  0
              ),

          },

        });

      }

    }


    /* ========================================================
       SORT
       
       Class -> Admission Number
    ======================================================== */

    result.sort(
      (
        a,
        b
      ) => {

        const classCompare =
          String(
            a.classNumber
          ).localeCompare(
            String(
              b.classNumber
            ),
            undefined,
            {
              numeric: true,
            }
          );


        if (
          classCompare !== 0
        ) {

          return classCompare;

        }


        return String(
          a.admissionNo
        ).localeCompare(
          String(
            b.admissionNo
          ),
          undefined,
          {
            numeric: true,
          }
        );

      }
    );


    /* ========================================================
       SUMMARY
    ======================================================== */

    const totalPendingAmount =
      result.reduce(
        (
          sum,
          student
        ) =>
          sum +
          Number(
            student.pendingAmount
          ),
        0
      );


    const totalPayableAmount =
      result.reduce(
        (
          sum,
          student
        ) =>
          sum +
          Number(
            student.totalFee
          ),
        0
      );


    /* ========================================================
       CLASS SUMMARY
    ======================================================== */

    const classSummaryMap =
      new Map<
        string,
        {
          classNumber: string;
          studentCount: number;
          pendingAmount: number;
        }
      >();


    result.forEach(
      (student) => {

        const key =
          String(
            student.classNumber
          );


        const existing =
          classSummaryMap.get(
            key
          );


        if (existing) {

          existing.studentCount +=
            1;

          existing.pendingAmount +=
            Number(
              student.pendingAmount
            );

        } else {

          classSummaryMap.set(
            key,
            {
              classNumber:
                key,

              studentCount:
                1,

              pendingAmount:
                Number(
                  student.pendingAmount
                ),
            }
          );

        }

      }
    );


    const classSummary =
      Array.from(
        classSummaryMap.values()
      );


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      filters: {

        classNumber:
          classNumber ??
          null,

        percentage,

      },

      summary: {

        totalStudents:
          result.length,

        totalPendingAmount,

        totalPayableAmount,

        totalClasses:
          classSummary.length,

      },

      classSummary,

      students:
        result,

    });

  } catch (
    error
  ) {

    return handleErr(
      error,
      res
    );

  }
};



/* ============================================================
   GET MONTH / DATE TRANSACTION REPORT
============================================================ */

const getMonthOrDateReport = async (
  req: RequestWithBody<GetMonthOrDateReportRequest>,
  res: Response<TxnResponse[]>
) => {
  try {
    const {
      classNumber,
      month,
      date,
      year,
    } = req.body;

    /* --------------------------------------------------------
       VALIDATE REQUEST
    -------------------------------------------------------- */

    if (
      !classNumber ||
      !year ||
      (!month && !date)
    ) {
      return res.status(400).json({
        message:
          "Request body is missing some params",
      });
    }

    /* --------------------------------------------------------
       SCHOOL
    -------------------------------------------------------- */

    const schoolId =
      getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message:
          "schoolId is required",
      });
    }

    /* --------------------------------------------------------
       DATE FILTER
    -------------------------------------------------------- */

    const dates =
      getMonthOrDateFilter(
        date ?? "",
        month ?? "",
        year
      );

    /* --------------------------------------------------------
       FIND TRANSACTIONS
    -------------------------------------------------------- */

    const txns =
      await prisma.transaction.findMany({
        where: {
          schoolId,

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

    /* --------------------------------------------------------
       MAP RESPONSE
       
       New Transaction schema:

       recordedByUserId
       receiptNumber

       Old adminId is no longer returned.
    -------------------------------------------------------- */

    const response: TxnResponse[] =
      txns.map((txn) => ({
        id: txn.id,

        date: txn.date,

        classNumber:
          txn.classNumber,

        pendingAmount:
          txn.pendingAmount,

        paymentMode:
          txn.paymentMode,

        amount:
          txn.amount,

        amountDetails: {
          tie:
            txn.tieAmount,

          diary:
            txn.diaryAmount,

          belt:
            txn.beltAmount,

          arrears:
            txn.arrearsAmount,

          tuitionFee:
            txn.tuitionFeeAmount,

          textBookFee:
            txn.textBookFeeAmount,

          noteBookFee:
            txn.noteBookFeeAmount,
        },

        student:
          txn.student as any,

        transactionId:
          txn.transactionId ??
          undefined,

        receiptNumber:
          txn.receiptNumber,

        recordedByUserId:
          txn.recordedByUserId,
      }));

    return res.status(200).json(
      response
    );
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

/* ============================================================
   GET STUDENT MONTH / DATE TRANSACTION REPORT
============================================================ */

const getStudentMonthOrDateReport =
  async (
    req: RequestWithBody<GetStudentMonthOrDateReportRequest>,
    res: Response<TxnResponse[]>
  ) => {
    try {
      const {
        admissionNo,
        month,
        date,
        year,
      } = req.body;

      /* ------------------------------------------------------
         VALIDATE REQUEST
      ------------------------------------------------------ */

      if (
        !admissionNo ||
        !year ||
        (!month && !date)
      ) {
        return res.status(400).json({
          message:
            "Request body is missing some params",
        });
      }

      /* ------------------------------------------------------
         SCHOOL
      ------------------------------------------------------ */

      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }

      /* ------------------------------------------------------
         FIND STUDENT
         
         admissionNo is unique only inside a school.
      ------------------------------------------------------ */

      const student =
        await prisma.student.findUnique({
          where: {
            schoolId_admissionNo: {
              schoolId,
              admissionNo,
            },
          },
        });

      if (!student) {
        return res.status(404).json({
          message:
            "Student not found",
        });
      }

      /* ------------------------------------------------------
         DATE FILTER
      ------------------------------------------------------ */

      const dates =
        getMonthOrDateFilter(
          date ?? "",
          month ?? "",
          year
        );

      /* ------------------------------------------------------
         FIND TRANSACTIONS
         
         IMPORTANT:
         Use studentId rather than classNumber.

         This preserves historical transactions
         after promotion/demotion.
      ------------------------------------------------------ */

      const txns =
        await prisma.transaction.findMany({
          where: {
            schoolId,

            studentId:
              student.id,

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

      /* ------------------------------------------------------
         MAP RESPONSE
      ------------------------------------------------------ */

      const response: TxnResponse[] =
        txns.map((txn) => ({
          id: txn.id,

          date: txn.date,

          classNumber:
            txn.classNumber,

          pendingAmount:
            txn.pendingAmount,

          paymentMode:
            txn.paymentMode,

          amount:
            txn.amount,

          amountDetails: {
            tie:
              txn.tieAmount,

            diary:
              txn.diaryAmount,

            belt:
              txn.beltAmount,

            arrears:
              txn.arrearsAmount,

            tuitionFee:
              txn.tuitionFeeAmount,

            textBookFee:
              txn.textBookFeeAmount,

            noteBookFee:
              txn.noteBookFeeAmount,
          },

          student:
            txn.student as any,

          transactionId:
            txn.transactionId ??
            undefined,

          receiptNumber:
            txn.receiptNumber,

          recordedByUserId:
            txn.recordedByUserId,
        }));

      return res.status(200).json(
        response
      );
    } catch (error) {
      return handleErr(
        error,
        res
      );
    }
  };

/* ============================================================
   EXPORT
============================================================ */

export const reportControllers = {
  getPercUnpaidStudents,
  getMonthOrDateReport,
  getStudentMonthOrDateReport,
  getPendingDues,
};