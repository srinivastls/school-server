"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentcontrollers = void 0;
const config_1 = require("../config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const client_1 = require("@prisma/client");
const types_1 = require("../types");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
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
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return (req.user?.schoolId ??
        req.body?.schoolId ??
        req.query?.schoolId);
};
/* ============================================================
   PARENT INTERNAL EMAIL
   ------------------------------------------------------------
   User.email is required in the current schema.

   Parent login will use phone number, but we still need
   an internal unique email value for the User record.
============================================================ */
/* ============================================================
   CREATE STUDENT
   ------------------------------------------------------------
   Creates:

   1. Student
   2. Parent User
   3. StudentParentLink

   Everything happens inside one transaction.
============================================================ */
const createStudent = async (req, res) => {
    const { 
    /* --------------------------------------------------------
       STUDENT
    -------------------------------------------------------- */
    admissionNo, name, aadhaar, fatherName, motherName, dob, doj, phone, 
    /* --------------------------------------------------------
       PARENT
    -------------------------------------------------------- */
    parentName, parentPhone, parentRelationship, 
    /* --------------------------------------------------------
       ACADEMIC
    -------------------------------------------------------- */
    classNumber, academicYearId, sectionName, 
    /* --------------------------------------------------------
       FEES
    -------------------------------------------------------- */
    tie, belt, arrears, 
    /* --------------------------------------------------------
       OTHER
    -------------------------------------------------------- */
    couponCode, siblingStudentsFromDb, } = req.body;
    /* ------------------------------------------------------------
       SCHOOL
       ------------------------------------------------------------ */
    const schoolId = getSchoolId(req);
    /* ============================================================
       VALIDATION
    ============================================================ */
    if (!schoolId ||
        !admissionNo ||
        !name ||
        !aadhaar ||
        !fatherName ||
        !dob ||
        !doj ||
        !phone ||
        !parentRelationship ||
        !classNumber ||
        !academicYearId ||
        !sectionName ||
        !tie ||
        !belt ||
        !arrears) {
        return res.status(400).json({
            message: "schoolId, admissionNo, name, aadhaar, fatherName, dob, doj, phone, parentRelationship, classNumber, academicYearId, sectionName, tie, belt and arrears are required",
        });
    }
    /* ============================================================
       VALIDATE PARENT RELATIONSHIP
    ============================================================ */
    if (![
        client_1.StudentParentRelationship.FATHER,
        client_1.StudentParentRelationship.MOTHER,
        client_1.StudentParentRelationship.GUARDIAN,
    ].includes(parentRelationship)) {
        return res.status(400).json({
            message: "parentRelationship must be FATHER, MOTHER or GUARDIAN",
        });
    }
    /* ============================================================
       NORMALIZE PARENT PHONE
    ============================================================ */
    const cleanParentPhone = String(phone ?? "").trim();
    if (!cleanParentPhone) {
        return res.status(400).json({
            message: "Parent mobile number is required",
        });
    }
    /* ============================================================
       TRY
    ============================================================ */
    try {
        /* ==========================================================
           FIND CLASS
        ========================================================== */
        const classDetails = await config_1.prisma.class.findUnique({
            where: {
                schoolId_academicYearId_classNumber: {
                    schoolId,
                    academicYearId,
                    classNumber,
                },
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist for the selected academic year.",
            });
        }
        /* ==========================================================
           FIND SECTION
        ========================================================== */
        const section = await config_1.prisma.section.findUnique({
            where: {
                schoolId_classId_sectionName: {
                    schoolId,
                    classId: classDetails.id,
                    sectionName,
                },
            },
        });
        if (!section) {
            return res.status(400).json({
                message: `Section ${sectionName} doesn't exist for class ${classNumber}.`,
            });
        }
        /* ==========================================================
           CHECK DUPLICATE ADMISSION NUMBER
        ========================================================== */
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
        /* ==========================================================
           COUPON
        ========================================================== */
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
        /* ==========================================================
           SIBLINGS
        ========================================================== */
        const siblingsFromDb = siblingStudentsFromDb ??
            req.body.siblingStudentsFromDb ??
            [];
        const formattedSiblingArray = createSiblingsArray(siblingsFromDb);
        /* ==========================================================
           PENDING AMOUNT
        ========================================================== */
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
        /* ==========================================================
           FIND EXISTING PARENT
           
           IMPORTANT:
           This is done BEFORE the transaction so we can also avoid
           bcrypt hashing while the transaction is open.
        ========================================================== */
        const existingParent = await config_1.prisma.user.findFirst({
            where: {
                schoolId,
                phone: cleanParentPhone,
                role: client_1.RoleName.PARENT,
            },
        });
        /* ==========================================================
           PRE-CREATE PASSWORD HASH
    
           bcrypt can take noticeable time, so don't execute it
           inside the Prisma interactive transaction.
        ========================================================== */
        let passwordHash = null;
        if (!existingParent) {
            passwordHash = await bcrypt_1.default.hash(cleanParentPhone, 10);
        }
        /* ==========================================================
           CREATE EVERYTHING
           
           Increased timeout from Prisma default 5000ms to 15000ms.
        ========================================================== */
        const student = await config_1.prisma.$transaction(async (tx) => {
            /* ======================================================
               APPLY COUPON
            ====================================================== */
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
            /* ======================================================
               CREATE STUDENT
            ====================================================== */
            const createdStudent = await tx.student.create({
                data: {
                    /* ------------------------------------------------
                       SCHOOL
                    ------------------------------------------------ */
                    school: {
                        connect: {
                            id: schoolId,
                        },
                    },
                    /* ------------------------------------------------
                       CLASS
                    ------------------------------------------------ */
                    class: {
                        connect: {
                            id: classDetails.id,
                        },
                    },
                    /* ------------------------------------------------
                       SECTION
                    ------------------------------------------------ */
                    section: {
                        connect: {
                            id: section.id,
                        },
                    },
                    /* ------------------------------------------------
                       BASIC INFORMATION
                    ------------------------------------------------ */
                    admissionNo,
                    name,
                    aadhaar,
                    fatherName,
                    motherName: motherName ?? null,
                    dob,
                    doj,
                    phone,
                    /* ------------------------------------------------
                       FEES
                    ------------------------------------------------ */
                    tieAmount: tie.amount,
                    tiePendingAmount: tie.pendingAmount,
                    beltAmount: belt.amount,
                    beltPendingAmount: belt.pendingAmount,
                    arrearsAmount: arrears.amount,
                    arrearsPendingAmount: arrears.pendingAmount,
                    /* ------------------------------------------------
                       CLASS FEES
                    ------------------------------------------------ */
                    pendingTuitionFee: classDetails.tuitionFee,
                    pendingTextbookFee: classDetails.textBookFee,
                    pendingNotebookFee: classDetails.noteBookFee,
                    pendingDiaryAmount: classDetails.diaryFee,
                    /* ------------------------------------------------
                       SIBLINGS
                    ------------------------------------------------ */
                    siblings: formattedSiblingArray,
                    /* ------------------------------------------------
                       COUPON
                    ------------------------------------------------ */
                    ...(coupon
                        ? {
                            coupon: {
                                connect: {
                                    id: coupon.id,
                                },
                            },
                        }
                        : {}),
                    /* ------------------------------------------------
                       TOTAL PENDING
                    ------------------------------------------------ */
                    pendingAmount,
                    /* ------------------------------------------------
                       CREATED BY
                    ------------------------------------------------ */
                    ...(req.user?.id
                        ? {
                            createdByAdmin: {
                                connect: {
                                    id: req.user.id,
                                },
                            },
                        }
                        : {}),
                },
            });
            /* ======================================================
               PARENT
            ====================================================== */
            let parentUser;
            if (!existingParent) {
                /* ----------------------------------------------------
                   INTERNAL EMAIL
      
                   Parent will login with mobile number.
                   Email is only maintained because the current
                   User schema requires it.
                ---------------------------------------------------- */
                const parentEmail = createParentInternalEmail(schoolId, cleanParentPhone);
                /* ----------------------------------------------------
                   CREATE PARENT
                   
                   passwordHash was calculated BEFORE transaction.
                ---------------------------------------------------- */
                parentUser =
                    await tx.user.create({
                        data: {
                            schoolId,
                            name: String(parentName ?? "").trim(),
                            email: parentEmail,
                            passwordHash: passwordHash,
                            phone: cleanParentPhone,
                            role: client_1.RoleName.PARENT,
                            designation: "Parent",
                            isActive: true,
                            mustChangePassword: true,
                        },
                    });
            }
            else {
                /* ----------------------------------------------------
                   EXISTING PARENT
                ---------------------------------------------------- */
                parentUser =
                    existingParent;
            }
            /* ======================================================
               CHECK EXISTING STUDENT ↔ PARENT LINK
            ====================================================== */
            const existingParentLink = await tx.studentParentLink.findUnique({
                where: {
                    studentId_parentUserId: {
                        studentId: createdStudent.id,
                        parentUserId: parentUser.id,
                    },
                },
            });
            /* ======================================================
               CREATE STUDENT ↔ PARENT LINK
            ====================================================== */
            if (!existingParentLink) {
                await tx.studentParentLink.create({
                    data: {
                        studentId: createdStudent.id,
                        parentUserId: parentUser.id,
                        relationship: parentRelationship,
                        isPrimary: true,
                    },
                });
            }
            /* ======================================================
               RETURN STUDENT
            ====================================================== */
            return createdStudent;
        }, 
        /* ========================================================
           PRISMA TRANSACTION OPTIONS
        ======================================================== */
        {
            timeout: 15000,
        });
        /* ============================================================
           SUCCESS
        ============================================================ */
        return res.status(201).json({
            message: "Student and parent account created successfully",
            id: student.id,
        });
    }
    catch (err) {
        /* ============================================================
           PRISMA ERROR
        ============================================================ */
        console.error("CREATE STUDENT PRISMA ERROR:", err);
        return res.status(500).json({
            message: err?.message ??
                "Unknown Prisma error",
        });
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
   STUDENT REGISTRATION OPTIONS
   Academic Year -> Class -> Section
============================================================ */
const getStudentRegistrationOptions = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const academicYears = await config_1.prisma.academicYear.findMany({
            where: {
                schoolId,
            },
            orderBy: {
                startDate: "desc",
            },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                isCurrent: true,
                classes: {
                    orderBy: {
                        classNumber: "asc",
                    },
                    select: {
                        id: true,
                        classNumber: true,
                        displayName: true,
                        tuitionFee: true,
                        textBookFee: true,
                        noteBookFee: true,
                        diaryFee: true,
                        sections: {
                            orderBy: {
                                sectionName: "asc",
                            },
                            select: {
                                id: true,
                                sectionName: true,
                            },
                        },
                    },
                },
            },
        });
        return res.status(200).json({
            academicYears,
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
    const { admissionNo, } = req.body;
    const schoolId = getSchoolId(req);
    if (!schoolId || !admissionNo) {
        return res.status(400).json({
            message: "Admission number is required",
        });
    }
    try {
        const student = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo,
                },
            },
            include: {
                class: {
                    include: {
                        academicYear: true,
                    },
                },
                section: true,
                coupon: true,
                parentLinks: {
                    include: {
                        parentUser: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({
                message: "Student not found",
            });
        }
        /*
         * ---------------------------------------------------------
         * RETURN EDIT-FRIENDLY RESPONSE
         * ---------------------------------------------------------
         */
        return res.status(200).json({
            id: student.id,
            admissionNo: student.admissionNo,
            name: student.name,
            aadhaar: student.aadhaar,
            fatherName: student.fatherName,
            motherName: student.motherName,
            dob: student.dob,
            doj: student.doj,
            phoneNo: student.phone,
            tcNo: "",
            /*
             * -------------------------------------------------------
             * ACADEMIC YEAR
             * -------------------------------------------------------
             */
            academicYearId: student.class.academicYear.id,
            academicYear: {
                id: student.class.academicYear.id,
                name: student.class.academicYear.name,
                startDate: student.class.academicYear.startDate,
                endDate: student.class.academicYear.endDate,
                isCurrent: student.class.academicYear.isCurrent,
            },
            /*
             * -------------------------------------------------------
             * CLASS
             * -------------------------------------------------------
             */
            classNumber: {
                id: student.class.id,
                classNumber: student.class.classNumber,
                displayName: student.class.displayName,
            },
            /*
             * -------------------------------------------------------
             * SECTION
             * -------------------------------------------------------
             */
            section: {
                id: student.section.id,
                sectionName: student.section.sectionName,
            },
            /*
             * -------------------------------------------------------
             * FEES
             * -------------------------------------------------------
             */
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
            diary: {
                amount: student.pendingDiaryAmount,
            },
            pendingTuitionFee: student.pendingTuitionFee,
            pendingTextbookFee: student.pendingTextbookFee,
            pendingNotebookFee: student.pendingNotebookFee,
            pendingDiaryAmount: student.pendingDiaryAmount,
            pendingAmount: student.pendingAmount,
            /*
             * -------------------------------------------------------
             * SIBLINGS
             * -------------------------------------------------------
             */
            siblings: student.siblings,
            /*
             * -------------------------------------------------------
             * COUPON
             * -------------------------------------------------------
             */
            couponCode: student.coupon
                ? {
                    id: student.coupon.id,
                    code: student.coupon.code,
                    discount: student.coupon.discount,
                    status: student.coupon.status,
                }
                : null,
            /*
             * -------------------------------------------------------
             * STATUS
             * -------------------------------------------------------
             */
            status: student.status,
            rollNumber: student.rollNumber,
            gender: student.gender,
            bloodGroup: student.bloodGroup,
            category: student.category,
            religion: student.religion,
            emergencyContact: student.emergencyContact,
            photoUrl: student.photoUrl,
            previousSchool: student.previousSchool,
            /*
             * -------------------------------------------------------
             * PARENTS
             * -------------------------------------------------------
             */
            parentLinks: student.parentLinks,
            createdAt: student.createdAt,
            updatedAt: student.updatedAt,
        });
    }
    catch (err) {
        console.error("GET STUDENT ERROR:", err);
        return res.status(500).json({
            message: err?.message ??
                "Unknown error",
        });
    }
};
/* ============================================================
   EDIT STUDENT
============================================================ */
const editStudent = async (req, res) => {
    const { oldAdmissionNo, admissionNo, name, aadhaar, fatherName, motherName, dob, doj, phone, academicYearId, classNumber, sectionName, tie, belt, arrears, couponCode, siblingStudentsFromDb, siblings, } = req.body;
    const schoolId = getSchoolId(req);
    /* ============================================================
       VALIDATION
    ============================================================ */
    if (!schoolId ||
        !oldAdmissionNo ||
        !admissionNo ||
        !name ||
        !aadhaar ||
        !fatherName ||
        !dob ||
        !doj ||
        !phone ||
        !academicYearId ||
        !classNumber ||
        !sectionName ||
        !tie ||
        !belt ||
        !arrears) {
        return res.status(400).json({
            message: "Some fields are missing in request body",
        });
    }
    try {
        /* ============================================================
           FIND EXISTING STUDENT
        ============================================================ */
        const student = await config_1.prisma.student.findUnique({
            where: {
                schoolId_admissionNo: {
                    schoolId,
                    admissionNo: oldAdmissionNo,
                },
            },
        });
        if (!student) {
            return res.status(404).json({
                message: "Student not found",
            });
        }
        /* ============================================================
           ADMISSION NUMBER CANNOT CHANGE
        ============================================================ */
        if (admissionNo !== oldAdmissionNo) {
            return res.status(400).json({
                message: "Cannot change admission number",
            });
        }
        /* ============================================================
           FIND CLASS FOR ACADEMIC YEAR
        ============================================================ */
        const classDetails = await config_1.prisma.class.findUnique({
            where: {
                schoolId_academicYearId_classNumber: {
                    schoolId,
                    academicYearId,
                    classNumber,
                },
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist for the selected academic year.",
            });
        }
        /* ============================================================
           FIND SECTION
        ============================================================ */
        const section = await config_1.prisma.section.findUnique({
            where: {
                schoolId_classId_sectionName: {
                    schoolId,
                    classId: classDetails.id,
                    sectionName,
                },
            },
        });
        if (!section) {
            return res.status(400).json({
                message: `Section ${sectionName} doesn't exist for class ${classNumber}.`,
            });
        }
        /* ============================================================
           COUPON
        ============================================================ */
        let coupon = null;
        if (couponCode) {
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
        /* ============================================================
           SIBLINGS
    
           Accept either:
           - siblingStudentsFromDb
           - siblings
           - empty array
        ============================================================ */
        const siblingsFromDb = siblingStudentsFromDb ??
            siblings ??
            [];
        const formattedSiblingArray = createSiblingsArray(siblingsFromDb);
        /* ============================================================
           PENDING AMOUNT
        ============================================================ */
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
        /* ============================================================
           UPDATE STUDENT
        ============================================================ */
        const updatedStudent = await config_1.prisma.$transaction(async (tx) => {
            /* ------------------------------------------------------
               APPLY COUPON
            ------------------------------------------------------ */
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
            /* ------------------------------------------------------
               UPDATE STUDENT
            ------------------------------------------------------ */
            return tx.student.update({
                where: {
                    id: student.id,
                },
                data: {
                    /* -----------------------------------------------
                       BASIC INFORMATION
                    ----------------------------------------------- */
                    name,
                    aadhaar,
                    fatherName,
                    motherName: motherName ?? null,
                    dob,
                    doj,
                    phone,
                    /* -----------------------------------------------
                       CLASS
                    ----------------------------------------------- */
                    class: {
                        connect: {
                            id: classDetails.id,
                        },
                    },
                    /* -----------------------------------------------
                       SECTION
                    ----------------------------------------------- */
                    section: {
                        connect: {
                            id: section.id,
                        },
                    },
                    /* -----------------------------------------------
                       ADDITIONAL FEES
                    ----------------------------------------------- */
                    tieAmount: tie.amount,
                    tiePendingAmount: tie.pendingAmount,
                    beltAmount: belt.amount,
                    beltPendingAmount: belt.pendingAmount,
                    arrearsAmount: arrears.amount,
                    arrearsPendingAmount: arrears.pendingAmount,
                    /* -----------------------------------------------
                       CLASS FEES
                    ----------------------------------------------- */
                    pendingTuitionFee: classDetails.tuitionFee,
                    pendingTextbookFee: classDetails.textBookFee,
                    pendingNotebookFee: classDetails.noteBookFee,
                    pendingDiaryAmount: classDetails.diaryFee,
                    /* -----------------------------------------------
                       SIBLINGS
                    ----------------------------------------------- */
                    siblings: formattedSiblingArray,
                    /* -----------------------------------------------
                       COUPON
      
                       Use relation instead of couponId because
                       Prisma's generated client is expecting the
                       nested relation.
                    ----------------------------------------------- */
                    ...(coupon
                        ? {
                            coupon: {
                                connect: {
                                    id: coupon.id,
                                },
                            },
                        }
                        : {}),
                    /* -----------------------------------------------
                       TOTAL PENDING
                    ----------------------------------------------- */
                    pendingAmount,
                },
            });
        });
        /* ============================================================
           SUCCESS
        ============================================================ */
        return res.status(200).json({
            message: "Student updated successfully",
            id: updatedStudent.id,
        });
    }
    catch (err) {
        /* ============================================================
           ERROR
        ============================================================ */
        console.error("EDIT STUDENT PRISMA ERROR:", err);
        return res.status(500).json({
            message: err?.message ??
                "Unknown Prisma error",
        });
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
const createParentInternalEmail = (schoolId, phone) => {
    const cleanPhone = phone.replace(/\D/g, "");
    return `parent_${schoolId}_${cleanPhone}@school.local`;
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
    getStudentRegistrationOptions,
    promoteDemote,
};
