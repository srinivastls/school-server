"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicYearControllers = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const getSchoolId = (req) => {
    return req.user?.schoolId ?? req.body?.schoolId;
};
const getAcademicYears = async (req, res) => {
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
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                isCurrent: true,
            },
            orderBy: {
                startDate: "desc",
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
exports.academicYearControllers = {
    getAcademicYears,
};
