import { prisma } from "../config";

import {
  RequestWithBody,
  CreateStudentRequest,
  Response,
  CouponStatus,
  GetClassStudentsRequest,
  GetClassStudentsResponse,
  GetStudentRequest,
  GetStudentResponse,
  GetStudentByCoupon,
  EditStudentRequest,
  Request,
  ClassStudentCountResponse,
  PromoteDemoteRequest,
  StudentType,
  ClassType,
  CouponType,
  Sibling,
} from "../types";

import { handleErr } from "../utils";

/* ============================================================
   HELPERS
============================================================ */

const calculatePendingAmountSync = ({
  student,
  classDetails,
  coupon,
  alreadyPaid = 0,
}: {
  student: any;
  classDetails: any;
  coupon: any;
  alreadyPaid?: number;
}) => {
  const { tuitionFee, textBookFee, noteBookFee, diary } = classDetails;

  const { tie, belt, arrears } = student;

  return `${
    Number(tuitionFee) +
    Number(textBookFee) +
    Number(noteBookFee) +
    Number(diary) +
    Number(tie.amount) +
    Number(belt.amount) +
    Number(arrears.amount) -
    Number(coupon?.discount ?? 0) -
    alreadyPaid
  }`;
};

const getPendingAmountAsync = async (
  student: any,
  classDetails: any,
  coupon: any
) => {
  if (!student.id) {
    return calculatePendingAmountSync({
      student,
      classDetails,
      coupon,
      alreadyPaid: 0,
    });
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      studentId: student.id,
      classNumber: classDetails.classNumber,
    },
  });

  let alreadyPaid = 0;

  transactions.forEach((transaction: any) => {
    alreadyPaid += Number(transaction.amount);
  });

  return calculatePendingAmountSync({
    student,
    classDetails,
    coupon,
    alreadyPaid,
  });
};

const getUpdatedIndividualPendingAmount = ({
  oldPendingAmount,
  oldAmount,
  newAmount,
}: {
  oldPendingAmount: string;
  oldAmount: string;
  newAmount: string;
}) => {
  const newPendingAmount =
    Number(oldPendingAmount) +
    Number(newAmount) -
    Number(oldAmount);

  return newPendingAmount >= 0
    ? `${newPendingAmount}`
    : "0";
};

const createSiblingsArray = (siblings: any[]) => {
  return siblings.map((sibling) => ({
    name: sibling.name,
    admissionNo: sibling.admissionNo,
  }));
};

const parseSiblings = (siblings: unknown): Sibling[] => {
  if (!Array.isArray(siblings)) {
    return [];
  }
  return siblings as Sibling[];
};


/* ============================================================
   CREATE STUDENT
============================================================ */

const createStudent = async (
  req: RequestWithBody<CreateStudentRequest>,
  res: Response
) => {
  const {
    admissionNo,
    name,
    aadhaar,
    fatherName,
    dob,
    doj,
    phoneNo,
    classNumber,
    tie,
    belt,
    arrears,
    couponCode,
    siblings,
    adminId,
  } = req.body;

  if (
    !admissionNo ||
    !name ||
    !aadhaar ||
    !fatherName ||
    !dob ||
    !doj ||
    !phoneNo ||
    !classNumber ||
    !tie ||
    !belt ||
    !arrears ||
    !siblings ||
    !adminId
  ) {
    return res.status(400).json({
      message: "Some fields are missing in request body",
    });
  }

  try {
    const classDetails = await prisma.class.findUnique({
      where: {
        classNumber,
      },
    });

    if (!classDetails) {
      return res.status(400).json({
        message: "Class doesn't exist.",
      });
    }

    let coupon: any = null;

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({
        where: {
          code: couponCode,
        },
      });

      if (!coupon) {
        return res.status(400).json({
          message: "Coupon doesn't exist.",
        });
      }

      if (coupon.status !== CouponStatus.ACTIVE) {
        return res.status(400).json({
          message: "Coupon is not active",
        });
      }

      if (coupon.classId !== classDetails.id) {
        return res.status(400).json({
          message: "Coupon code invalid for this class",
        });
      }
    }

    const siblingsFromDb =
      req.body.siblingStudentsFromDb ?? [];

    const formattedSiblingArray =
      createSiblingsArray(siblingsFromDb);

    const studentData: any = {
      admissionNo,
      name,
      aadhaar,
      fatherName,
      dob,
      doj,
      phoneNo,

      classId: classDetails.id,

      tieAmount: tie.amount,
      tiePendingAmount: tie.pendingAmount,

      beltAmount: belt.amount,
      beltPendingAmount: belt.pendingAmount,

      arrearsAmount: arrears.amount,
      arrearsPendingAmount: arrears.pendingAmount,

      pendingTuitionFee: classDetails.tuitionFee,
      pendingTextbookFee: classDetails.textBookFee,
      pendingNotebookFee: classDetails.noteBookFee,
      pendingDiaryAmount: classDetails.diary,

      adminId,

      siblings: formattedSiblingArray,

      couponId: coupon ? coupon.id : null,
    };

    const pendingAmount =
      calculatePendingAmountSync({
        student: {
          tie,
          belt,
          arrears,
        },
        classDetails,
        coupon,
      });

    const student = await prisma.$transaction(
      async (tx) => {

        if (coupon) {
          await tx.coupon.update({
            where: {
              id: coupon.id,
            },
            data: {
              status: CouponStatus.APPLIED,
            },
          });
        }

        return tx.student.create({
          data: {
            ...studentData,
            pendingAmount,
          },
        });
      }
    );

    return res.status(200).json({
      message: "Student created successfully",
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   GET STUDENTS BY CLASS
============================================================ */

const getStudentsByClass = async (
  req: RequestWithBody<GetClassStudentsRequest>,
  res: Response<GetClassStudentsResponse>
) => {
  try {
    const classDetails =
      await prisma.class.findUnique({
        where: {
          classNumber: req.body.classNumber,
        },
      });

    if (!classDetails) {
      return res.status(400).json({
        message: "Class doesn't exist",
      });
    }

    const students =
      await prisma.student.findMany({
        where: {
          classId: classDetails.id,
        },
        select: {
          admissionNo: true,
          name: true,
        },
        orderBy: {
          admissionNo: "asc",
        },
      });

    return res.status(200).json({
      students,
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   GET STUDENT BY COUPON
============================================================ */

const getStudentByCoupon = async (
  req: RequestWithBody<GetStudentByCoupon>,
  res: Response<GetStudentResponse>
) => {
  try {
    const coupon =
      await prisma.coupon.findUnique({
        where: {
          code: req.body.code,
        },
      });

    if (!coupon) {
      return res.status(400).json({
        message: "Coupon doesn't exist",
      });
    }

    const student =
      await prisma.student.findFirst({
        where: {
          couponId: coupon.id,
        },
        include: {
          class: true,
          coupon: true,
        },
      });

    if (!student) {
      return res.status(400).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      admissionNo: student.admissionNo,
      name: student.name,
      aadhaar: student.aadhaar,
      fatherName: student.fatherName,
      dob: student.dob,
      doj: student.doj,
      phoneNo: student.phoneNo,

      classNumber: student.class.classNumber,

      tie: {
        amount: student.tieAmount,
        pendingAmount: student.tiePendingAmount,
      },

      belt: {
        amount: student.beltAmount,
        pendingAmount: student.beltPendingAmount,
      },

      arrears: {
        amount: student.arrearsAmount,
        pendingAmount: student.arrearsPendingAmount,
      },

      pendingAmount: student.pendingAmount,

      couponCode: student.coupon?.code,

      tcNo: student.tcNo ?? undefined,

      siblings: parseSiblings(student.siblings),

      pendingTuitionFee:
        student.pendingTuitionFee,

      pendingNotebookFee:
        student.pendingNotebookFee,

      pendingTextbookFee:
        student.pendingTextbookFee,

      pendingDiaryAmount:
        student.pendingDiaryAmount,

      adminId: student.adminId,
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   GET STUDENT
============================================================ */

const getStudent = async (
  req: RequestWithBody<GetStudentRequest>,
  res: Response<GetStudentResponse>
) => {
  if (!req.body.admissionNo) {
    return res.status(400).json({
      message:
        "Admission number missing in request body",
    });
  }

  try {
    const student =
      await prisma.student.findUnique({
        where: {
          admissionNo:
            req.body.admissionNo,
        },
        include: {
          class: true,
          coupon: true,
        },
      });

    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    return res.status(200).json({
      admissionNo: student.admissionNo,
      name: student.name,
      aadhaar: student.aadhaar,
      fatherName: student.fatherName,
      dob: student.dob,
      doj: student.doj,
      phoneNo: student.phoneNo,

      classNumber: student.class.classNumber,

      tie: {
        amount: student.tieAmount,
        pendingAmount:
          student.tiePendingAmount,
      },

      belt: {
        amount: student.beltAmount,
        pendingAmount:
          student.beltPendingAmount,
      },

      arrears: {
        amount: student.arrearsAmount,
        pendingAmount:
          student.arrearsPendingAmount,
      },

      pendingAmount:
        student.pendingAmount,

      couponCode:
        student.coupon?.code,

      tcNo: student.tcNo ?? undefined,

      siblings:
        parseSiblings(student.siblings),

      pendingTuitionFee:
        student.pendingTuitionFee,

      pendingNotebookFee:
        student.pendingNotebookFee,

      pendingTextbookFee:
        student.pendingTextbookFee,

      pendingDiaryAmount:
        student.pendingDiaryAmount,

      adminId:
        student.adminId,
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   EDIT STUDENT
============================================================ */

const editStudent = async (
  req: RequestWithBody<EditStudentRequest>,
  res: Response
) => {
  const {
    admissionNo,
    name,
    aadhaar,
    fatherName,
    dob,
    doj,
    phoneNo,
    classNumber,
    tie,
    belt,
    arrears,
    couponCode,
    oldAdmissionNo,
    siblings,
  } = req.body;

  if (
    !admissionNo ||
    !name ||
    !aadhaar ||
    !fatherName ||
    !dob ||
    !doj ||
    !phoneNo ||
    !classNumber ||
    !tie ||
    !belt ||
    !arrears ||
    !siblings ||
    !oldAdmissionNo
  ) {
    return res.status(400).json({
      message:
        "Some fields are missing in request body",
    });
  }

  try {
    const oldStudent =
      await prisma.student.findUnique({
        where: {
          admissionNo,
        },
        include: {
          class: true,
          coupon: true,
        },
      });

    if (!oldStudent) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    if (
      oldAdmissionNo !== admissionNo
    ) {
      return res.status(400).json({
        message:
          "Cannot change admission number",
      });
    }

    const classDetails =
      await prisma.class.findUnique({
        where: {
          classNumber,
        },
      });

    if (!classDetails) {
      return res.status(400).json({
        message:
          "Class doesn't exist.",
      });
    }

    let coupon: any =
      oldStudent.coupon;

    if (
      couponCode &&
      !oldStudent.couponId
    ) {
      coupon =
        await prisma.coupon.findUnique({
          where: {
            code: couponCode,
          },
        });

      if (!coupon) {
        return res.status(400).json({
          message:
            "Coupon doesn't exist.",
        });
      }

      if (
        coupon.status !==
        CouponStatus.ACTIVE
      ) {
        return res.status(400).json({
          message:
            "Coupon is not active",
        });
      }

      if (
        coupon.classId !==
        classDetails.id
      ) {
        return res.status(400).json({
          message:
            "Coupon code invalid for this class",
        });
      }
    }

    const isNewClass =
      classNumber !==
      oldStudent.class.classNumber;

    const newArrears =
      isNewClass
        ? oldStudent.pendingAmount
        : arrears.amount;

    const formattedFees = {

      tieAmount: tie.amount,

      tiePendingAmount:
        getUpdatedIndividualPendingAmount({
          oldPendingAmount:
            oldStudent.tiePendingAmount,
          oldAmount:
            oldStudent.tieAmount,
          newAmount:
            tie.amount,
        }),

      beltAmount:
        belt.amount,

      beltPendingAmount:
        getUpdatedIndividualPendingAmount({
          oldPendingAmount:
            oldStudent.beltPendingAmount,
          oldAmount:
            oldStudent.beltAmount,
          newAmount:
            belt.amount,
        }),

      arrearsAmount:
        newArrears,

      arrearsPendingAmount:
        isNewClass
          ? newArrears
          : getUpdatedIndividualPendingAmount({
              oldPendingAmount:
                oldStudent.arrearsPendingAmount,
              oldAmount:
                oldStudent.arrearsAmount,
              newAmount:
                arrears.amount,
            }),

      pendingTuitionFee:
        isNewClass
          ? classDetails.tuitionFee
          : getUpdatedIndividualPendingAmount({
              oldPendingAmount:
                oldStudent.pendingTuitionFee,
              oldAmount:
                oldStudent.class.tuitionFee,
              newAmount:
                classDetails.tuitionFee,
            }),

      pendingTextbookFee:
        isNewClass
          ? classDetails.textBookFee
          : getUpdatedIndividualPendingAmount({
              oldPendingAmount:
                oldStudent.pendingTextbookFee,
              oldAmount:
                oldStudent.class.textBookFee,
              newAmount:
                classDetails.textBookFee,
            }),

      pendingNotebookFee:
        isNewClass
          ? classDetails.noteBookFee
          : getUpdatedIndividualPendingAmount({
              oldPendingAmount:
                oldStudent.pendingNotebookFee,
              oldAmount:
                oldStudent.class.noteBookFee,
              newAmount:
                classDetails.noteBookFee,
            }),

      pendingDiaryAmount:
        isNewClass
          ? classDetails.diary
          : getUpdatedIndividualPendingAmount({
              oldPendingAmount:
                oldStudent.pendingDiaryAmount,
              oldAmount:
                oldStudent.class.diary,
              newAmount:
                classDetails.diary,
            }),
    };

    const studentForCalculation: any = {
      id: oldStudent.id,

      tie: {
        amount:
          formattedFees.tieAmount,
      },

      belt: {
        amount:
          formattedFees.beltAmount,
      },

      arrears: {
        amount:
          formattedFees.arrearsAmount,
      },
    };

    const pendingAmount =
      await getPendingAmountAsync(
        studentForCalculation,
        classDetails,
        coupon
      );

    await prisma.$transaction(
      async (tx) => {

        if (
          coupon &&
          !oldStudent.couponId
        ) {
          await tx.coupon.update({
            where: {
              id: coupon.id,
            },
            data: {
              status:
                CouponStatus.APPLIED,
            },
          });
        }

        await tx.student.update({
          where: {
            id: oldStudent.id,
          },

          data: {
            name,
            aadhaar,
            fatherName,
            dob,
            doj,
            phoneNo,

            classId:
              classDetails.id,

            couponId:
              coupon
                ? coupon.id
                : oldStudent.couponId,

            siblings:
              createSiblingsArray(
                req.body
                  .siblingStudentsFromDb ??
                  []
              ),

            ...formattedFees,

            pendingAmount,
          },
        });
      }
    );

    return res.status(200).json({
      message:
        "Student details edited successfully",
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   GROUP STUDENTS BY CLASS
============================================================ */

const groupStudentsByClassAndCount = async (
  req: Request,
  res: Response<ClassStudentCountResponse>
) => {
  try {
    const groupedStudents =
      await prisma.student.groupBy({
        by: ["classId"],
        _count: {
          id: true,
        },
      });

    const responseData: {
      classNumber: string;
      count: string;
    }[] = [];

    for (const group of groupedStudents) {
      const classDetails =
        await prisma.class.findUnique({
          where: {
            id: group.classId,
          },
        });

      if (
        classDetails &&
        !classDetails.classNumber.includes(
          "COMPLETED"
        )
      ) {
        responseData.push({
          classNumber:
            classDetails.classNumber,

          count:
            String(
              group._count.id
            ),
        });
      }
    }

    responseData.sort(
      (a, b) =>
        Number(a.classNumber) -
        Number(b.classNumber)
    );

    return res.status(200).json({
      countData: responseData,
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   PROMOTE / DEMOTE STUDENTS
============================================================ */

const promoteDemote = async (
  req: RequestWithBody<PromoteDemoteRequest>,
  res: Response
) => {
  const {
    fromClass,
    toClass,
  } = req.body;

  if (!fromClass || !toClass) {
    return res.status(400).json({
      message:
        "Request body is missing some params",
    });
  }

  try {
    const fromClassDetails =
      await prisma.class.findUnique({
        where: {
          classNumber:
            fromClass,
        },
      });

    if (!fromClassDetails) {
      return res.status(400).json({
        message:
          "Source class doesn't exist",
      });
    }

    const toClassDetails =
      await prisma.class.findUnique({
        where: {
          classNumber:
            toClass,
        },
      });

    if (!toClassDetails) {
      return res.status(400).json({
        message:
          "Target class doesn't exist",
      });
    }

    const studentInTargetClass =
      await prisma.student.findFirst({
        where: {
          classId:
            toClassDetails.id,
        },
      });

    if (studentInTargetClass) {
      return res.status(400).json({
        message:
          "Target class has students already",
      });
    }

    const students =
      await prisma.student.findMany({
        where: {
          classId:
            fromClassDetails.id,
        },
        include: {
          coupon: true,
        },
      });

    await prisma.$transaction(
      students.map((student) => {

        const studentData: any = {
          tie: {
            amount:
              student.tieAmount,
          },

          belt: {
            amount:
              student.beltAmount,
          },

          arrears: {
            amount:
              student.pendingAmount,
          },
        };

        const newPendingAmount =
          calculatePendingAmountSync({
            student:
              studentData,

            classDetails:
              toClassDetails,

            coupon:
              student.coupon,
          });

        return prisma.student.update({
          where: {
            id:
              student.id,
          },

          data: {
            classId:
              toClassDetails.id,

            pendingTuitionFee:
              toClassDetails.tuitionFee,

            pendingTextbookFee:
              toClassDetails.textBookFee,

            pendingNotebookFee:
              toClassDetails.noteBookFee,

            pendingDiaryAmount:
              toClassDetails.diary,

            arrearsAmount:
              student.pendingAmount,

            arrearsPendingAmount:
              student.pendingAmount,

            pendingAmount:
              newPendingAmount,
          },
        });
      })
    );

    return res.status(200).json({
      message:
        "Class moved successfully",
    });

  } catch (err) {
    return handleErr(err as any, res);
  }
};


/* ============================================================
   EXPORTS
============================================================ */

export const studentcontrollers = {
  createStudent,
  getStudentsByClass,
  getStudentByCoupon,
  getStudent,
  editStudent,
  groupStudentsByClassAndCount,
  promoteDemote,
};