"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherControllers = void 0;
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
const getTeacherUserId = (req) => {
    return req.user?.id;
};
/* ============================================================
   GET MY CLASSES
============================================================ */
const getMyClasses = async (req, res) => {
    try {
        const schoolId = getSchoolId(req);
        const teacherUserId = getTeacherUserId(req);
        /* --------------------------------------------------------
           VALIDATION
        -------------------------------------------------------- */
        if (!schoolId) {
            return res.status(400).json({
                message: "schoolId is required",
            });
        }
        if (!teacherUserId) {
            return res.status(401).json({
                message: "Teacher user id is required",
            });
        }
        /* --------------------------------------------------------
           ACADEMIC YEAR
        -------------------------------------------------------- */
        const requestedAcademicYearId = String(req.query?.academicYearId ?? "").trim();
        let academicYearId = requestedAcademicYearId;
        if (!academicYearId) {
            const currentAcademicYear = await config_1.prisma.academicYear.findFirst({
                where: {
                    schoolId,
                    isCurrent: true,
                },
                select: {
                    id: true,
                    name: true,
                    startDate: true,
                    endDate: true,
                },
            });
            if (!currentAcademicYear) {
                return res.status(404).json({
                    message: "Current academic year not found",
                });
            }
            academicYearId =
                currentAcademicYear.id;
        }
        /* --------------------------------------------------------
           VERIFY ACADEMIC YEAR
        -------------------------------------------------------- */
        const academicYear = await config_1.prisma.academicYear.findFirst({
            where: {
                id: academicYearId,
                schoolId,
            },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                isCurrent: true,
            },
        });
        if (!academicYear) {
            return res.status(404).json({
                message: "Academic year not found",
            });
        }
        /* ========================================================
           1. SUBJECT MAPPINGS
           
           Classes / sections where this teacher
           teaches a subject.
        ======================================================== */
        const teacherMappings = await config_1.prisma.teacherSubjectMapping.findMany({
            where: {
                schoolId,
                teacherUserId,
                academicYearId,
            },
            select: {
                id: true,
                subject: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        isOptional: true,
                    },
                },
                section: {
                    select: {
                        id: true,
                        sectionName: true,
                        class: {
                            select: {
                                id: true,
                                classNumber: true,
                                displayName: true,
                                academicYearId: true,
                            },
                        },
                    },
                },
            },
            orderBy: [
                {
                    section: {
                        class: {
                            classNumber: "asc",
                        },
                    },
                },
                {
                    section: {
                        sectionName: "asc",
                    },
                },
                {
                    subject: {
                        code: "asc",
                    },
                },
            ],
        });
        /* ========================================================
           2. CLASS TEACHER SECTIONS
           
           Sections where this teacher is the
           class teacher.
        ======================================================== */
        const classTeacherSections = await config_1.prisma.section.findMany({
            where: {
                schoolId,
                classTeacherId: teacherUserId,
                class: {
                    academicYearId,
                },
            },
            select: {
                id: true,
                sectionName: true,
                class: {
                    select: {
                        id: true,
                        classNumber: true,
                        displayName: true,
                        academicYearId: true,
                    },
                },
            },
            orderBy: [
                {
                    class: {
                        classNumber: "asc",
                    },
                },
                {
                    sectionName: "asc",
                },
            ],
        });
        /* ========================================================
           COLLECT SECTION IDS
        ======================================================== */
        const sectionIds = new Set();
        teacherMappings.forEach((mapping) => {
            sectionIds.add(mapping.section.id);
        });
        classTeacherSections.forEach((section) => {
            sectionIds.add(section.id);
        });
        /* ========================================================
           NO ASSIGNMENTS
        ======================================================== */
        if (sectionIds.size === 0) {
            return res.status(200).json({
                academicYear,
                classes: [],
                summary: {
                    totalClasses: 0,
                    totalSections: 0,
                    totalStudents: 0,
                    totalSubjects: 0,
                    classTeacherSections: 0,
                    subjectTeachingSections: 0,
                },
            });
        }
        /* ========================================================
           STUDENT COUNTS
    
           Use StudentAcademicEnrollment because student
           placement is academic-year specific.
        ======================================================== */
        const enrollments = await config_1.prisma.studentAcademicEnrollment.findMany({
            where: {
                schoolId,
                academicYearId,
                sectionId: {
                    in: Array.from(sectionIds),
                },
                enrollmentStatus: {
                    not: "LEFT",
                },
            },
            select: {
                studentId: true,
                classId: true,
                sectionId: true,
            },
        });
        /* ========================================================
           BUILD SECTION DATA
        ======================================================== */
        const sectionMap = new Map();
        /* --------------------------------------------------------
           ADD CLASS TEACHER SECTIONS
        -------------------------------------------------------- */
        classTeacherSections.forEach((section) => {
            sectionMap.set(section.id, {
                id: section.id,
                sectionName: section.sectionName,
                classId: section.class.id,
                classNumber: section.class.classNumber,
                displayName: section.class.displayName,
                totalStudents: 0,
                isClassTeacher: true,
                subjects: [],
            });
        });
        /* --------------------------------------------------------
           ADD SUBJECT TEACHING SECTIONS
        -------------------------------------------------------- */
        teacherMappings.forEach((mapping) => {
            const section = mapping.section;
            let existing = sectionMap.get(section.id);
            if (!existing) {
                existing = {
                    id: section.id,
                    sectionName: section.sectionName,
                    classId: section.class.id,
                    classNumber: section.class.classNumber,
                    displayName: section.class.displayName,
                    totalStudents: 0,
                    isClassTeacher: false,
                    subjects: [],
                };
                sectionMap.set(section.id, existing);
            }
            const alreadyAdded = existing.subjects.some((subject) => subject.id ===
                mapping.subject.id);
            if (!alreadyAdded) {
                existing.subjects.push({
                    id: mapping.subject.id,
                    name: mapping.subject.name,
                    code: mapping.subject.code,
                    isOptional: mapping.subject
                        .isOptional,
                });
            }
        });
        /* ========================================================
           STUDENT COUNTS
        ======================================================== */
        enrollments.forEach((enrollment) => {
            const section = sectionMap.get(enrollment.sectionId);
            if (section) {
                section.totalStudents++;
            }
        });
        /* ========================================================
           BUILD CLASS GROUPS
        ======================================================== */
        const classMap = new Map();
        Array.from(sectionMap.values()).forEach((section) => {
            let classItem = classMap.get(section.classId);
            if (!classItem) {
                classItem = {
                    id: section.classId,
                    classNumber: section.classNumber,
                    displayName: section.displayName,
                    academicYearId,
                    sections: [],
                    subjects: [],
                    totalStudents: 0,
                };
                classMap.set(section.classId, classItem);
            }
            classItem.sections.push(section);
            classItem.totalStudents +=
                section.totalStudents;
            section.subjects.forEach((subject) => {
                const exists = classItem.subjects.some((item) => item.id ===
                    subject.id);
                if (!exists) {
                    classItem.subjects.push(subject);
                }
            });
        });
        /* ========================================================
           SORT
        ======================================================== */
        const classes = Array.from(classMap.values()).sort((a, b) => a.classNumber.localeCompare(b.classNumber, undefined, {
            numeric: true,
        }));
        classes.forEach((classItem) => {
            classItem.sections.sort((a, b) => a.sectionName.localeCompare(b.sectionName));
            classItem.subjects.sort((a, b) => a.code.localeCompare(b.code));
        });
        /* ========================================================
           SUMMARY
        ======================================================== */
        const totalSections = Array.from(sectionMap.values()).length;
        const totalStudents = Array.from(sectionMap.values()).reduce((total, section) => total +
            section.totalStudents, 0);
        const totalSubjects = new Set(teacherMappings.map((mapping) => mapping.subject.id)).size;
        /* ========================================================
           RESPONSE
        ======================================================== */
        return res.status(200).json({
            academicYear,
            classes,
            summary: {
                totalClasses: classes.length,
                totalSections,
                totalStudents,
                totalSubjects,
                classTeacherSections: classTeacherSections.length,
                subjectTeachingSections: new Set(teacherMappings.map((mapping) => mapping.section.id)).size,
            },
        });
    }
    catch (error) {
        console.error("GET MY CLASSES ERROR:", error);
        return (0, utils_1.handleErr)(error, res);
    }
};
/* ============================================================
   EXPORT
============================================================ */
exports.teacherControllers = {
    getMyClasses,
};
