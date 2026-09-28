"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAcademicYearDeletionPreview = getAcademicYearDeletionPreview;
exports.exportSchool = exportSchool;
exports.runAutomaticSchoolBackup = runAutomaticSchoolBackup;
exports.cleanupOldAutomaticBackups = cleanupOldAutomaticBackups;
exports.exportAcademicYear = exportAcademicYear;
exports.archiveSchool = archiveSchool;
exports.restoreSchool = restoreSchool;
exports.deleteAcademicYear = deleteAcademicYear;
exports.deleteSchool = deleteSchool;
exports.getOperation = getOperation;
exports.getSchoolOperations = getSchoolOperations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const util_1 = require("util");
const config_1 = require("../config");
const googleDrive_service_1 = require("./googleDrive.service");
// ============================================================
// FILESYSTEM
// ============================================================
const mkdir = (0, util_1.promisify)(fs_1.default.mkdir);
const EXPORT_DIR = process.env.SCHOOL_EXPORT_DIR ||
    path_1.default.join(process.cwd(), "storage", "school-exports");
// ============================================================
// ARCHIVER
// ============================================================
//
// Keep archiver at v5.x for this CommonJS TypeScript project.
//
// npm install archiver@5.3.2
// npm install -D @types/archiver
//
// ============================================================
const archiver = require("archiver");
// ============================================================
// HELPERS
// ============================================================
function jsonSafe(value) {
    return JSON.parse(JSON.stringify(value, (_key, current) => typeof current === "bigint"
        ? current.toString()
        : current));
}
function quoteIdentifier(identifier) {
    if (identifier.startsWith('"') &&
        identifier.endsWith('"')) {
        return identifier;
    }
    return `"${identifier}"`;
}
/**
 * PostgreSQL parameter placeholders for TEXT values.
 *
 * All normal IDs in your schema are text.
 *
 * Examples:
 *   $1::text
 *   $2::text
 *   $3::text
 */
function textPlaceholders(count, startAt = 1) {
    return Array.from({ length: count }, (_, index) => `$${startAt + index}::text`).join(", ");
}
/**
 * PostgreSQL parameter placeholder for SCHOOL UUID.
 *
 * school_id columns in your schema are UUID.
 */
function uuidPlaceholder(index) {
    return `$${index}::uuid`;
}
// ============================================================
// RAW QUERY HELPERS
// ============================================================
async function queryRows(sql, ...params) {
    return (await config_1.prisma.$queryRawUnsafe(sql, ...params));
}
async function queryCount(sql, ...params) {
    const rows = await queryRows(sql, ...params);
    return Number(rows[0]?.count ?? 0);
}
/**
 * Query records where a TEXT column matches TEXT ids.
 *
 * This fixes:
 *
 *   text = uuid
 *
 * errors.
 */
async function rowsByTextIds(table, column, ids) {
    if (!ids.length) {
        return [];
    }
    const placeholders = textPlaceholders(ids.length);
    const sql = `
    SELECT *
    FROM ${quoteIdentifier(table)}
    WHERE ${quoteIdentifier(column)}
      IN (${placeholders})
  `;
    return queryRows(sql, ...ids);
}
/**
 * Query records by one school UUID.
 */
async function rowsBySchoolId(table, schoolId) {
    const sql = `
    SELECT *
    FROM ${quoteIdentifier(table)}
    WHERE "school_id" = $1::uuid
  `;
    return queryRows(sql, schoolId);
}
// ============================================================
// ZIP
// ============================================================
async function writeZip(outputPath, files) {
    await mkdir(path_1.default.dirname(outputPath), {
        recursive: true,
    });
    return new Promise((resolve, reject) => {
        const output = fs_1.default.createWriteStream(outputPath);
        const archive = archiver("zip", {
            zlib: {
                level: 9,
            },
        });
        output.on("close", () => resolve());
        output.on("error", reject);
        archive.on("error", reject);
        archive.pipe(output);
        for (const file of files) {
            archive.append(JSON.stringify(jsonSafe(file.data), null, 2), {
                name: file.name,
            });
        }
        archive.finalize().catch(reject);
    });
}
// ============================================================
// CHECKSUM
// ============================================================
function checksum(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto_1.default.createHash("sha256");
        const stream = fs_1.default.createReadStream(filePath);
        stream.on("data", (chunk) => {
            hash.update(chunk);
        });
        stream.on("error", reject);
        stream.on("end", () => {
            resolve(hash.digest("hex"));
        });
    });
}
// ============================================================
// OPERATIONS
// ============================================================
async function createOperation(data) {
    return config_1.prisma.schoolDataOperation.create({
        data,
    });
}
async function markFailed(operationId, error) {
    await config_1.prisma.schoolDataOperation
        .update({
        where: {
            id: operationId,
        },
        data: {
            status: "FAILED",
            errorMessage: error instanceof Error
                ? error.message
                : String(error),
        },
    })
        .catch(() => undefined);
}
// ============================================================
// FULL SCHOOL EXPORT
// ============================================================
async function collectFullSchoolData(schoolId) {
    const result = {};
    // ----------------------------------------------------------
    // SCHOOL
    // ----------------------------------------------------------
    result.schools =
        await queryRows(`
      SELECT *
      FROM "schools"
      WHERE "id" = $1::uuid
      `, schoolId);
    // ----------------------------------------------------------
    // ACADEMIC YEARS
    //
    // school_id = UUID
    // ----------------------------------------------------------
    result.academic_years =
        await rowsBySchoolId("academic_years", schoolId);
    // ----------------------------------------------------------
    // USERS
    // ----------------------------------------------------------
    result.users =
        await rowsBySchoolId("users", schoolId);
    // Never export passwords.
    //
    // The schema calls the field password_hash.
    // ----------------------------------------------------------
    if (Array.isArray(result.users)) {
        result.users =
            result.users.map((user) => {
                const copy = {
                    ...user,
                };
                delete copy.password_hash;
                delete copy.passwordHash;
                return copy;
            });
    }
    // ----------------------------------------------------------
    // CLASSES
    //
    // IMPORTANT:
    // Actual table = "classes"
    //
    // school_id = UUID
    // academic_year_id = TEXT
    // ----------------------------------------------------------
    result.classes =
        await rowsBySchoolId("classes", schoolId);
    // ----------------------------------------------------------
    // SECTIONS
    //
    // school_id = UUID
    // ----------------------------------------------------------
    result.sections =
        await rowsBySchoolId("sections", schoolId);
    // ----------------------------------------------------------
    // SUBJECTS
    // ----------------------------------------------------------
    result.subjects =
        await rowsBySchoolId("subjects", schoolId);
    // ----------------------------------------------------------
    // TEACHER SUBJECT MAPPINGS
    // ----------------------------------------------------------
    result.teacher_subject_mappings =
        await rowsBySchoolId("teacher_subject_mappings", schoolId);
    // ----------------------------------------------------------
    // STUDENTS
    // ----------------------------------------------------------
    result.students =
        await rowsBySchoolId("students", schoolId);
    // ----------------------------------------------------------
    // STUDENT PARENT LINKS
    //
    // This table has NO school_id.
    //
    // We therefore locate links through students/users.
    // ----------------------------------------------------------
    result.student_parent_links =
        await queryRows(`
      SELECT *
      FROM "student_parent_links"
      WHERE
        "studentId" IN (
          SELECT "id"
          FROM "students"
          WHERE "school_id" = $1::uuid
        )
        OR
        "parentUserId" IN (
          SELECT "id"
          FROM "users"
          WHERE "school_id" = $1::uuid
        )
      `, schoolId);
    // ----------------------------------------------------------
    // COUPONS
    // ----------------------------------------------------------
    result.coupons =
        await rowsBySchoolId("coupons", schoolId);
    // ----------------------------------------------------------
    // TRANSACTIONS
    // ----------------------------------------------------------
    result.transactions =
        await rowsBySchoolId("transactions", schoolId);
    // ----------------------------------------------------------
    // ATTENDANCES
    // ----------------------------------------------------------
    result.attendances =
        await rowsBySchoolId("attendances", schoolId);
    // ----------------------------------------------------------
    // TEACHER ATTENDANCES
    // ----------------------------------------------------------
    result.teacher_attendances =
        await rowsBySchoolId("teacher_attendances", schoolId);
    // ----------------------------------------------------------
    // EXAMS
    // ----------------------------------------------------------
    result.exams =
        await rowsBySchoolId("exams", schoolId);
    // ----------------------------------------------------------
    // EXAM SUBJECTS
    //
    // This table does NOT have school_id.
    //
    // Find it through the school's exams.
    // ----------------------------------------------------------
    const examIds = result.exams.map((row) => String(row.id));
    result.exam_subjects =
        examIds.length
            ? await rowsByTextIds("exam_subjects", "examId", examIds)
            : [];
    // ----------------------------------------------------------
    // MARKS
    // ----------------------------------------------------------
    result.marks =
        await rowsBySchoolId("marks", schoolId);
    // ----------------------------------------------------------
    // COMPLAINTS
    // ----------------------------------------------------------
    result.complaints =
        await rowsBySchoolId("complaints", schoolId);
    // ----------------------------------------------------------
    // LEAVE REQUESTS
    // ----------------------------------------------------------
    result.leave_requests =
        await rowsBySchoolId("leave_requests", schoolId);
    // ----------------------------------------------------------
    // TIMETABLES
    // ----------------------------------------------------------
    result.timetables =
        await rowsBySchoolId("timetables", schoolId);
    // ----------------------------------------------------------
    // EXAM TIMETABLES
    // ----------------------------------------------------------
    result.exam_timetables =
        await rowsBySchoolId("exam_timetables", schoolId);
    // ----------------------------------------------------------
    // ANNOUNCEMENTS
    // ----------------------------------------------------------
    result.announcements =
        await rowsBySchoolId("announcements", schoolId);
    // ----------------------------------------------------------
    // NOTIFICATIONS
    // ----------------------------------------------------------
    result.notifications =
        await rowsBySchoolId("notifications", schoolId);
    // ----------------------------------------------------------
    // TRANSFER CERTIFICATES
    // ----------------------------------------------------------
    result.transfer_certificates =
        await rowsBySchoolId("transfer_certificates", schoolId);
    // ----------------------------------------------------------
    // ID CARD TEMPLATES
    // ----------------------------------------------------------
    result.id_card_templates =
        await rowsBySchoolId("id_card_templates", schoolId);
    // ----------------------------------------------------------
    // ID CARDS
    // ----------------------------------------------------------
    result.id_cards =
        await rowsBySchoolId("id_cards", schoolId);
    // ----------------------------------------------------------
    // AUDIT LOGS
    // ----------------------------------------------------------
    result.audit_logs =
        await rowsBySchoolId("audit_logs", schoolId);
    // ----------------------------------------------------------
    // SCHOOL ONBOARDING LOGS
    // ----------------------------------------------------------
    result.school_onboarding_logs =
        await rowsBySchoolId("school_onboarding_logs", schoolId);
    // ----------------------------------------------------------
    // STUDENT PROMOTIONS
    // ----------------------------------------------------------
    result.student_promotions =
        await rowsBySchoolId("student_promotions", schoolId);
    // ----------------------------------------------------------
    // BULK IMPORT SESSIONS
    // ----------------------------------------------------------
    result.bulk_import_sessions =
        await rowsBySchoolId("bulk_import_sessions", schoolId);
    return result;
}
// ============================================================
// ACADEMIC YEAR EXPORT
// ============================================================
async function collectAcademicYearData(schoolId, academicYearId) {
    // ==========================================================
    // IMPORTANT DATABASE TYPES
    //
    // school_id            -> UUID
    //
    // academic year id     -> TEXT
    // class id             -> TEXT
    // section id           -> TEXT
    // subject id            -> TEXT
    // student id            -> TEXT
    // exam id               -> TEXT
    // examSubject id        -> TEXT
    //
    // Therefore:
    //
    // schoolId       => $n::uuid
    // everything else => $n::text
    // ==========================================================
    // ----------------------------------------------------------
    // ACADEMIC YEAR
    // ----------------------------------------------------------
    const yearRows = await queryRows(`
      SELECT *
      FROM "academic_years"
      WHERE
        "id" = $1::text
        AND "school_id" = $2::uuid
      `, academicYearId, schoolId);
    if (!yearRows.length) {
        throw new Error("Academic year not found for this school");
    }
    const year = yearRows[0];
    const yearName = String(year.name ?? "");
    // ----------------------------------------------------------
    // CLASSES
    //
    // classes.academic_year_id = TEXT
    // classes.school_id = UUID
    // ----------------------------------------------------------
    const classes = await queryRows(`
      SELECT *
      FROM "classes"
      WHERE
        "school_id" = $1::uuid
        AND "academic_year_id" = $2::text
      `, schoolId, academicYearId);
    const classIds = classes.map((row) => String(row.id));
    // ----------------------------------------------------------
    // SECTIONS
    //
    // sections.class_id = TEXT
    // ----------------------------------------------------------
    const sections = await rowsByTextIds("sections", "class_id", classIds);
    const sectionIds = sections.map((row) => String(row.id));
    // ----------------------------------------------------------
    // SUBJECTS
    //
    // subjects.classId = TEXT
    // ----------------------------------------------------------
    const subjects = await rowsByTextIds("subjects", "classId", classIds);
    // ----------------------------------------------------------
    // EXAMS
    //
    // exams.school_id = UUID
    // exams.academicYearId = TEXT
    // ----------------------------------------------------------
    const exams = await queryRows(`
      SELECT *
      FROM "exams"
      WHERE
        "school_id" = $1::uuid
        AND "academicYearId" = $2::text
      `, schoolId, academicYearId);
    const examIds = exams.map((row) => String(row.id));
    // ----------------------------------------------------------
    // EXAM SUBJECTS
    //
    // exam_subjects.examId = TEXT
    // ----------------------------------------------------------
    const examSubjects = await rowsByTextIds("exam_subjects", "examId", examIds);
    const examSubjectIds = examSubjects.map((row) => String(row.id));
    // ----------------------------------------------------------
    // STUDENT ACADEMIC ENROLLMENTS
    //
    // schoolId = UUID
    // academicYearId = TEXT
    // ----------------------------------------------------------
    const enrollments = await queryRows(`
      SELECT *
      FROM "StudentAcademicEnrollment"
      WHERE
        "schoolId" = $1::uuid
        AND "academicYearId" = $2::text
      `, schoolId, academicYearId);
    const studentIds = [
        ...new Set(enrollments.map((row) => String(row.studentId))),
    ];
    // ----------------------------------------------------------
    // TEACHER SUBJECT MAPPINGS
    //
    // IMPORTANT:
    //
    // DB column is:
    //
    // "academicYearId"
    //
    // NOT:
    //
    // "academic_year_id"
    // ----------------------------------------------------------
    const teacherSubjectMappings = await queryRows(`
      SELECT *
      FROM "teacher_subject_mappings"
      WHERE
        "school_id" = $1::uuid
        AND "academicYearId" = $2::text
      `, schoolId, academicYearId);
    // ----------------------------------------------------------
    // ATTENDANCES
    //
    // DB column:
    // academic_year_id
    // ----------------------------------------------------------
    const attendances = await queryRows(`
      SELECT *
      FROM "attendances"
      WHERE
        "school_id" = $1::uuid
        AND "academic_year_id" = $2::text
      `, schoolId, academicYearId);
    // ----------------------------------------------------------
    // MARKS
    //
    // marks.examSubjectId = TEXT
    // ----------------------------------------------------------
    const marks = await rowsByTextIds("marks", "examSubjectId", examSubjectIds);
    // ----------------------------------------------------------
    // EXAM TIMETABLES
    //
    // exam_timetables.examId = TEXT
    // ----------------------------------------------------------
    const examTimetables = await rowsByTextIds("exam_timetables", "examId", examIds);
    // ----------------------------------------------------------
    // ID CARDS
    //
    // id_cards.academicYearId = TEXT
    // ----------------------------------------------------------
    const idCards = await queryRows(`
      SELECT *
      FROM "id_cards"
      WHERE
        "school_id" = $1::uuid
        AND "academicYearId" = $2::text
      `, schoolId, academicYearId);
    // ----------------------------------------------------------
    // STUDENT PROMOTIONS
    //
    // from_academic_year_id = TEXT
    // to_academic_year_id = TEXT
    // ----------------------------------------------------------
    const studentPromotions = await queryRows(`
      SELECT *
      FROM "student_promotions"
      WHERE
        "school_id" = $1::uuid
        AND (
          "from_academic_year_id" = $2::text
          OR
          "to_academic_year_id" = $2::text
        )
      `, schoolId, academicYearId);
    // ----------------------------------------------------------
    // TIMETABLES
    //
    // IMPORTANT:
    //
    // Timetable has "academicYear" as a STRING,
    // not academicYearId.
    // ----------------------------------------------------------
    const timetables = await queryRows(`
      SELECT *
      FROM "timetables"
      WHERE
        "school_id" = $1::uuid
        AND "academicYear" = $2::text
      `, schoolId, yearName);
    // ----------------------------------------------------------
    // STUDENTS
    //
    // We use enrollment student IDs.
    // ----------------------------------------------------------
    const students = studentIds.length
        ? await rowsByTextIds("students", "id", studentIds)
        : [];
    // ----------------------------------------------------------
    // STUDENT PARENT LINKS
    // ----------------------------------------------------------
    const studentParentLinks = studentIds.length
        ? await queryRows(`
          SELECT *
          FROM "student_parent_links"
          WHERE "studentId" IN (
            ${textPlaceholders(studentIds.length)}
          )
          `, ...studentIds)
        : [];
    // ----------------------------------------------------------
    // COUPONS
    //
    // Coupons attached to classes in this year.
    // ----------------------------------------------------------
    const coupons = classIds.length
        ? await rowsByTextIds("coupons", "class_id", classIds)
        : [];
    // ----------------------------------------------------------
    // SCHOOL
    // ----------------------------------------------------------
    const schools = await queryRows(`
      SELECT *
      FROM "schools"
      WHERE "id" = $1::uuid
      `, schoolId);
    // ----------------------------------------------------------
    // RESULT
    // ----------------------------------------------------------
    const result = {
        schools,
        academic_years: yearRows,
        classes,
        sections,
        subjects,
        StudentAcademicEnrollment: enrollments,
        teacher_subject_mappings: teacherSubjectMappings,
        attendances,
        exams,
        exam_subjects: examSubjects,
        marks,
        exam_timetables: examTimetables,
        id_cards: idCards,
        student_promotions: studentPromotions,
        timetables,
        students,
        student_parent_links: studentParentLinks,
        coupons,
    };
    return {
        yearName,
        data: result,
    };
}
// ============================================================
// ACADEMIC YEAR DELETE PREVIEW
// ============================================================
async function previewAcademicYearDeletion(schoolId, academicYearId) {
    // ----------------------------------------------------------
    // YEAR
    // ----------------------------------------------------------
    const year = await queryRows(`
      SELECT *
      FROM "academic_years"
      WHERE
        "id" = $1::text
        AND "school_id" = $2::uuid
      `, academicYearId, schoolId);
    if (!year.length) {
        throw new Error("Academic year not found for this school");
    }
    if (year[0].is_current) {
        throw new Error("The current academic year cannot be deleted");
    }
    // ----------------------------------------------------------
    // CLASSES
    // ----------------------------------------------------------
    const classes = await queryRows(`
      SELECT "id"
      FROM "classes"
      WHERE
        "school_id" = $1::uuid
        AND "academic_year_id" = $2::text
      `, schoolId, academicYearId);
    const classIds = classes.map((row) => String(row.id));
    // ----------------------------------------------------------
    // SECTIONS
    // ----------------------------------------------------------
    const sections = classIds.length
        ? await queryRows(`
          SELECT "id"
          FROM "sections"
          WHERE
            "school_id" = $1::uuid
            AND "class_id" IN (
              ${textPlaceholders(classIds.length, 2)}
            )
          `, schoolId, ...classIds)
        : [];
    const sectionIds = sections.map((row) => String(row.id));
    // ----------------------------------------------------------
    // STUDENT COUNT
    // ----------------------------------------------------------
    const studentCount = classIds.length
        ? await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "students"
          WHERE
            "school_id" = $1::uuid
            AND "class_id" IN (
              ${textPlaceholders(classIds.length, 2)}
            )
          `, schoolId, ...classIds)
        : 0;
    // ----------------------------------------------------------
    // COUPON COUNT
    // ----------------------------------------------------------
    const couponCount = classIds.length
        ? await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "coupons"
          WHERE
            "school_id" = $1::uuid
            AND "class_id" IN (
              ${textPlaceholders(classIds.length, 2)}
            )
          `, schoolId, ...classIds)
        : 0;
    // ----------------------------------------------------------
    // STUDENTS USING YEAR COUPONS
    // ----------------------------------------------------------
    const couponStudentCount = classIds.length
        ? await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "students"
          WHERE
            "school_id" = $1::uuid
            AND "coupon_id" IN (
              SELECT "id"
              FROM "coupons"
              WHERE
                "school_id" = $1::uuid
                AND "class_id" IN (
                  ${textPlaceholders(classIds.length, 2)}
                )
            )
          `, schoolId, ...classIds)
        : 0;
    // ----------------------------------------------------------
    // RESULT
    // ----------------------------------------------------------
    return {
        academicYear: year[0],
        counts: {
            classes: classIds.length,
            sections: sectionIds.length,
            enrollments: await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "StudentAcademicEnrollment"
          WHERE
            "schoolId" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId),
            attendance: await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "attendances"
          WHERE
            "school_id" = $1::uuid
            AND "academic_year_id" = $2::text
          `, schoolId, academicYearId),
            exams: await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "exams"
          WHERE
            "school_id" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId),
            idCards: await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "id_cards"
          WHERE
            "school_id" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId),
            promotions: await queryCount(`
          SELECT COUNT(*)::int AS count
          FROM "student_promotions"
          WHERE
            "school_id" = $1::uuid
            AND (
              "from_academic_year_id" = $2::text
              OR
              "to_academic_year_id" = $2::text
            )
          `, schoolId, academicYearId),
            studentsBlockingClassDelete: studentCount,
            couponsOnYearClasses: couponCount,
            studentsUsingYearCoupons: couponStudentCount,
        },
        blockers: [
            ...(studentCount > 0
                ? [
                    "Some students still reference classes from this academic year. Move them to another year's class before deleting the year.",
                ]
                : []),
            ...(couponStudentCount > 0
                ? [
                    "Some students still use coupons attached to classes from this academic year. Resolve those coupon references before deleting the year.",
                ]
                : []),
        ],
    };
}
// ============================================================
// PUBLIC PREVIEW
// ============================================================
async function getAcademicYearDeletionPreview(schoolId, academicYearId) {
    return previewAcademicYearDeletion(schoolId, academicYearId);
}
function getDriveMetadata(upload) {
    return {
        fileId: upload.fileId,
        fileName: upload.fileName,
        webViewLink: upload.webViewLink,
    };
}
// ============================================================
// EXPORT SCHOOL
// ============================================================
async function exportSchool(schoolId, platformAdminId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    const operation = await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        operation: "FULL_EXPORT",
        status: "PROCESSING",
        createdByPlatformAdminId: platformAdminId,
    });
    try {
        // --------------------------------------------------------
        // COLLECT DATA
        // --------------------------------------------------------
        const data = await collectFullSchoolData(schoolId);
        // --------------------------------------------------------
        // FILE NAME
        // --------------------------------------------------------
        const fileName = `${school.code}-complete-backup-${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}.zip`;
        const outputPath = path_1.default.join(EXPORT_DIR, fileName);
        // --------------------------------------------------------
        // MANIFEST
        // --------------------------------------------------------
        const manifest = {
            version: 2,
            type: "FULL_SCHOOL_BACKUP",
            exportedAt: new Date().toISOString(),
            schoolId,
            schoolCode: school.code,
            schoolName: school.name,
            includes: Object.keys(data),
            databaseTypes: {
                schoolId: "uuid",
                allOtherIds: "text",
            },
            storage: {
                localFile: outputPath,
            },
            note: "Database records and stored file URLs/metadata are included. External object-storage binaries must be copied separately if required.",
        };
        // --------------------------------------------------------
        // CREATE ZIP
        // --------------------------------------------------------
        await writeZip(outputPath, [
            {
                name: "manifest.json",
                data: manifest,
            },
            {
                name: "database.json",
                data: data,
            },
        ]);
        // --------------------------------------------------------
        // SIZE
        // --------------------------------------------------------
        const fileSize = fs_1.default.statSync(outputPath).size;
        // --------------------------------------------------------
        // CHECKSUM
        // --------------------------------------------------------
        const hash = await checksum(outputPath);
        // --------------------------------------------------------
        // GOOGLE DRIVE
        // --------------------------------------------------------
        const driveUpload = await (0, googleDrive_service_1.uploadBackupToGoogleDrive)(outputPath, fileName);
        const driveBackup = getDriveMetadata(driveUpload);
        // --------------------------------------------------------
        // FINAL METADATA
        // --------------------------------------------------------
        const finalMetadata = {
            ...manifest,
            googleDrive: {
                ...driveBackup,
            },
        };
        // --------------------------------------------------------
        // UPDATE OPERATION
        //
        // We store Google Drive information inside metadata.
        //
        // This means you DO NOT need to change the Prisma model
        // just to add driveFileId/driveUrl columns.
        // --------------------------------------------------------
        await config_1.prisma.schoolDataOperation.update({
            where: {
                id: operation.id,
            },
            data: {
                status: "COMPLETED",
                fileName,
                // Keep local file for the existing download controller.
                downloadPath: outputPath,
                checksum: hash,
                fileSize,
                completedAt: new Date(),
                metadata: finalMetadata,
            },
        });
        return {
            operationId: operation.id,
            status: "COMPLETED",
            fileName,
            checksum: hash,
            fileSize,
            googleDrive: driveBackup,
        };
    }
    catch (error) {
        await markFailed(operation.id, error);
        throw error;
    }
}
async function runAutomaticSchoolBackup(schoolId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    // --------------------------------------------------------
    // COLLECT DATA
    // --------------------------------------------------------
    const data = await collectFullSchoolData(schoolId);
    // --------------------------------------------------------
    // CREATE A STABLE CHECKSUM OF THE DATA
    // --------------------------------------------------------
    // IMPORTANT:
    // Do NOT use the ZIP checksum here because the ZIP manifest
    // contains exportedAt, which changes every time.
    // --------------------------------------------------------
    const stableData = JSON.stringify(data, Object.keys(data).sort());
    const dataChecksum = crypto_1.default
        .createHash("sha256")
        .update(stableData)
        .digest("hex");
    // --------------------------------------------------------
    // FIND LAST SUCCESSFUL AUTOMATIC BACKUP
    // --------------------------------------------------------
    const lastBackup = await config_1.prisma.schoolDataOperation.findFirst({
        where: {
            schoolId,
            operation: "AUTOMATIC_BACKUP",
            status: "COMPLETED",
        },
        orderBy: {
            completedAt: "desc",
        },
    });
    // --------------------------------------------------------
    // NOTHING CHANGED
    // --------------------------------------------------------
    if (lastBackup?.checksum === dataChecksum) {
        console.log(`[Automatic Backup] ${school.code}: no changes, skipping`);
        return {
            skipped: true,
            reason: "NO_CHANGES",
            schoolId,
            schoolCode: school.code,
            checksum: dataChecksum,
        };
    }
    // --------------------------------------------------------
    // CREATE OPERATION
    // --------------------------------------------------------
    const operation = await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        operation: "AUTOMATIC_BACKUP",
        status: "PROCESSING",
    });
    let outputPath;
    try {
        // ------------------------------------------------------
        // FILE NAME
        // ------------------------------------------------------
        const fileName = `${school.code}-automatic-backup-${new Date()
            .toISOString()
            .replace(/[:.]/g, "-")}.zip`;
        outputPath = path_1.default.join(EXPORT_DIR, fileName);
        // ------------------------------------------------------
        // MANIFEST
        // ------------------------------------------------------
        const manifest = {
            version: 2,
            type: "AUTOMATIC_SCHOOL_BACKUP",
            exportedAt: new Date().toISOString(),
            schoolId,
            schoolCode: school.code,
            schoolName: school.name,
            dataChecksum,
            includes: Object.keys(data),
            databaseTypes: {
                schoolId: "uuid",
                allOtherIds: "text",
            },
            storage: {
                localFile: outputPath,
            },
            note: "Automatic database backup. External object-storage binaries must be copied separately if required.",
        };
        // ------------------------------------------------------
        // CREATE ZIP
        // ------------------------------------------------------
        await writeZip(outputPath, [
            {
                name: "manifest.json",
                data: manifest,
            },
            {
                name: "database.json",
                data: data,
            },
        ]);
        // ------------------------------------------------------
        // FILE INFO
        // ------------------------------------------------------
        const fileSize = fs_1.default.statSync(outputPath).size;
        const zipChecksum = await checksum(outputPath);
        // ------------------------------------------------------
        // GOOGLE DRIVE
        // ------------------------------------------------------
        const driveUpload = await (0, googleDrive_service_1.uploadBackupToGoogleDrive)(outputPath, fileName);
        const driveBackup = getDriveMetadata(driveUpload);
        // ------------------------------------------------------
        // FINAL METADATA
        // ------------------------------------------------------
        const finalMetadata = {
            ...manifest,
            googleDrive: {
                ...driveBackup,
            },
            automaticBackup: {
                dataChecksum,
                zipChecksum,
            },
        };
        // ------------------------------------------------------
        // COMPLETE OPERATION
        // ------------------------------------------------------
        await config_1.prisma.schoolDataOperation.update({
            where: {
                id: operation.id,
            },
            data: {
                status: "COMPLETED",
                fileName,
                downloadPath: outputPath,
                // IMPORTANT:
                // Store DATA checksum here, not ZIP checksum.
                checksum: dataChecksum,
                fileSize,
                completedAt: new Date(),
                metadata: finalMetadata,
            },
        });
        console.log(`[Automatic Backup] ${school.code}: backup uploaded successfully`);
        return {
            skipped: false,
            operationId: operation.id,
            schoolId,
            schoolCode: school.code,
            status: "COMPLETED",
            fileName,
            dataChecksum,
            zipChecksum,
            fileSize,
            googleDrive: driveBackup,
        };
    }
    catch (error) {
        await markFailed(operation.id, error);
        throw error;
    }
}
async function cleanupOldAutomaticBackups() {
    const cutoff = new Date(Date.now() -
        24 * 60 * 60 * 1000);
    const oldBackups = await config_1.prisma.schoolDataOperation.findMany({
        where: {
            operation: "AUTOMATIC_BACKUP",
            status: "COMPLETED",
            completedAt: {
                lt: cutoff,
            },
        },
        orderBy: {
            completedAt: "asc",
        },
    });
    console.log(`[Automatic Backup] Found ${oldBackups.length} backups older than 24 hours`);
    for (const backup of oldBackups) {
        try {
            // ----------------------------------------------
            // Get Drive file ID
            // ----------------------------------------------
            let driveFileId = backup.driveFileId;
            // If you are storing it in metadata instead
            // of the Prisma column, retrieve it here.
            if (!driveFileId) {
                const metadata = backup.metadata;
                driveFileId =
                    metadata?.googleDrive?.fileId;
            }
            // ----------------------------------------------
            // Delete from Google Drive
            // ----------------------------------------------
            if (driveFileId) {
                await (0, googleDrive_service_1.deleteBackupFromGoogleDrive)(driveFileId);
                console.log(`[Automatic Backup] Deleted Drive file ${driveFileId}`);
            }
            // ----------------------------------------------
            // Delete local ZIP
            // ----------------------------------------------
            if (backup.downloadPath &&
                fs_1.default.existsSync(backup.downloadPath)) {
                await fs_1.default.promises.unlink(backup.downloadPath);
                console.log(`[Automatic Backup] Deleted local backup ${backup.downloadPath}`);
            }
            // ----------------------------------------------
            // Delete DB record
            // ----------------------------------------------
            await config_1.prisma.schoolDataOperation.delete({
                where: {
                    id: backup.id,
                },
            });
            console.log(`[Automatic Backup] Removed old backup ${backup.id}`);
        }
        catch (error) {
            // IMPORTANT:
            // Do NOT delete the DB record if Drive deletion failed.
            console.error(`[Automatic Backup] Failed to remove backup ${backup.id}:`, error?.message || error);
        }
    }
}
// ============================================================
// EXPORT ACADEMIC YEAR
// ============================================================
async function exportAcademicYear(schoolId, academicYearId, platformAdminId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    const operation = await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        academicYearId,
        operation: "ACADEMIC_YEAR_EXPORT",
        status: "PROCESSING",
        createdByPlatformAdminId: platformAdminId,
    });
    try {
        // --------------------------------------------------------
        // COLLECT
        // --------------------------------------------------------
        const { yearName, data, } = await collectAcademicYearData(schoolId, academicYearId);
        // --------------------------------------------------------
        // FILE NAME
        // --------------------------------------------------------
        const safeYearName = yearName.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const fileName = `${school.code}-${safeYearName}-backup.zip`;
        const outputPath = path_1.default.join(EXPORT_DIR, fileName);
        // --------------------------------------------------------
        // MANIFEST
        // --------------------------------------------------------
        const manifest = {
            version: 2,
            type: "ACADEMIC_YEAR_BACKUP",
            exportedAt: new Date().toISOString(),
            schoolId,
            schoolCode: school.code,
            schoolName: school.name,
            academicYearId,
            academicYearName: yearName,
            includes: Object.keys(data),
            databaseTypes: {
                schoolId: "uuid",
                academicYearId: "text",
                classId: "text",
                sectionId: "text",
                subjectId: "text",
                studentId: "text",
                examId: "text",
                examSubjectId: "text",
            },
        };
        // --------------------------------------------------------
        // ZIP
        // --------------------------------------------------------
        await writeZip(outputPath, [
            {
                name: "manifest.json",
                data: manifest,
            },
            {
                name: "database.json",
                data: data,
            },
        ]);
        // --------------------------------------------------------
        // SIZE
        // --------------------------------------------------------
        const fileSize = fs_1.default.statSync(outputPath).size;
        // --------------------------------------------------------
        // CHECKSUM
        // --------------------------------------------------------
        const hash = await checksum(outputPath);
        // --------------------------------------------------------
        // GOOGLE DRIVE
        // --------------------------------------------------------
        const driveUpload = await (0, googleDrive_service_1.uploadBackupToGoogleDrive)(outputPath, fileName);
        const driveBackup = getDriveMetadata(driveUpload);
        // --------------------------------------------------------
        // FINAL METADATA
        // --------------------------------------------------------
        const finalMetadata = {
            ...manifest,
            googleDrive: {
                ...driveBackup,
            },
        };
        // --------------------------------------------------------
        // OPERATION UPDATE
        // --------------------------------------------------------
        await config_1.prisma.schoolDataOperation.update({
            where: {
                id: operation.id,
            },
            data: {
                status: "COMPLETED",
                academicYearName: yearName,
                fileName,
                downloadPath: outputPath,
                checksum: hash,
                fileSize,
                completedAt: new Date(),
                metadata: finalMetadata,
            },
        });
        return {
            operationId: operation.id,
            status: "COMPLETED",
            fileName,
            checksum: hash,
            fileSize,
            googleDrive: driveBackup,
        };
    }
    catch (error) {
        await markFailed(operation.id, error);
        throw error;
    }
}
// ============================================================
// ARCHIVE SCHOOL
// ============================================================
async function archiveSchool(schoolId, platformAdminId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    if (school.status ===
        "ARCHIVED") {
        throw new Error("School is already archived");
    }
    if (school.status !==
        "SUSPENDED") {
        throw new Error("Only a suspended school can be archived");
    }
    const updated = await config_1.prisma.school.update({
        where: {
            id: schoolId,
        },
        data: {
            status: "ARCHIVED",
        },
    });
    await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        operation: "SCHOOL_ARCHIVE",
        status: "COMPLETED",
        createdByPlatformAdminId: platformAdminId,
        completedAt: new Date(),
    });
    return updated;
}
// ============================================================
// RESTORE SCHOOL
// ============================================================
async function restoreSchool(schoolId, platformAdminId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    if (school.status !==
        "ARCHIVED") {
        throw new Error("Only an archived school can be restored");
    }
    const updated = await config_1.prisma.school.update({
        where: {
            id: schoolId,
        },
        data: {
            status: "SUSPENDED",
        },
    });
    await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        operation: "SCHOOL_RESTORE",
        status: "COMPLETED",
        createdByPlatformAdminId: platformAdminId,
        completedAt: new Date(),
    });
    return updated;
}
// ============================================================
// DELETE ACADEMIC YEAR
// ============================================================
async function deleteAcademicYear(schoolId, academicYearId, confirmation, platformAdminId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    // ----------------------------------------------------------
    // PREVIEW
    // ----------------------------------------------------------
    const preview = await previewAcademicYearDeletion(schoolId, academicYearId);
    const yearName = String(preview.academicYear.name);
    // ----------------------------------------------------------
    // CONFIRMATION
    // ----------------------------------------------------------
    if (confirmation !==
        `DELETE ACADEMIC YEAR ${yearName}`) {
        throw new Error(`Confirmation must be: DELETE ACADEMIC YEAR ${yearName}`);
    }
    // ----------------------------------------------------------
    // BLOCKERS
    // ----------------------------------------------------------
    if (preview.blockers.length) {
        throw new Error(preview.blockers.join(" "));
    }
    // ----------------------------------------------------------
    // CREATE OPERATION
    // ----------------------------------------------------------
    const operation = await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        academicYearId,
        academicYearName: yearName,
        operation: "ACADEMIC_YEAR_DELETE",
        status: "PROCESSING",
        createdByPlatformAdminId: platformAdminId,
    });
    try {
        // --------------------------------------------------------
        // MANDATORY BACKUP BEFORE DELETE
        //
        // This backup is uploaded to Google Drive.
        // --------------------------------------------------------
        const backup = await exportAcademicYear(schoolId, academicYearId, platformAdminId);
        // --------------------------------------------------------
        // GET CLASSES
        // --------------------------------------------------------
        const classes = await queryRows(`
        SELECT "id"
        FROM "classes"
        WHERE
          "school_id" = $1::uuid
          AND "academic_year_id" = $2::text
        `, schoolId, academicYearId);
        const classIds = classes.map((row) => String(row.id));
        // --------------------------------------------------------
        // GET EXAMS
        // --------------------------------------------------------
        const exams = await queryRows(`
        SELECT "id"
        FROM "exams"
        WHERE
          "school_id" = $1::uuid
          AND "academicYearId" = $2::text
        `, schoolId, academicYearId);
        const examIds = exams.map((row) => String(row.id));
        // --------------------------------------------------------
        // GET EXAM SUBJECTS
        // --------------------------------------------------------
        const examSubjects = examIds.length
            ? await rowsByTextIds("exam_subjects", "examId", examIds)
            : [];
        const examSubjectIds = examSubjects.map((row) => String(row.id));
        // --------------------------------------------------------
        // DELETE IN TRANSACTION
        // --------------------------------------------------------
        await config_1.prisma.$transaction(async (tx) => {
            const q = async (sql, ...params) => {
                return tx.$executeRawUnsafe(sql, ...params);
            };
            // ----------------------------------------------------
            // MARKS
            // ----------------------------------------------------
            if (examSubjectIds.length) {
                await q(`
            DELETE FROM "marks"
            WHERE "examSubjectId" IN (
              ${textPlaceholders(examSubjectIds.length)}
            )
            `, ...examSubjectIds);
            }
            // ----------------------------------------------------
            // EXAM TIMETABLES
            // ----------------------------------------------------
            if (examIds.length) {
                await q(`
            DELETE FROM "exam_timetables"
            WHERE "examId" IN (
              ${textPlaceholders(examIds.length)}
            )
            `, ...examIds);
            }
            // ----------------------------------------------------
            // EXAM SUBJECTS
            // ----------------------------------------------------
            if (examIds.length) {
                await q(`
            DELETE FROM "exam_subjects"
            WHERE "examId" IN (
              ${textPlaceholders(examIds.length)}
            )
            `, ...examIds);
            }
            // ----------------------------------------------------
            // EXAMS
            // ----------------------------------------------------
            await q(`
          DELETE FROM "exams"
          WHERE
            "school_id" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId);
            // ----------------------------------------------------
            // ATTENDANCES
            // ----------------------------------------------------
            await q(`
          DELETE FROM "attendances"
          WHERE
            "school_id" = $1::uuid
            AND "academic_year_id" = $2::text
          `, schoolId, academicYearId);
            // ----------------------------------------------------
            // TEACHER SUBJECT MAPPINGS
            //
            // IMPORTANT:
            // "academicYearId", NOT "academic_year_id".
            // ----------------------------------------------------
            await q(`
          DELETE FROM "teacher_subject_mappings"
          WHERE
            "school_id" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId);
            // ----------------------------------------------------
            // ENROLLMENTS
            // ----------------------------------------------------
            await q(`
          DELETE FROM "StudentAcademicEnrollment"
          WHERE
            "schoolId" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId);
            // ----------------------------------------------------
            // STUDENT PROMOTIONS
            // ----------------------------------------------------
            await q(`
          DELETE FROM "student_promotions"
          WHERE
            "school_id" = $1::uuid
            AND (
              "from_academic_year_id" = $2::text
              OR
              "to_academic_year_id" = $2::text
            )
          `, schoolId, academicYearId);
            // ----------------------------------------------------
            // ID CARDS
            // ----------------------------------------------------
            await q(`
          DELETE FROM "id_cards"
          WHERE
            "school_id" = $1::uuid
            AND "academicYearId" = $2::text
          `, schoolId, academicYearId);
            // ----------------------------------------------------
            // TIMETABLE
            // ----------------------------------------------------
            await q(`
          DELETE FROM "timetables"
          WHERE
            "school_id" = $1::uuid
            AND "academicYear" = $2::text
          `, schoolId, yearName);
            // ----------------------------------------------------
            // COUPONS
            // ----------------------------------------------------
            if (classIds.length) {
                await q(`
            DELETE FROM "coupons"
            WHERE
              "school_id" = $${classIds.length + 1}::uuid
              AND "class_id" IN (
                ${textPlaceholders(classIds.length)}
              )
            `, ...classIds, schoolId);
            }
            // ----------------------------------------------------
            // SECTIONS
            // ----------------------------------------------------
            if (classIds.length) {
                await q(`
            DELETE FROM "sections"
            WHERE
              "school_id" = $${classIds.length + 1}::uuid
              AND "class_id" IN (
                ${textPlaceholders(classIds.length)}
              )
            `, ...classIds, schoolId);
            }
            // ----------------------------------------------------
            // SUBJECTS
            // ----------------------------------------------------
            if (classIds.length) {
                await q(`
            DELETE FROM "subjects"
            WHERE
              "school_id" = $${classIds.length + 1}::uuid
              AND "classId" IN (
                ${textPlaceholders(classIds.length)}
              )
            `, ...classIds, schoolId);
            }
            // ----------------------------------------------------
            // CLASSES
            // ----------------------------------------------------
            if (classIds.length) {
                await q(`
            DELETE FROM "classes"
            WHERE
              "school_id" = $${classIds.length + 1}::uuid
              AND "id" IN (
                ${textPlaceholders(classIds.length)}
              )
            `, ...classIds, schoolId);
            }
            // ----------------------------------------------------
            // ACADEMIC YEAR
            // ----------------------------------------------------
            await q(`
          DELETE FROM "academic_years"
          WHERE
            "id" = $1::text
            AND "school_id" = $2::uuid
          `, academicYearId, schoolId);
        });
        // --------------------------------------------------------
        // OPERATION COMPLETE
        // --------------------------------------------------------
        await config_1.prisma.schoolDataOperation.update({
            where: {
                id: operation.id,
            },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
                metadata: {
                    preview,
                    backup,
                },
            },
        });
        // --------------------------------------------------------
        // AUDIT
        // --------------------------------------------------------
        await config_1.prisma.platformDataDeletionAudit.create({
            data: {
                schoolId,
                schoolCode: school.code,
                schoolName: school.name,
                academicYearId,
                academicYearName: yearName,
                operation: "ACADEMIC_YEAR_DELETE",
                performedByPlatformAdminId: platformAdminId,
                details: {
                    preview,
                    backup,
                },
            },
        });
        return {
            message: `Academic year ${yearName} deleted successfully`,
            operationId: operation.id,
            backup,
        };
    }
    catch (error) {
        await markFailed(operation.id, error);
        throw error;
    }
}
// ============================================================
// DELETE SCHOOL
// ============================================================
async function deleteSchool(schoolId, confirmation, platformAdminId) {
    const school = await config_1.prisma.school.findUnique({
        where: {
            id: schoolId,
        },
    });
    if (!school) {
        throw new Error("School not found");
    }
    // ----------------------------------------------------------
    // SAFETY CHECK
    // ----------------------------------------------------------
    if (school.status !==
        "SUSPENDED" &&
        school.status !==
            "ARCHIVED") {
        throw new Error("School must be suspended or archived before permanent deletion");
    }
    // ----------------------------------------------------------
    // CONFIRMATION
    // ----------------------------------------------------------
    if (confirmation !==
        `DELETE SCHOOL ${school.code}`) {
        throw new Error(`Confirmation must be: DELETE SCHOOL ${school.code}`);
    }
    // ----------------------------------------------------------
    // MANDATORY BACKUP
    //
    // exportSchool:
    //
    // 1. creates ZIP
    // 2. calculates checksum
    // 3. uploads ZIP to Google Drive
    // 4. stores Drive metadata
    // ----------------------------------------------------------
    const backup = await exportSchool(schoolId, platformAdminId);
    // ----------------------------------------------------------
    // DELETE OPERATION
    // ----------------------------------------------------------
    const operation = await createOperation({
        schoolId,
        schoolCode: school.code,
        schoolName: school.name,
        operation: "SCHOOL_DELETE",
        status: "PROCESSING",
        createdByPlatformAdminId: platformAdminId,
    });
    try {
        const deletedCounts = {};
        await config_1.prisma.$transaction(async (tx) => {
            const statements = [
                [
                    "notifications",
                    `
            DELETE FROM "notifications"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "announcements",
                    `
            DELETE FROM "announcements"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "audit_logs",
                    `
            DELETE FROM "audit_logs"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "school_onboarding_logs",
                    `
            DELETE FROM "school_onboarding_logs"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "bulk_import_sessions",
                    `
            DELETE FROM "bulk_import_sessions"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "leave_requests",
                    `
            DELETE FROM "leave_requests"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "complaints",
                    `
            DELETE FROM "complaints"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "transfer_certificates",
                    `
            DELETE FROM "transfer_certificates"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "id_cards",
                    `
            DELETE FROM "id_cards"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "marks",
                    `
            DELETE FROM "marks"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "exam_timetables",
                    `
            DELETE FROM "exam_timetables"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "exam_subjects",
                    `
            DELETE FROM "exam_subjects"
            WHERE "classId" IN (
              SELECT "id"
              FROM "classes"
              WHERE "school_id" = $1::uuid
            )
            `,
                ],
                [
                    "exams",
                    `
            DELETE FROM "exams"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "attendances",
                    `
            DELETE FROM "attendances"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "teacher_attendances",
                    `
            DELETE FROM "teacher_attendances"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "teacher_subject_mappings",
                    `
            DELETE FROM "teacher_subject_mappings"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "timetables",
                    `
            DELETE FROM "timetables"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "student_promotions",
                    `
            DELETE FROM "student_promotions"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "StudentAcademicEnrollment",
                    `
            DELETE FROM "StudentAcademicEnrollment"
            WHERE "schoolId" = $1::uuid
            `,
                ],
                [
                    "student_parent_links",
                    `
            DELETE FROM "student_parent_links"
            WHERE
              "studentId" IN (
                SELECT "id"
                FROM "students"
                WHERE "school_id" = $1::uuid
              )
              OR
              "parentUserId" IN (
                SELECT "id"
                FROM "users"
                WHERE "school_id" = $1::uuid
              )
            `,
                ],
                [
                    "transactions",
                    `
            DELETE FROM "transactions"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "students",
                    `
            DELETE FROM "students"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "coupons",
                    `
            DELETE FROM "coupons"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "sections",
                    `
            DELETE FROM "sections"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "subjects",
                    `
            DELETE FROM "subjects"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "classes",
                    `
            DELETE FROM "classes"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "id_card_templates",
                    `
            DELETE FROM "id_card_templates"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "users",
                    `
            DELETE FROM "users"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "academic_years",
                    `
            DELETE FROM "academic_years"
            WHERE "school_id" = $1::uuid
            `,
                ],
                [
                    "school",
                    `
            DELETE FROM "schools"
            WHERE "id" = $1::uuid
            `,
                ],
            ];
            // ------------------------------------------------------
            // EXECUTE
            // ------------------------------------------------------
            for (const [name, sql,] of statements) {
                const count = await tx.$executeRawUnsafe(sql, schoolId);
                deletedCounts[name] = Number(count);
            }
        });
        // ----------------------------------------------------------
        // OPERATION COMPLETE
        // ----------------------------------------------------------
        await config_1.prisma.schoolDataOperation.update({
            where: {
                id: operation.id,
            },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
                metadata: {
                    backup,
                    deletedCounts,
                },
            },
        });
        // ----------------------------------------------------------
        // AUDIT
        //
        // This table intentionally has no School FK.
        // ----------------------------------------------------------
        await config_1.prisma.platformDataDeletionAudit.create({
            data: {
                schoolId,
                schoolCode: school.code,
                schoolName: school.name,
                operation: "SCHOOL_DELETE",
                performedByPlatformAdminId: platformAdminId,
                details: {
                    backup,
                    deletedCounts,
                },
            },
        });
        return {
            message: "School permanently deleted",
            operationId: operation.id,
            backup,
            deletedCounts,
        };
    }
    catch (error) {
        await markFailed(operation.id, error);
        throw error;
    }
}
// ============================================================
// GET OPERATION
// ============================================================
async function getOperation(operationId) {
    return config_1.prisma.schoolDataOperation.findUnique({
        where: {
            id: operationId,
        },
    });
}
// ============================================================
// GET SCHOOL OPERATIONS
// ============================================================
async function getSchoolOperations(schoolId) {
    return config_1.prisma.schoolDataOperation.findMany({
        where: {
            schoolId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}
