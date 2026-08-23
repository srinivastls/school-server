"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classMiddleWares = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return req.user?.schoolId ?? req.body?.schoolId;
};
/* ============================================================
   CHECK DUPLICATE CLASS
============================================================ */
const checkDuplicateClass = async (req, res, next) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { classNumber, academicYearId, } = req.body;
        if (!classNumber) {
            return res.status(400).json({
                message: "classNumber is required",
            });
        }
        /*
         * New schema:
         *
         * @@unique([
         *   schoolId,
         *   academicYearId,
         *   classNumber
         * ])
         *
         * Therefore classNumber alone is NOT unique.
         */
        if (!academicYearId) {
            return res.status(400).json({
                message: "academicYearId is required",
            });
        }
        const oldClass = await config_1.prisma.class.findUnique({
            where: {
                schoolId_academicYearId_classNumber: {
                    schoolId,
                    academicYearId,
                    classNumber,
                },
            },
        });
        if (oldClass) {
            return res.status(400).json({
                message: "Class already exists",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   CHECK CLASS EXISTS
============================================================ */
const checkClassExists = async (req, res, next) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const { classNumber, academicYearId, } = req.body;
        if (!classNumber) {
            return res.status(400).json({
                message: "classNumber is required",
            });
        }
        if (!academicYearId) {
            return res.status(400).json({
                message: "academicYearId is required",
            });
        }
        const oldClass = await config_1.prisma.class.findUnique({
            where: {
                schoolId_academicYearId_classNumber: {
                    schoolId,
                    academicYearId,
                    classNumber,
                },
            },
        });
        if (!oldClass) {
            return res.status(400).json({
                message: "Class doesn't exist",
            });
        }
        next();
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.classMiddleWares = {
    checkDuplicateClass,
    checkClassExists,
};
