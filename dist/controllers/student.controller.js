"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentcontrollers = void 0;
const config_1 = require("../config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const client_1 = require("@prisma/client");
const types_1 = require("../types");
const utils_1 = require("../utils");
const googleDrive_service_1 = require("../services/googleDrive.service");
/* ============================================================
   HELPERS
============================================================ */
const calculatePendingAmountSync = ({ student, classDetails, coupon, alreadyPaid = 0, }) => {
    const { tuitionFee, textBookFee, noteBookFee, diaryFee, } = classDetails;
    const tieAmount = Number(student?.tie?.amount ?? 0);
    const beltAmount = Number(student?.belt?.amount ?? 0);
    const arrearsAmount = Number(student?.arrears?.amount ?? 0);
    const totalFee = Number(tuitionFee) +
        Number(textBookFee) +
        Number(noteBookFee) +
        Number(diaryFee) +
        tieAmount +
        beltAmount +
        arrearsAmount;
    const discount = coupon?.discountType === types_1.CouponDiscountType.PERCENT
        ? (totalFee * Number(coupon.discount)) / 100
        : Number(coupon?.discount ?? 0);
    return `${totalFee - discount - alreadyPaid}`;
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
const getAcademicYearId = (req) => {
    return (req.body?.academicYearId ??
        req.query?.academicYearId);
};
const extractGoogleDriveFileId = (url) => {
    const queryId = url.match(/[?&]id=([^&]+)/)?.[1];
    if (queryId)
        return decodeURIComponent(queryId);
    const pathId = url.match(/\/d\/([^/]+)/)?.[1];
    return pathId ? decodeURIComponent(pathId) : undefined;
};
const generateBulkStudentIdCards = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const generatedByUserId = req.userId;
        const { studentIds, academicYearId } = req.body;
        if (!schoolId || !generatedByUserId) {
            return res.status(400).json({ message: "Authenticated school and user are required" });
        }
        if (!Array.isArray(studentIds) ||
            studentIds.length < 1 ||
            studentIds.length > 200 ||
            studentIds.some((id) => typeof id !== "string")) {
            return res.status(400).json({
                message: "studentIds must contain between 1 and 200 student IDs",
            });
        }
        const students = await config_1.prisma.student.findMany({
            where: { schoolId, id: { in: studentIds } },
            include: { school: true, class: true, section: true },
            orderBy: { admissionNo: "asc" },
        });
        if (students.length !== studentIds.length) {
            return res.status(404).json({
                message: "One or more students were not found in the authenticated school",
            });
        }
        const academicYear = academicYearId
            ? await config_1.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } })
            : await config_1.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
                orderBy: { startDate: "desc" },
            });
        if (academicYearId && !academicYear) {
            return res.status(404).json({ message: "Academic year not found" });
        }
        const document = new pdfkit_1.default({ size: "A4", margin: 24 });
        const chunks = [];
        document.on("data", (chunk) => chunks.push(chunk));
        const pdf = new Promise((resolve, reject) => {
            document.on("end", () => resolve(Buffer.concat(chunks)));
            document.on("error", reject);
        });
        for (let index = 0; index < students.length; index += 1) {
            if (index > 0 && index % 8 === 0)
                document.addPage();
            const student = students[index];
            const slot = index % 8;
            const x = 24 + (slot % 2) * 275;
            const y = 28 + Math.floor(slot / 2) * 185;
            const previousCard = await config_1.prisma.iDCard.findFirst({
                where: { schoolId, studentId: student.id, isActive: true },
                orderBy: { version: "desc" },
            });
            const version = (previousCard?.version ?? 0) + 1;
            let photoBuffer;
            const fileId = student.photoUrl
                ? extractGoogleDriveFileId(student.photoUrl)
                : undefined;
            if (fileId)
                photoBuffer = await (0, googleDrive_service_1.downloadGoogleDriveFileToBuffer)(fileId);
            document.roundedRect(x, y, 250, 170, 8).lineWidth(1)
                .strokeColor("#1f4e79").stroke();
            document.rect(x + 1, y + 1, 248, 32).fill("#1f4e79");
            document.fillColor("#fff").fontSize(11).font("Helvetica-Bold")
                .text(student.school.name, x + 10, y + 10, { width: 230, align: "center" });
            document.fillColor("#1f4e79").fontSize(8).text("STUDENT ID CARD", x + 10, y + 44, {
                width: 230, align: "center",
            });
            document.rect(x + 14, y + 61, 62, 70).lineWidth(0.5).strokeColor("#9aa7b2").stroke();
            if (photoBuffer) {
                document.image(photoBuffer, x + 17, y + 64, { fit: [56, 64] });
            }
            else {
                document.fillColor("#68737d").fontSize(7).text("PHOTO", x + 14, y + 92, {
                    width: 62, align: "center",
                });
            }
            const field = (label, value, fieldY) => {
                document.fillColor("#4b5563").font("Helvetica-Bold").fontSize(7)
                    .text(label, x + 88, fieldY, { width: 58 });
                document.fillColor("#111827").font("Helvetica").fontSize(8)
                    .text(value || "-", x + 148, fieldY, { width: 90 });
            };
            field("Name", student.name, y + 63);
            field("Admission No.", student.admissionNo, y + 78);
            field("Class", student.class.displayName, y + 93);
            field("Section", student.section.sectionName, y + 108);
            field("DOB", student.dob, y + 123);
            document.fillColor("#4b5563").fontSize(6).text(`${academicYear?.name ?? "Academic year"} | Card v${version}`, x + 10, y + 148, { width: 230, align: "center" });
            await config_1.prisma.iDCard.updateMany({
                where: { schoolId, studentId: student.id, isActive: true },
                data: { isActive: false },
            });
            await config_1.prisma.iDCard.create({
                data: {
                    schoolId,
                    studentId: student.id,
                    cardType: "STUDENT",
                    academicYearId: academicYear?.id,
                    pdfUrl: "/api/students/id-cards/bulk",
                    version,
                    reissueReason: previousCard ? client_1.IDCardReissueReason.DATA_CHANGE : client_1.IDCardReissueReason.INITIAL,
                    generatedByUserId,
                },
            });
        }
        document.end();
        const pdfBuffer = await pdf;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="student-id-cards.pdf"');
        return res.send(pdfBuffer);
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const generateStudentIdCard = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const studentId = req.params.studentId;
        const academicYearId = getAcademicYearId(req);
        const generatedByUserId = req.userId;
        if (!schoolId || !studentId || !generatedByUserId) {
            return res.status(400).json({
                message: "Authenticated school, user and studentId are required",
            });
        }
        const student = await config_1.prisma.student.findFirst({
            where: { id: studentId, schoolId },
            include: {
                school: true,
                class: true,
                section: true,
            },
        });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        const uploadedPhoto = req.file;
        let photoUrl = student.photoUrl;
        let photoBuffer = uploadedPhoto?.buffer;
        if (uploadedPhoto) {
            if (!["image/jpeg", "image/png", "image/webp"].includes(uploadedPhoto.mimetype)) {
                return res.status(400).json({
                    message: "photo must be a JPEG, PNG or WebP image",
                });
            }
            if (uploadedPhoto.size > 5 * 1024 * 1024) {
                return res.status(400).json({ message: "photo cannot exceed 5 MB" });
            }
            const photo = await (0, googleDrive_service_1.uploadStudentPhotoToGoogleDrive)(uploadedPhoto.buffer, `student-${student.admissionNo}-${Date.now()}`, uploadedPhoto.mimetype);
            if (!photo.webViewLink) {
                throw new Error("Google Drive photo upload returned no view URL");
            }
            photoUrl = photo.webViewLink;
            await config_1.prisma.student.update({
                where: { id: student.id },
                data: { photoUrl },
            });
        }
        if (!photoBuffer && photoUrl) {
            const driveFileId = extractGoogleDriveFileId(photoUrl);
            if (driveFileId) {
                photoBuffer = await (0, googleDrive_service_1.downloadGoogleDriveFileToBuffer)(driveFileId);
            }
        }
        let academicYear;
        if (academicYearId) {
            academicYear = await config_1.prisma.academicYear.findFirst({
                where: { id: academicYearId, schoolId },
            });
            if (!academicYear) {
                return res.status(404).json({ message: "Academic year not found" });
            }
        }
        else {
            academicYear = await config_1.prisma.academicYear.findFirst({
                where: { schoolId, isCurrent: true },
                orderBy: { startDate: "desc" },
            });
        }
        const previousCard = await config_1.prisma.iDCard.findFirst({
            where: {
                schoolId,
                studentId,
                isActive: true,
            },
            orderBy: { version: "desc" },
        });
        const version = (previousCard?.version ?? 0) + 1;
        const cardUrl = `/api/student/${studentId}/id-card`;
        const document = new pdfkit_1.default({
            size: [242, 153],
            margin: 0,
        });
        const chunks = [];
        document.on("data", (chunk) => chunks.push(chunk));
        const pdf = new Promise((resolve, reject) => {
            document.on("end", () => resolve(Buffer.concat(chunks)));
            document.on("error", reject);
        });
        document
            .roundedRect(8, 8, 226, 137, 8)
            .lineWidth(1)
            .strokeColor("#1f4e79")
            .stroke();
        document
            .rect(9, 9, 224, 29)
            .fill("#1f4e79");
        document
            .fillColor("#ffffff")
            .fontSize(11)
            .font("Helvetica-Bold")
            .text(student.school.name, 17, 16, { width: 208, align: "center" });
        document
            .fillColor("#1f4e79")
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("STUDENT ID CARD", 17, 44, { width: 208, align: "center" });
        document
            .rect(18, 61, 58, 65)
            .lineWidth(0.5)
            .strokeColor("#9aa7b2")
            .stroke();
        if (photoBuffer) {
            document
                .image(photoBuffer, 20, 63, {
                fit: [54, 61],
                align: "center",
                valign: "center",
            });
        }
        document
            .fillColor("#68737d")
            .font("Helvetica")
            .fontSize(7)
            .text(photoBuffer ? "" : "PHOTO", 18, 89, { width: 58, align: "center" });
        const field = (label, value, y) => {
            document
                .fillColor("#4b5563")
                .font("Helvetica-Bold")
                .fontSize(7)
                .text(label, 86, y, { width: 50 });
            document
                .fillColor("#111827")
                .font("Helvetica")
                .fontSize(8)
                .text(value || "-", 137, y, { width: 85 });
        };
        const generateBulkStudentIdCards = async (req, res) => {
            try {
                const schoolId = getSchoolId(req);
                const generatedByUserId = req.userId;
                const { studentIds, academicYearId } = req.body;
                if (!schoolId || !generatedByUserId) {
                    return res.status(400).json({
                        message: "Authenticated school and user are required",
                    });
                }
                if (!Array.isArray(studentIds) ||
                    studentIds.length === 0 ||
                    studentIds.some((id) => typeof id !== "string") ||
                    studentIds.length > 200) {
                    return res.status(400).json({
                        message: "studentIds must contain between 1 and 200 student IDs",
                    });
                }
                const students = await config_1.prisma.student.findMany({
                    where: {
                        schoolId,
                        id: { in: studentIds },
                    },
                    include: { school: true, class: true, section: true },
                    orderBy: { admissionNo: "asc" },
                });
                if (students.length !== studentIds.length) {
                    return res.status(404).json({
                        message: "One or more students were not found in the authenticated school",
                    });
                }
                const academicYear = academicYearId
                    ? await config_1.prisma.academicYear.findFirst({
                        where: { id: academicYearId, schoolId },
                    })
                    : await config_1.prisma.academicYear.findFirst({
                        where: { schoolId, isCurrent: true },
                        orderBy: { startDate: "desc" },
                    });
                if (academicYearId && !academicYear) {
                    return res.status(404).json({ message: "Academic year not found" });
                }
                const document = new pdfkit_1.default({
                    size: "A4",
                    margin: 24,
                });
                const chunks = [];
                document.on("data", (chunk) => chunks.push(chunk));
                const pdf = new Promise((resolve, reject) => {
                    document.on("end", () => resolve(Buffer.concat(chunks)));
                    document.on("error", reject);
                });
                const cardsPerPage = 8;
                const cardWidth = 250;
                const cardHeight = 170;
                const gapX = 25;
                const gapY = 18;
                for (let index = 0; index < students.length; index += 1) {
                    const student = students[index];
                    if (index > 0 && index % cardsPerPage === 0)
                        document.addPage();
                    const pageIndex = index % cardsPerPage;
                    const x = 24 + (pageIndex % 2) * (cardWidth + gapX);
                    const y = 28 + Math.floor(pageIndex / 2) * (cardHeight + gapY);
                    const previousCard = await config_1.prisma.iDCard.findFirst({
                        where: { schoolId, studentId: student.id, isActive: true },
                        orderBy: { version: "desc" },
                    });
                    const version = (previousCard?.version ?? 0) + 1;
                    let photoBuffer;
                    if (student.photoUrl) {
                        const driveFileId = extractGoogleDriveFileId(student.photoUrl);
                        if (driveFileId) {
                            photoBuffer = await (0, googleDrive_service_1.downloadGoogleDriveFileToBuffer)(driveFileId);
                        }
                    }
                    document
                        .roundedRect(x, y, cardWidth, cardHeight, 8)
                        .lineWidth(1)
                        .strokeColor("#1f4e79")
                        .stroke();
                    document.rect(x + 1, y + 1, cardWidth - 2, 32).fill("#1f4e79");
                    document
                        .fillColor("#ffffff")
                        .fontSize(11)
                        .font("Helvetica-Bold")
                        .text(student.school.name, x + 10, y + 10, {
                        width: cardWidth - 20,
                        align: "center",
                    });
                    document
                        .fillColor("#1f4e79")
                        .fontSize(8)
                        .text("STUDENT ID CARD", x + 10, y + 44, {
                        width: cardWidth - 20,
                        align: "center",
                    });
                    document
                        .rect(x + 14, y + 61, 62, 70)
                        .lineWidth(0.5)
                        .strokeColor("#9aa7b2")
                        .stroke();
                    if (photoBuffer) {
                        document.image(photoBuffer, x + 17, y + 64, {
                            fit: [56, 64],
                            align: "center",
                            valign: "center",
                        });
                    }
                    else {
                        document
                            .fillColor("#68737d")
                            .font("Helvetica")
                            .fontSize(7)
                            .text("PHOTO", x + 14, y + 92, { width: 62, align: "center" });
                    }
                    const field = (label, value, fieldY) => {
                        document
                            .fillColor("#4b5563")
                            .font("Helvetica-Bold")
                            .fontSize(7)
                            .text(label, x + 88, fieldY, { width: 58 });
                        document
                            .fillColor("#111827")
                            .font("Helvetica")
                            .fontSize(8)
                            .text(value || "-", x + 148, fieldY, { width: 90 });
                    };
                    field("Name", student.name, y + 63);
                    field("Admission No.", student.admissionNo, y + 78);
                    field("Class", student.class.displayName, y + 93);
                    field("Section", student.section.sectionName, y + 108);
                    field("DOB", student.dob, y + 123);
                    document
                        .fillColor("#4b5563")
                        .fontSize(6)
                        .font("Helvetica")
                        .text(`${academicYear?.name ?? "Academic year"} | Card v${version}`, x + 10, y + 148, { width: cardWidth - 20, align: "center" });
                    await config_1.prisma.iDCard.updateMany({
                        where: { schoolId, studentId: student.id, isActive: true },
                        data: { isActive: false },
                    });
                    await config_1.prisma.iDCard.create({
                        data: {
                            schoolId,
                            studentId: student.id,
                            cardType: "STUDENT",
                            academicYearId: academicYear?.id,
                            pdfUrl: `/api/students/id-cards/bulk`,
                            version,
                            reissueReason: previousCard
                                ? client_1.IDCardReissueReason.DATA_CHANGE
                                : client_1.IDCardReissueReason.INITIAL,
                            generatedByUserId,
                        },
                    });
                }
                document.end();
                const pdfBuffer = await pdf;
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", "attachment; filename=\"student-id-cards.pdf\"");
                return res.send(pdfBuffer);
            }
            catch (err) {
                return (0, utils_1.handleErr)(err, res);
            }
        };
        field("Name", student.name, 61);
        field("Admission No.", student.admissionNo, 74);
        field("Class", student.class.displayName, 87);
        field("Section", student.section.sectionName, 100);
        field("DOB", student.dob, 113);
        document
            .fillColor("#4b5563")
            .fontSize(6)
            .font("Helvetica")
            .text(`${academicYear?.name ?? "Academic year"}  |  Card v${version}`, 17, 132, { width: 208, align: "center" });
        document.end();
        const pdfBuffer = await pdf;
        await config_1.prisma.iDCard.updateMany({
            where: { schoolId, studentId, isActive: true },
            data: { isActive: false },
        });
        await config_1.prisma.iDCard.create({
            data: {
                schoolId,
                studentId,
                cardType: "STUDENT",
                academicYearId: academicYear?.id,
                pdfUrl: cardUrl,
                version,
                reissueReason: previousCard
                    ? client_1.IDCardReissueReason.DATA_CHANGE
                    : client_1.IDCardReissueReason.INITIAL,
                generatedByUserId,
            },
        });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="student-${student.admissionNo}-id-card.pdf"`);
        return res.send(pdfBuffer);
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
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
// get all the studnets of a school
const getAllStudents = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const students = await config_1.prisma.student.findMany({
            where: {
                schoolId,
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
// const groupStudentsByClassAndCount = async (
//   req: Request,
//   res: Response<ClassStudentCountResponse>
// ) => {
//   try {
//     const schoolId = getSchoolId(req);
//     if (!schoolId) {
//       return res.status(400).json({
//         message: "schoolId is required",
//       });
//     }
//     const groupedStudents =
//       await prisma.student.groupBy({
//         by: ["classId"],
//         where: {
//           schoolId,
//         },
//         _count: {
//           id: true,
//         },
//       });
//     const responseData: {
//       classNumber: string;
//       count: string;
//     }[] = [];
//     for (const group of groupedStudents) {
//       const classDetails =
//         await prisma.class.findFirst({
//           where: {
//             id: group.classId,
//             schoolId,
//           },
//         });
//       if (
//         classDetails &&
//         !classDetails.isCompleted
//       ) {
//         responseData.push({
//           classNumber:
//             classDetails.classNumber,
//           count:
//             String(group._count.id),
//         });
//       }
//     }
//     responseData.sort(
//       (a, b) =>
//         Number(a.classNumber) -
//         Number(b.classNumber)
//     );
//     return res.status(200).json({
//       countData: responseData,
//     });
//   } catch (err) {
//     return handleErr(err as any, res);
//   }
// };
const groupStudentsByClassAndCount = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const academicYearId = getAcademicYearId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!academicYearId) {
            return res.status(400).json({
                message: "academicYearId is required",
            });
        }
        const groupedStudents = await config_1.prisma.student.groupBy({
            by: ["classId"],
            where: {
                schoolId,
                class: {
                    academicYearId,
                },
            },
            _count: {
                _all: true,
            },
        });
        const responseData = [];
        for (const group of groupedStudents) {
            const classDetails = await config_1.prisma.class.findFirst({
                where: {
                    id: group.classId,
                    schoolId,
                    academicYearId,
                },
            });
            if (classDetails && !classDetails.isCompleted) {
                responseData.push({
                    classNumber: classDetails.classNumber,
                    count: String(group._count._all),
                });
            }
        }
        responseData.sort((a, b) => Number(a.classNumber) - Number(b.classNumber));
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
    getAllStudents,
    groupStudentsByClassAndCount,
    getStudentRegistrationOptions,
    promoteDemote,
    generateStudentIdCard,
    generateBulkStudentIdCards,
};
