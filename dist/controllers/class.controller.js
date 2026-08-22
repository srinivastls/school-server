"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classControllers = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
const createClass = async (req, res) => {
    try {
        const { classNumber, tuitionFee, textBookFee, noteBookFee, year, diary, } = req.body;
        if (!classNumber ||
            !tuitionFee ||
            !textBookFee ||
            !noteBookFee ||
            !year ||
            !diary) {
            return res
                .status(400)
                .json({ message: "Some fields are missing in request body" });
        }
        await config_1.prisma.class.create({
            data: {
                classNumber,
                tuitionFee,
                textBookFee,
                noteBookFee,
                year,
                diary,
            },
        });
        return res.json({
            message: "Class created successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const getAllClasses = async (req, res) => {
    try {
        const classes = await config_1.prisma.class.findMany();
        const classList = [];
        classes.forEach((classDetails) => {
            const { classNumber, tuitionFee, textBookFee, noteBookFee, year, diary, } = classDetails;
            if (!classNumber.includes("COMPLETED")) {
                classList.push({
                    classNumber,
                    tuitionFee,
                    textBookFee,
                    noteBookFee,
                    year,
                    diary,
                });
            }
        });
        classList.sort((a, b) => {
            return +a.classNumber - +b.classNumber;
        });
        return res.status(200).json({
            classes: classList,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const deleteClass = async (req, res) => {
    try {
        if (!req.body.classNumber) {
            return res.status(400).json({
                message: "classNumber missing in request body",
            });
        }
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                classNumber: req.body.classNumber,
            },
            include: {
                students: true,
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Class doesn't exist",
            });
        }
        // Prevent deletion if students belong to this class
        if (classDetails.students.length > 0) {
            return res.status(400).json({
                message: "Cannot delete class because it has students",
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
const getClassDetails = async (req, res) => {
    try {
        if (!req.query.classNumber) {
            return res.status(400).json({
                message: "classNumber missing in request query parameter",
            });
        }
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                classNumber: req.query.classNumber,
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        const { classNumber, tuitionFee, textBookFee, noteBookFee, year, diary, } = classDetails;
        return res.status(200).json({
            classNumber,
            tuitionFee,
            textBookFee,
            noteBookFee,
            year,
            diary,
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
const editClassDetails = async (req, res) => {
    try {
        const existingClass = await config_1.prisma.class.findFirst({
            where: {
                classNumber: req.body.classNumber,
            },
        });
        if (!existingClass) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        await config_1.prisma.class.update({
            where: {
                id: existingClass.id,
            },
            data: {
                ...req.body,
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
const markClassAsCompleted = async (req, res) => {
    const { classNumber } = req.body;
    if (!classNumber) {
        return res.status(400).json({
            message: "Request body is missing some params",
        });
    }
    try {
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                classNumber,
            },
        });
        if (!classDetails) {
            return res.status(400).json({
                message: "Source class doesn't exist",
            });
        }
        const newClassName = `${classNumber}-${classDetails.year}-COMPLETED`;
        await config_1.prisma.class.update({
            where: {
                id: classDetails.id,
            },
            data: {
                classNumber: newClassName,
            },
        });
        return res.status(200).json({
            message: "Class emptied successfully",
        });
    }
    catch (err) {
        return (0, utils_1.handleErr)(err, res);
    }
};
exports.classControllers = {
    createClass,
    getAllClasses,
    deleteClass,
    getClassDetails,
    editClassDetails,
    markClassAsCompleted,
};
