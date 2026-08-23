"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentMiddlewares = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return req.user?.schoolId ?? req.body?.schoolId;
};
/* ============================================================
   CHECK DUPLICATE STUDENT
============================================================ */
const checkDuplicateStudent = async (req, res, next) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { admissionNo, aadhaar, } = req.body;
        if (!admissionNo || !aadhaar) {
            return res.status(400).json({
                message: "admissionNo and aadhaar are required",
            });
        }
        /*
         * New schema is multi-tenant.
         *
         * Therefore duplicate checking MUST always
         * happen inside the current school.
         *
         * OLD:
         *
         * where: {
         *   OR: [...]
         * }
         *
         * NEW:
         *
         * where: {
         *   schoolId,
         *   OR: [...]
         * }
         */
        const students = await config_1.prisma.student.findMany({
            where: {
                schoolId,
                OR: [
                    {
                        admissionNo,
                    },
                    {
                        aadhaar,
                    },
                ],
            },
            select: {
                admissionNo: true,
                aadhaar: true,
            },
        });
        if (students.length === 0) {
            next();
            return;
        }
        let duplicateAdmissionNo = false;
        let duplicateAadhaar = false;
        for (const student of students) {
            if (student.admissionNo === admissionNo) {
                duplicateAdmissionNo = true;
            }
            if (student.aadhaar === aadhaar) {
                duplicateAadhaar = true;
            }
        }
        const duplicateFields = [];
        if (duplicateAdmissionNo) {
            duplicateFields.push("admission number");
        }
        if (duplicateAadhaar) {
            duplicateFields.push("aadhaar");
        }
        return res.status(400).json({
            message: `Duplicate ${duplicateFields.join(", ")}`,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   CHECK SIBLINGS EXIST
============================================================ */
const checkSiblingsExist = async (req, res, next) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const siblings = req.body.siblings;
        if (!siblings) {
            return res.status(400).json({
                message: "siblings field missing in request body",
            });
        }
        /*
         * No siblings selected.
         */
        if (!siblings.length) {
            next();
            return;
        }
        const studentAdmissionNo = req.body.admissionNo;
        /* ========================================================
           CHECK DUPLICATE SIBLING ADMISSION NUMBERS
        ======================================================== */
        const admissionNoExists = {};
        for (const sibling of siblings) {
            /*
             * A student cannot be their own sibling.
             */
            if (sibling.admissionNo ===
                studentAdmissionNo) {
                return res.status(400).json({
                    message: "Sibling cannot have same admission ID as the student",
                });
            }
            /*
             * Same sibling cannot appear twice.
             */
            if (admissionNoExists[sibling.admissionNo]) {
                return res.status(400).json({
                    message: "Admission number of siblings are repeating",
                });
            }
            admissionNoExists[sibling.admissionNo] = true;
        }
        /* ========================================================
           FIND SIBLINGS IN CURRENT SCHOOL
        ======================================================== */
        const admissionNumbers = siblings.map((sibling) => sibling.admissionNo);
        /*
         * IMPORTANT:
         *
         * We scope this query using schoolId.
         *
         * Otherwise a sibling from another school
         * could incorrectly be accepted.
         */
        const siblingStudents = await config_1.prisma.student.findMany({
            where: {
                schoolId,
                admissionNo: {
                    in: admissionNumbers,
                },
            },
            select: {
                admissionNo: true,
                name: true,
            },
        });
        /* ========================================================
           CHECK WHETHER ALL SIBLINGS EXIST
        ======================================================== */
        if (siblingStudents.length !==
            siblings.length) {
            const existingAdmissionNumbers = siblingStudents.map((student) => student.admissionNo);
            const incorrectAdmissionNumbers = admissionNumbers.filter((admissionNo) => !existingAdmissionNumbers.includes(admissionNo));
            return res.status(400).json({
                message: `The following admission numbers for siblings are incorrect: ` +
                    incorrectAdmissionNumbers.join(", "),
            });
        }
        /* ========================================================
           SAVE DB SIBLING DATA FOR CONTROLLER
        ======================================================== */
        req.body.siblingStudentsFromDb =
            siblingStudents;
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.studentMiddlewares = {
    checkDuplicateStudent,
    checkSiblingsExist,
};
