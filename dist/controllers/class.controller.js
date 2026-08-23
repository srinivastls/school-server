"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classControllers = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
/**
 * Resolve schoolId.
 *
 * For authenticated requests:
 *   JWT schoolId takes priority.
 *
 * For non-authenticated requests such as create/login flows:
 *   body/query schoolId can be used.
 */
const getSchoolId = (req) => {
    return (req.user?.schoolId ??
        req.body?.schoolId ??
        req.query?.schoolId);
};
/* ============================================================
   CREATE CLASS
============================================================ */
const createClass = async (req, res) => {
    try {
        const { classNumber, displayName, tuitionFee, textBookFee, noteBookFee, diaryFee, academicYearId, schoolId, } = req.body;
        /*
         * Prefer authenticated JWT schoolId.
         * Fall back to body schoolId.
         */
        const resolvedSchoolId = getSchoolId(req) ?? schoolId;
        if (!classNumber ||
            tuitionFee === undefined ||
            textBookFee === undefined ||
            noteBookFee === undefined ||
            diaryFee === undefined ||
            !academicYearId ||
            !resolvedSchoolId) {
            return res.status(400).json({
                message: "classNumber, tuitionFee, textBookFee, noteBookFee, diaryFee, academicYearId and schoolId are required",
            });
        }
        /* --------------------------------------------------------
           Verify academic year belongs to school
        -------------------------------------------------------- */
        const academicYear = await config_1.prisma.academicYear.findFirst({
            where: {
                id: academicYearId,
                schoolId: resolvedSchoolId,
            },
        });
        if (!academicYear) {
            return res.status(400).json({
                message: "Academic year not found for this school",
            });
        }
        /* --------------------------------------------------------
           Prevent duplicate class
        -------------------------------------------------------- */
        const existingClass = await config_1.prisma.class.findFirst({
            where: {
                schoolId: resolvedSchoolId,
                academicYearId,
                classNumber,
            },
        });
        if (existingClass) {
            return res.status(409).json({
                message: "Class already exists for this academic year",
            });
        }
        /* --------------------------------------------------------
           Create class
        -------------------------------------------------------- */
        await config_1.prisma.class.create({
            data: {
                schoolId: resolvedSchoolId,
                academicYearId,
                classNumber,
                displayName: displayName ?? classNumber,
                tuitionFee,
                textBookFee,
                noteBookFee,
                diaryFee,
            },
        });
        return res.status(201).json({
            message: "Class created successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET ALL CLASSES
============================================================ */
const getAllClasses = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const classes = await config_1.prisma.class.findMany({
            where: {
                schoolId,
                isCompleted: false,
            },
            include: {
                academicYear: true,
            },
            orderBy: {
                classNumber: "asc",
            },
        });
        const classList = classes.map((classDetails) => ({
            id: classDetails.id,
            classNumber: classDetails.classNumber,
            displayName: classDetails.displayName,
            tuitionFee: classDetails.tuitionFee,
            textBookFee: classDetails.textBookFee,
            noteBookFee: classDetails.noteBookFee,
            diaryFee: classDetails.diaryFee,
            academicYearId: classDetails.academicYearId,
            academicYear: classDetails.academicYear.name,
            isCompleted: classDetails.isCompleted,
        }));
        return res.status(200).json({
            classes: classList,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   DELETE CLASS
============================================================ */
const deleteClass = async (req, res) => {
    try {
        const { classNumber, academicYearId, schoolId, } = req.body;
        const resolvedSchoolId = getSchoolId(req) ?? schoolId;
        if (!resolvedSchoolId ||
            !classNumber) {
            return res.status(400).json({
                message: "schoolId and classNumber are required",
            });
        }
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId: resolvedSchoolId,
                classNumber,
                ...(academicYearId
                    ? { academicYearId }
                    : {}),
            },
            include: {
                students: true,
                sections: true,
                subjects: true,
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Class doesn't exist",
            });
        }
        /* --------------------------------------------------------
           Prevent deletion when students exist
        -------------------------------------------------------- */
        if (classDetails.students.length > 0) {
            return res.status(400).json({
                message: "Cannot delete class because it has students",
            });
        }
        /* --------------------------------------------------------
           Prevent deletion when sections/subjects exist
        -------------------------------------------------------- */
        if (classDetails.sections.length > 0 ||
            classDetails.subjects.length > 0) {
            return res.status(400).json({
                message: "Cannot delete class because it has sections or subjects",
            });
        }
        await config_1.prisma.class.delete({
            where: {
                id: classDetails.id,
            },
        });
        return res.status(200).json({
            message: "Class deleted successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   GET CLASS DETAILS
============================================================ */
const getClassDetails = async (req, res) => {
    try {
        const { classNumber, academicYearId, schoolId, } = req.query;
        const resolvedSchoolId = getSchoolId(req) ?? schoolId;
        if (!resolvedSchoolId ||
            !classNumber) {
            return res.status(400).json({
                message: "schoolId and classNumber are required",
            });
        }
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId: resolvedSchoolId,
                classNumber,
                ...(academicYearId
                    ? { academicYearId }
                    : {}),
            },
            include: {
                academicYear: true,
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        return res.status(200).json({
            id: classDetails.id,
            classNumber: classDetails.classNumber,
            displayName: classDetails.displayName,
            tuitionFee: classDetails.tuitionFee,
            textBookFee: classDetails.textBookFee,
            noteBookFee: classDetails.noteBookFee,
            diaryFee: classDetails.diaryFee,
            academicYearId: classDetails.academicYearId,
            academicYear: classDetails.academicYear.name,
            isCompleted: classDetails.isCompleted,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EDIT CLASS
============================================================ */
const editClassDetails = async (req, res) => {
    try {
        const { classNumber, displayName, tuitionFee, textBookFee, noteBookFee, diaryFee, academicYearId, schoolId, } = req.body;
        const resolvedSchoolId = getSchoolId(req) ?? schoolId;
        if (!resolvedSchoolId ||
            !classNumber) {
            return res.status(400).json({
                message: "schoolId and classNumber are required",
            });
        }
        /* --------------------------------------------------------
           Find class in current school
        -------------------------------------------------------- */
        const existingClass = await config_1.prisma.class.findFirst({
            where: {
                schoolId: resolvedSchoolId,
                classNumber,
                ...(academicYearId
                    ? { academicYearId }
                    : {}),
            },
        });
        if (!existingClass) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        /* --------------------------------------------------------
           If academic year is changing,
           make sure it belongs to same school
        -------------------------------------------------------- */
        if (academicYearId) {
            const academicYear = await config_1.prisma.academicYear.findFirst({
                where: {
                    id: academicYearId,
                    schoolId: resolvedSchoolId,
                },
            });
            if (!academicYear) {
                return res.status(400).json({
                    message: "Academic year not found for this school",
                });
            }
        }
        /* --------------------------------------------------------
           Update only supplied fields
        -------------------------------------------------------- */
        await config_1.prisma.class.update({
            where: {
                id: existingClass.id,
            },
            data: {
                ...(displayName !== undefined && {
                    displayName,
                }),
                ...(tuitionFee !== undefined && {
                    tuitionFee,
                }),
                ...(textBookFee !== undefined && {
                    textBookFee,
                }),
                ...(noteBookFee !== undefined && {
                    noteBookFee,
                }),
                ...(diaryFee !== undefined && {
                    diaryFee,
                }),
                ...(academicYearId !== undefined && {
                    academicYearId,
                }),
            },
        });
        return res.status(200).json({
            message: "Class details updated successfully.",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   MARK CLASS AS COMPLETED
============================================================ */
const markClassAsCompleted = async (req, res) => {
    const { classNumber, academicYearId, schoolId, } = req.body;
    const resolvedSchoolId = getSchoolId(req) ?? schoolId;
    if (!resolvedSchoolId ||
        !classNumber) {
        return res.status(400).json({
            message: "schoolId and classNumber are required",
        });
    }
    try {
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                schoolId: resolvedSchoolId,
                classNumber,
                ...(academicYearId
                    ? { academicYearId }
                    : {}),
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Source class doesn't exist",
            });
        }
        await config_1.prisma.class.update({
            where: {
                id: classDetails.id,
            },
            data: {
                isCompleted: true,
            },
        });
        return res.status(200).json({
            message: "Class marked as completed successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.classControllers = {
    createClass,
    getAllClasses,
    deleteClass,
    getClassDetails,
    editClassDetails,
    markClassAsCompleted,
};
