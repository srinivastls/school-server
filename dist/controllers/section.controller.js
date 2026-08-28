"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sectionControllers = void 0;
const config_1 = require("../config");
const utils_1 = require("../utils");
/* ============================================================
   HELPERS
============================================================ */
const getSchoolId = (req) => {
    return (req.user?.schoolId ??
        req.body?.schoolId ??
        req.query?.schoolId);
};
/* ============================================================
   COPY SECTIONS
============================================================ */
const copySectionsToAcademicYear = async (req, res) => {
    try {
        const { fromAcademicYearId, toAcademicYearId, } = req.body;
        const schoolId = getSchoolId(req);
        /* ========================================================
           VALIDATION
        ======================================================== */
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!fromAcademicYearId ||
            !toAcademicYearId) {
            return res.status(400).json({
                message: "fromAcademicYearId and toAcademicYearId are required",
            });
        }
        if (fromAcademicYearId ===
            toAcademicYearId) {
            return res.status(400).json({
                message: "Source and target academic years cannot be the same",
            });
        }
        /* ========================================================
           VERIFY ACADEMIC YEARS
        ======================================================== */
        const academicYears = await config_1.prisma.academicYear.findMany({
            where: {
                schoolId,
                id: {
                    in: [
                        fromAcademicYearId,
                        toAcademicYearId,
                    ],
                },
            },
            select: {
                id: true,
                name: true,
            },
        });
        if (academicYears.length !== 2) {
            return res.status(404).json({
                message: "One or both academic years were not found",
            });
        }
        /* ========================================================
           GET SOURCE CLASSES
        ======================================================== */
        const sourceClasses = await config_1.prisma.class.findMany({
            where: {
                schoolId,
                academicYearId: fromAcademicYearId,
            },
            select: {
                id: true,
                classNumber: true,
                displayName: true,
            },
        });
        if (sourceClasses.length === 0) {
            return res.status(404).json({
                message: "No classes found in source academic year",
            });
        }
        /* ========================================================
           GET TARGET CLASSES
        ======================================================== */
        const targetClasses = await config_1.prisma.class.findMany({
            where: {
                schoolId,
                academicYearId: toAcademicYearId,
            },
            select: {
                id: true,
                classNumber: true,
                displayName: true,
            },
        });
        if (targetClasses.length === 0) {
            return res.status(400).json({
                message: "Target academic year has no classes. Create or copy classes first.",
            });
        }
        /* ========================================================
           CREATE CLASS MAP
           
           source classNumber
                  ↓
           target classId
        ======================================================== */
        const targetClassMap = new Map();
        targetClasses.forEach(classDetails => {
            targetClassMap.set(classDetails.classNumber, classDetails.id);
        });
        /* ========================================================
           GET SOURCE SECTIONS
        ======================================================== */
        const sourceSections = await config_1.prisma.section.findMany({
            where: {
                schoolId,
                classId: {
                    in: sourceClasses.map(item => item.id),
                },
            },
            select: {
                id: true,
                classId: true,
                sectionName: true,
            },
            orderBy: [
                {
                    classId: "asc",
                },
                {
                    sectionName: "asc",
                },
            ],
        });
        if (sourceSections.length === 0) {
            return res.status(404).json({
                message: "No sections found in source academic year",
            });
        }
        /* ========================================================
           SOURCE CLASS MAP
        ======================================================== */
        const sourceClassMap = new Map();
        sourceClasses.forEach(classDetails => {
            sourceClassMap.set(classDetails.id, classDetails.classNumber);
        });
        /* ========================================================
           BUILD SECTIONS
        ======================================================== */
        const sectionsToCreate = [];
        const skippedSections = [];
        for (const sourceSection of sourceSections) {
            const classNumber = sourceClassMap.get(sourceSection.classId);
            if (!classNumber) {
                continue;
            }
            const targetClassId = targetClassMap.get(classNumber);
            /* ------------------------------------------------------
               Target class does not exist.
            ------------------------------------------------------ */
            if (!targetClassId) {
                skippedSections.push({
                    classNumber,
                    sectionName: sourceSection.sectionName,
                });
                continue;
            }
            sectionsToCreate.push({
                schoolId,
                classId: targetClassId,
                sectionName: sourceSection.sectionName,
            });
        }
        /* ========================================================
           REMOVE DUPLICATES
        ======================================================== */
        const uniqueSections = new Map();
        sectionsToCreate.forEach(section => {
            const key = `${section.classId}:${section.sectionName}`;
            uniqueSections.set(key, section);
        });
        const sections = Array.from(uniqueSections.values());
        /* ========================================================
           CREATE IN TRANSACTION
        ======================================================== */
        const result = await config_1.prisma.$transaction(async (tx) => {
            let createdCount = 0;
            let skippedCount = skippedSections.length;
            const createdSections = [];
            for (const section of sections) {
                /* ----------------------------------------------
                   Check whether already exists
                ---------------------------------------------- */
                const existing = await tx.section.findFirst({
                    where: {
                        schoolId,
                        classId: section.classId,
                        sectionName: section.sectionName,
                    },
                });
                if (existing) {
                    skippedCount++;
                    continue;
                }
                const created = await tx.section.create({
                    data: {
                        schoolId,
                        classId: section.classId,
                        sectionName: section.sectionName,
                        /*
                         * Do NOT copy classTeacherId.
                         *
                         * The teacher may not be available
                         * in the new academic year.
                         *
                         * Principal will assign teachers
                         * separately.
                         */
                        classTeacherId: null,
                    },
                    select: {
                        id: true,
                        classId: true,
                        sectionName: true,
                    },
                });
                createdSections.push(created);
                createdCount++;
            }
            return {
                createdCount,
                skippedCount,
                createdSections,
            };
        });
        /* ========================================================
           RESPONSE
        ======================================================== */
        return res.status(201).json({
            message: "Sections copied successfully",
            fromAcademicYearId,
            toAcademicYearId,
            createdCount: result.createdCount,
            skippedCount: result.skippedCount,
            sections: result.createdSections,
            skipped: skippedSections,
        });
    }
    catch (error) {
        console.error("COPY SECTIONS ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET SECTIONS FOR A CLASS
============================================================ */
const getSectionsByClass = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const { classId, } = req.query;
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!classId) {
            return res.status(400).json({
                message: "classId is required",
            });
        }
        /* ========================================================
           VERIFY CLASS BELONGS TO SCHOOL
        ======================================================== */
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                id: classId,
                schoolId,
            },
            select: {
                id: true,
                classNumber: true,
                displayName: true,
                academicYearId: true,
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        /* ========================================================
           GET SECTIONS
        ======================================================== */
        const sections = await config_1.prisma.section.findMany({
            where: {
                schoolId,
                classId,
            },
            select: {
                id: true,
                sectionName: true,
                classTeacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeId: true,
                        designation: true,
                    },
                },
                _count: {
                    select: {
                        students: true,
                    },
                },
            },
            orderBy: {
                sectionName: "asc",
            },
        });
        return res.status(200).json({
            class: {
                id: classDetails.id,
                classNumber: classDetails.classNumber,
                displayName: classDetails.displayName,
                academicYearId: classDetails.academicYearId,
            },
            sections: sections.map(section => ({
                id: section.id,
                sectionName: section.sectionName,
                classTeacher: section.classTeacher,
                totalStudents: section._count.students,
            })),
        });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   ASSIGN CLASS TEACHER
============================================================ */
const assignClassTeacher = async (req, res) => {
    try {
        const { sectionId, teacherUserId, } = req.body;
        const schoolId = getSchoolId(req);
        /* ========================================================
           VALIDATION
        ======================================================== */
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!sectionId) {
            return res.status(400).json({
                message: "sectionId is required",
            });
        }
        if (!teacherUserId) {
            return res.status(400).json({
                message: "teacherUserId is required",
            });
        }
        /* ========================================================
           FIND SECTION
        ======================================================== */
        const section = await config_1.prisma.section.findFirst({
            where: {
                id: sectionId,
                schoolId,
            },
            include: {
                class: {
                    select: {
                        id: true,
                        classNumber: true,
                        displayName: true,
                        academicYearId: true,
                    },
                },
            },
        });
        if (!section) {
            return res.status(404).json({
                message: "Section not found",
            });
        }
        /* ========================================================
           VERIFY TEACHER / PRINCIPAL
        ======================================================== */
        const teacher = await config_1.prisma.user.findFirst({
            where: {
                id: teacherUserId,
                schoolId,
                isActive: true,
                role: {
                    in: [
                        "TEACHER",
                        "PRINCIPAL",
                    ],
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                employeeId: true,
                designation: true,
                role: true,
            },
        });
        if (!teacher) {
            return res.status(404).json({
                message: "Active teacher or principal not found",
            });
        }
        /* ========================================================
           UPDATE SECTION
        ======================================================== */
        const updatedSection = await config_1.prisma.section.update({
            where: {
                id: section.id,
            },
            data: {
                classTeacherId: teacher.id,
            },
            select: {
                id: true,
                sectionName: true,
                classId: true,
                classTeacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        employeeId: true,
                        designation: true,
                        role: true,
                    },
                },
            },
        });
        /* ========================================================
           RESPONSE
        ======================================================== */
        return res.status(200).json({
            message: "Class teacher assigned successfully",
            section: updatedSection,
        });
    }
    catch (error) {
        console.error("ASSIGN CLASS TEACHER ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   REMOVE CLASS TEACHER
============================================================ */
const removeClassTeacher = async (req, res) => {
    try {
        const { sectionId, } = req.body;
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!sectionId) {
            return res.status(400).json({
                message: "sectionId is required",
            });
        }
        /* ========================================================
           VERIFY SECTION
        ======================================================== */
        const section = await config_1.prisma.section.findFirst({
            where: {
                id: sectionId,
                schoolId,
            },
            select: {
                id: true,
                sectionName: true,
                classId: true,
            },
        });
        if (!section) {
            return res.status(404).json({
                message: "Section not found",
            });
        }
        /* ========================================================
           REMOVE TEACHER
        ======================================================== */
        const updatedSection = await config_1.prisma.section.update({
            where: {
                id: section.id,
            },
            data: {
                classTeacherId: null,
            },
            select: {
                id: true,
                sectionName: true,
                classId: true,
                classTeacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeId: true,
                        designation: true,
                        role: true,
                    },
                },
            },
        });
        return res.status(200).json({
            message: "Class teacher removed successfully",
            section: updatedSection,
        });
    }
    catch (error) {
        console.error("REMOVE CLASS TEACHER ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   GET AVAILABLE CLASS TEACHERS
============================================================ */
const getAvailableClassTeachers = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        const users = await config_1.prisma.user.findMany({
            where: {
                schoolId,
                isActive: true,
                role: {
                    in: [
                        "TEACHER",
                        "PRINCIPAL",
                    ],
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                employeeId: true,
                designation: true,
                department: true,
                role: true,
                _count: {
                    select: {
                        classTeacherSections: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });
        return res.status(200).json({
            teachers: users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                employeeId: user.employeeId,
                designation: user.designation,
                department: user.department,
                role: user.role,
                assignedSections: user._count
                    .classTeacherSections,
            })),
        });
    }
    catch (error) {
        console.error("GET AVAILABLE CLASS TEACHERS ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
const getStudentsBySection = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const sectionId = req.params.sectionId;
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!sectionId) {
            return res.status(400).json({
                message: "sectionId is required",
            });
        }
        const section = await config_1.prisma.section.findFirst({
            where: {
                id: sectionId,
                schoolId,
            },
            select: {
                id: true,
                sectionName: true,
                classId: true,
            },
        });
        if (!section) {
            return res.status(404).json({
                message: "Section not found",
            });
        }
        const students = await config_1.prisma.student.findMany({
            where: {
                classId: section.classId,
                sectionId: section.id,
            },
            select: {
                id: true,
                admissionNo: true,
                name: true,
            },
        });
        return res.status(200).json({
            section,
            students,
        });
    }
    catch (error) {
        console.error("GET STUDENTS BY SECTION ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
const createSection = async (req, res) => {
    try {
        const { classId, sectionName, } = req.body;
        const schoolId = getSchoolId(req);
        /* ========================================================
           VALIDATION
        ======================================================== */
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!classId) {
            return res.status(400).json({
                message: "classId is required",
            });
        }
        const cleanedSectionName = sectionName?.trim();
        if (!cleanedSectionName) {
            return res.status(400).json({
                message: "sectionName is required",
            });
        }
        /* ========================================================
           VERIFY CLASS
        ======================================================== */
        const classDetails = await config_1.prisma.class.findFirst({
            where: {
                id: classId,
                schoolId,
            },
            select: {
                id: true,
                classNumber: true,
                displayName: true,
                academicYearId: true,
                isCompleted: true,
            },
        });
        if (!classDetails) {
            return res.status(404).json({
                message: "Class not found",
            });
        }
        /* ========================================================
           PREVENT ADDING TO COMPLETED CLASS
        ======================================================== */
        if (classDetails.isCompleted) {
            return res.status(400).json({
                message: "Cannot add section to a completed class",
            });
        }
        /* ========================================================
           DUPLICATE SECTION
        ======================================================== */
        const existingSection = await config_1.prisma.section.findFirst({
            where: {
                schoolId,
                classId,
                sectionName: cleanedSectionName,
            },
            select: {
                id: true,
            },
        });
        if (existingSection) {
            return res.status(409).json({
                message: "Section already exists in this class",
            });
        }
        /* ========================================================
           CREATE
        ======================================================== */
        const section = await config_1.prisma.section.create({
            data: {
                schoolId,
                classId,
                sectionName: cleanedSectionName,
                /*
                 * New sections do not have a
                 * class teacher initially.
                 *
                 * Principal can assign one later.
                 */
                classTeacherId: null,
            },
            select: {
                id: true,
                sectionName: true,
                classId: true,
                classTeacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        employeeId: true,
                        designation: true,
                        role: true,
                    },
                },
                _count: {
                    select: {
                        students: true,
                    },
                },
            },
        });
        /* ========================================================
           RESPONSE
        ======================================================== */
        return res.status(201).json({
            message: "Section created successfully",
            section: {
                id: section.id,
                sectionName: section.sectionName,
                classId: section.classId,
                classTeacher: section.classTeacher,
                totalStudents: section._count.students,
            },
        });
    }
    catch (error) {
        console.error("CREATE SECTION ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.sectionControllers = {
    createSection,
    copySectionsToAcademicYear,
    getSectionsByClass,
    getStudentsBySection,
    assignClassTeacher,
    removeClassTeacher,
    getAvailableClassTeachers,
};
