"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentcontrollers = void 0;
const config_1 = require("../config");
const types_1 = require("../types");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return (req.user?.schoolId ??
        req.body?.schoolId ??
        req.query?.schoolId);
};
const calculatePendingAmountSync = ({ student, classDetails, coupon, alreadyPaid = 0, }) => {
    const { tuitionFee, textBookFee, noteBookFee, diaryFee, } = classDetails;
    const tieAmount = Number(student?.tie?.amount ?? 0);
    const beltAmount = Number(student?.belt?.amount ?? 0);
    const arrearsAmount = Number(student?.arrears?.amount ?? 0);
    return `${Number(tuitionFee) +
        Number(textBookFee) +
        Number(noteBookFee) +
        Number(diaryFee) +
        tieAmount +
        beltAmount +
        arrearsAmount -
        Number(coupon?.discount ?? 0) -
        alreadyPaid}`;
};
const getPendingAmountAsync = async (student, classDetails, coupon) => {
    if (!student.id) {
        return calculatePendingAmountSync({
            student,
            classDetails,
            coupon,
            alreadyPaid: 0,
        });
    }
    const transactions = await config_1.prisma.transaction.findMany({
        where: {
            studentId: student.id,
            schoolId: classDetails.schoolId,
        },
    });
    let alreadyPaid = 0;
    transactions.forEach((transaction) => {
        alreadyPaid += Number(transaction.amount);
    });
    return calculatePendingAmountSync({
        student,
        classDetails,
        coupon,
        alreadyPaid,
    });
};
const getUpdatedIndividualPendingAmount = ({ oldPendingAmount, oldAmount, newAmount, }) => {
    const newPendingAmount = Number(oldPendingAmount) +
        Number(newAmount) -
        Number(oldAmount);
    return newPendingAmount >= 0
        ? `${newPendingAmount}`
        : "0";
};
const createSiblingsArray = (siblings) => {
    return siblings.map((sibling) => ({
        name: sibling.name,
        admissionNo: sibling.admissionNo,
    }));
};
const parseSiblings = (siblings) => {
    if (!Array.isArray(siblings)) {
        return [];
    }
    return siblings;
};
/* ============================================================
   CREATE STUDENT
============================================================ */
const createStudent = async (req, res) => {
    const { admissionNo, name, aadhaar, fatherName, dob, doj, phone, classNumber, academicYearId, tie, belt, arrears, couponCode, siblingStudentsFromDb, } = req.body;
    const schoolId = getSchoolId(req);
    if (!admissionNo ||
        !name ||
        !aadhaar ||
        !fatherName ||
        !dob ||
        !doj ||
        !phone ||
        !classNumber ||
        !academicYearId ||
        !tie ||
        !belt ||
        !arrears ||
        !schoolId) {
        return res.status(400).json({
            message: "schoolId, admissionNo, name, aadhaar, fatherName, dob, doj, phone, classNumber, academicYearId, tie, belt and arrears are required",
        });
    }
    try {
        /* --------------------------------------------------------
           FIND CLASS
        -------------------------------------------------------- */
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId,
                academicYearId,
                classNumber,
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist.",
            });
        }
        /* --------------------------------------------------------
           CHECK ADMISSION NUMBER
        -------------------------------------------------------- */
        const existingStudent = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo,
                },
            },
        });
        if (existingStudent) {
            return res.status(409).json({
                message: "Student with this admission number already exists",
            });
        }
        /* --------------------------------------------------------
           COUPON
        -------------------------------------------------------- */
        let coupon = null;
        if (couponCode) {
            coupon = await config_1.prisma.coupon.findUnique({
                where: {
                    schoolId_code: {
                        schoolId,
                        code: couponCode,
                    },
                },
            });
            if (!coupon) {
                return res.status(400).json({
                    message: "Coupon doesn't exist.",
                });
            }
            if (coupon.status !== types_1.CouponStatus.ACTIVE) {
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
        /* --------------------------------------------------------
           SIBLINGS
        -------------------------------------------------------- */
        const siblingsFromDb = siblingStudentsFromDb ??
            req.body.siblingStudentsFromDb ??
            [];
        const formattedSiblingArray = createSiblingsArray(siblingsFromDb);
        /* --------------------------------------------------------
           PENDING AMOUNTS
        -------------------------------------------------------- */
        const studentForCalculation = {
            tie,
            belt,
            arrears,
        };
        const pendingAmount = calculatePendingAmountSync({
            student: studentForCalculation,
            classDetails,
            coupon,
        });
        /* --------------------------------------------------------
           CREATE STUDENT
        -------------------------------------------------------- */
        const student = await config_1.prisma.$transaction(async (tx) => {
            if (coupon) {
                await tx.coupon.update({
                    where: {
                        id: coupon.id,
                    },
                    data: {
                        status: types_1.CouponStatus.APPLIED,
                    },
                });
            }
            return tx.student.create({
                data: {
                    schoolId,
                    admissionNo,
                    name,
                    aadhaar,
                    fatherName,
                    dob,
                    doj,
                    phone,
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
                    pendingDiaryAmount: classDetails.diaryFee,
                    siblings: formattedSiblingArray,
                    couponId: coupon?.id ?? null,
                    pendingAmount,
                    createdByAdminId: req.user?.id ?? null,
                },
            });
        });
        return res.status(201).json({
            message: "Student created successfully",
            id: student.id,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET STUDENTS BY CLASS
============================================================ */
const getStudentsByClass = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const { classNumber, academicYearId, } = req.body;
        if (!schoolId || !classNumber) {
            return res.status(400).json({
                message: "schoolId and classNumber are required",
            });
        }
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId,
                classNumber,
                ...(academicYearId
                    ? { academicYearId }
                    : {}),
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist",
            });
        }
        const students = await config_1.prisma.student.findMany({
            where: {
                schoolId,
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
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET STUDENT BY COUPON
============================================================ */
const getStudentByCoupon = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const coupon = await config_1.prisma.coupon.findUnique({
            where: {
                schoolId_code: {
                    schoolId,
                    code: req.body.code,
                },
            },
        });
        if (!coupon) {
            return res.status(400).json({
                message: "Coupon doesn't exist",
            });
        }
        const student = await config_1.prisma.student.findFirst({
            where: {
                schoolId,
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
            phone: student.phone,
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
            siblings: parseSiblings(student.siblings),
            pendingTuitionFee: student.pendingTuitionFee,
            pendingNotebookFee: student.pendingNotebookFee,
            pendingTextbookFee: student.pendingTextbookFee,
            pendingDiaryAmount: student.pendingDiaryAmount,
            schoolId: student.schoolId,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET STUDENT
============================================================ */
const getStudent = async (req, res) => {
    if (!req.body.admissionNo) {
        return res.status(400).json({
            message: "Admission number missing in request body",
        });
    }
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const student = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo: req.body.admissionNo,
                },
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
            phone: student.phone,
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
            siblings: parseSiblings(student.siblings),
            pendingTuitionFee: student.pendingTuitionFee,
            pendingNotebookFee: student.pendingNotebookFee,
            pendingTextbookFee: student.pendingTextbookFee,
            pendingDiaryAmount: student.pendingDiaryAmount,
            schoolId: student.schoolId,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EDIT STUDENT
============================================================ */
const editStudent = async (req, res) => {
    const { admissionNo, name, aadhaar, fatherName, dob, doj, phone, classNumber, academicYearId, tie, belt, arrears, couponCode, oldAdmissionNo, } = req.body;
    const schoolId = getSchoolId(req);
    if (!schoolId ||
        !admissionNo ||
        !name ||
        !aadhaar ||
        !fatherName ||
        !dob ||
        !doj ||
        !phone ||
        !classNumber ||
        !academicYearId ||
        !tie ||
        !belt ||
        !arrears ||
        !oldAdmissionNo) {
        return res.status(400).json({
            message: "Some fields are missing in request body",
        });
    }
    try {
        const oldStudent = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo: oldAdmissionNo,
                },
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
        if (oldAdmissionNo !== admissionNo) {
            return res.status(400).json({
                message: "Cannot change admission number",
            });
        }
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId,
                academicYearId,
                classNumber,
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist.",
            });
        }
        let coupon = oldStudent.coupon;
        if (couponCode &&
            !oldStudent.couponId) {
            coupon =
                await config_1.prisma.coupon.findUnique({
                    where: {
                        schoolId_code: {
                            schoolId,
                            code: couponCode,
                        },
                    },
                });
            if (!coupon) {
                return res.status(400).json({
                    message: "Coupon doesn't exist.",
                });
            }
            if (coupon.status !==
                types_1.CouponStatus.ACTIVE) {
                return res.status(400).json({
                    message: "Coupon is not active",
                });
            }
            if (coupon.classId !==
                classDetails.id) {
                return res.status(400).json({
                    message: "Coupon code invalid for this class",
                });
            }
        }
        const isNewClass = classNumber !==
            oldStudent.class.classNumber;
        const newArrears = isNewClass
            ? oldStudent.pendingAmount
            : arrears.amount;
        const formattedFees = {
            tieAmount: tie.amount,
            tiePendingAmount: getUpdatedIndividualPendingAmount({
                oldPendingAmount: oldStudent.tiePendingAmount,
                oldAmount: oldStudent.tieAmount,
                newAmount: tie.amount,
            }),
            beltAmount: belt.amount,
            beltPendingAmount: getUpdatedIndividualPendingAmount({
                oldPendingAmount: oldStudent.beltPendingAmount,
                oldAmount: oldStudent.beltAmount,
                newAmount: belt.amount,
            }),
            arrearsAmount: newArrears,
            arrearsPendingAmount: isNewClass
                ? newArrears
                : getUpdatedIndividualPendingAmount({
                    oldPendingAmount: oldStudent.arrearsPendingAmount,
                    oldAmount: oldStudent.arrearsAmount,
                    newAmount: arrears.amount,
                }),
            pendingTuitionFee: isNewClass
                ? classDetails.tuitionFee
                : getUpdatedIndividualPendingAmount({
                    oldPendingAmount: oldStudent.pendingTuitionFee,
                    oldAmount: oldStudent.class.tuitionFee,
                    newAmount: classDetails.tuitionFee,
                }),
            pendingTextbookFee: isNewClass
                ? classDetails.textBookFee
                : getUpdatedIndividualPendingAmount({
                    oldPendingAmount: oldStudent.pendingTextbookFee,
                    oldAmount: oldStudent.class.textBookFee,
                    newAmount: classDetails.textBookFee,
                }),
            pendingNotebookFee: isNewClass
                ? classDetails.noteBookFee
                : getUpdatedIndividualPendingAmount({
                    oldPendingAmount: oldStudent.pendingNotebookFee,
                    oldAmount: oldStudent.class.noteBookFee,
                    newAmount: classDetails.noteBookFee,
                }),
            pendingDiaryAmount: isNewClass
                ? classDetails.diaryFee
                : getUpdatedIndividualPendingAmount({
                    oldPendingAmount: oldStudent.pendingDiaryAmount,
                    oldAmount: oldStudent.class.diaryFee,
                    newAmount: classDetails.diaryFee,
                }),
        };
        const studentForCalculation = {
            id: oldStudent.id,
            tie: {
                amount: formattedFees.tieAmount,
            },
            belt: {
                amount: formattedFees.beltAmount,
            },
            arrears: {
                amount: formattedFees.arrearsAmount,
            },
        };
        const pendingAmount = await getPendingAmountAsync(studentForCalculation, classDetails, coupon);
        await config_1.prisma.$transaction(async (tx) => {
            if (coupon &&
                !oldStudent.couponId) {
                await tx.coupon.update({
                    where: {
                        id: coupon.id,
                    },
                    data: {
                        status: types_1.CouponStatus.APPLIED,
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
                    phone,
                    classId: classDetails.id,
                    couponId: coupon?.id ??
                        oldStudent.couponId,
                    siblings: createSiblingsArray(req.body
                        .siblingStudentsFromDb ??
                        []),
                    ...formattedFees,
                    pendingAmount,
                },
            });
        });
        return res.status(200).json({
            message: "Student details edited successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GROUP STUDENTS BY CLASS
============================================================ */
const groupStudentsByClassAndCount = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const groupedStudents = await config_1.prisma.student.groupBy({
            by: ["classId"],
            where: {
                schoolId,
            },
            _count: {
                id: true,
            },
        });
        const responseData = [];
        for (const group of groupedStudents) {
            const classDetails = await config_1.prisma.class.findFirst({
                where: {
                    id: group.classId,
                    schoolId,
                },
            });
            if (classDetails &&
                !classDetails.isCompleted) {
                responseData.push({
                    classNumber: classDetails.classNumber,
                    count: String(group._count.id),
                });
            }
        }
        responseData.sort((a, b) => Number(a.classNumber) -
            Number(b.classNumber));
        return res.status(200).json({
            countData: responseData,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   PROMOTE / DEMOTE STUDENTS
============================================================ */
const promoteDemote = async (req, res) => {
    const { fromClass, toClass, fromAcademicYearId, toAcademicYearId, } = req.body;
    const schoolId = getSchoolId(req);
    if (!schoolId ||
        !fromClass ||
        !toClass) {
        return res.status(400).json({
            message: "schoolId, fromClass and toClass are required",
        });
    }
    try {
        const fromClassDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId,
                classNumber: fromClass,
                ...(fromAcademicYearId
                    ? {
                        academicYearId: fromAcademicYearId,
                    }
                    : {}),
            },
        });
        if (!fromClassDetails) {
            return res.status(400).json({
                message: "Source class doesn't exist",
            });
        }
        const toClassDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId,
                classNumber: toClass,
                ...(toAcademicYearId
                    ? {
                        academicYearId: toAcademicYearId,
                    }
                    : {}),
            },
        });
        if (!toClassDetails) {
            return res.status(400).json({
                message: "Target class doesn't exist",
            });
        }
        const studentInTargetClass = await config_1.prisma.student.findFirst({
            where: {
                schoolId,
                classId: toClassDetails.id,
            },
        });
        if (studentInTargetClass) {
            return res.status(400).json({
                message: "Target class has students already",
            });
        }
        const students = await config_1.prisma.student.findMany({
            where: {
                schoolId,
                classId: fromClassDetails.id,
            },
            include: {
                coupon: true,
            },
        });
        await config_1.prisma.$transaction(students.map((student) => {
            const studentData = {
                tie: {
                    amount: student.tieAmount,
                },
                belt: {
                    amount: student.beltAmount,
                },
                arrears: {
                    amount: student.pendingAmount,
                },
            };
            const newPendingAmount = calculatePendingAmountSync({
                student: studentData,
                classDetails: toClassDetails,
                coupon: student.coupon,
            });
            return config_1.prisma.student.update({
                where: {
                    id: student.id,
                },
                data: {
                    classId: toClassDetails.id,
                    pendingTuitionFee: toClassDetails.tuitionFee,
                    pendingTextbookFee: toClassDetails.textBookFee,
                    pendingNotebookFee: toClassDetails.noteBookFee,
                    pendingDiaryAmount: toClassDetails.diaryFee,
                    arrearsAmount: student.pendingAmount,
                    arrearsPendingAmount: student.pendingAmount,
                    pendingAmount: newPendingAmount,
                },
            });
        }));
        return res.status(200).json({
            message: "Class moved successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORTS
============================================================ */
exports.studentcontrollers = {
    createStudent,
    getStudentsByClass,
    getStudentByCoupon,
    getStudent,
    editStudent,
    groupStudentsByClassAndCount,
    promoteDemote,
};
