"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSchoolController = exports.deleteAcademicYearController = exports.restoreSchoolController = exports.archiveSchoolController = exports.getSchoolDataOperationsController = exports.downloadExportController = exports.getExportStatusController = exports.exportAcademicYearController = exports.exportSchoolController = exports.getAcademicYearDeletionPreviewController = void 0;
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("../utils");
const auth_config_1 = require("../config/auth.config");
const schoolDataLifecycle_service_1 = require("../services/schoolDataLifecycle.service");
const googleDrive_service_1 = require("../services/googleDrive.service");
const path_1 = __importDefault(require("path"));
function signedDownload(operationId, expires) {
    return crypto_1.default.createHmac("sha256", auth_config_1.authConfig.secret).update(`${operationId}:${expires}`).digest("hex");
}
function buildDownloadUrl(req, operationId) {
    const expires = Date.now() + 15 * 60 * 1000;
    const protocol = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
    const host = req.get("host");
    return `${protocol}://${host}/api/platform/exports/${operationId}/download?expires=${expires}&token=${signedDownload(operationId, expires)}`;
}
const getAcademicYearDeletionPreviewController = async (req, res) => {
    try {
        const result = await (0, schoolDataLifecycle_service_1.getAcademicYearDeletionPreview)(req.params.schoolId, req.params.academicYearId);
        return res.status(200).json(result);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getAcademicYearDeletionPreviewController = getAcademicYearDeletionPreviewController;
const exportSchoolController = async (req, res) => {
    try {
        const result = await (0, schoolDataLifecycle_service_1.exportSchool)(req.params.schoolId, req.userId);
        return res.status(201).json({ ...result, downloadUrl: buildDownloadUrl(req, result.operationId) });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.exportSchoolController = exportSchoolController;
const exportAcademicYearController = async (req, res) => {
    try {
        const result = await (0, schoolDataLifecycle_service_1.exportAcademicYear)(req.params.schoolId, req.params.academicYearId, req.userId);
        return res.status(201).json({ ...result, downloadUrl: buildDownloadUrl(req, result.operationId) });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.exportAcademicYearController = exportAcademicYearController;
const getExportStatusController = async (req, res) => {
    try {
        const operation = await (0, schoolDataLifecycle_service_1.getOperation)(req.params.operationId);
        if (!operation)
            return res.status(404).json({ message: "Export operation not found" });
        return res.status(200).json({ operation });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getExportStatusController = getExportStatusController;
const downloadExportController = async (req, res) => {
    const tempFiles = [];
    try {
        const expires = Number(req.query.expires);
        const token = String(req.query.token || "");
        const expected = signedDownload(req.params.operationId, expires);
        const tokenBuffer = Buffer.from(token);
        const expectedBuffer = Buffer.from(expected);
        if (!Number.isFinite(expires) ||
            expires < Date.now() ||
            tokenBuffer.length !==
                expectedBuffer.length ||
            !crypto_1.default.timingSafeEqual(tokenBuffer, expectedBuffer)) {
            return res.status(401).json({
                message: "Download link is invalid or expired",
            });
        }
        const operation = await (0, schoolDataLifecycle_service_1.getOperation)(req.params.operationId);
        if (!operation) {
            return res.status(404).json({
                message: "Export operation not found",
            });
        }
        if (operation.status !== "COMPLETED") {
            return res.status(404).json({
                message: "Completed export not found",
            });
        }
        if (!operation.driveFileId) {
            return res.status(404).json({
                message: "Backup is not available in Google Drive",
            });
        }
        const fileName = operation.fileName ||
            "school-backup.zip";
        const tempDir = path_1.default.join(process.cwd(), "storage", "temp-downloads");
        await fs_1.default.promises.mkdir(tempDir, {
            recursive: true,
        });
        const tempPath = path_1.default.join(tempDir, `${operation.id}-${fileName}`);
        tempFiles.push(tempPath);
        await (0, googleDrive_service_1.downloadBackupFromGoogleDrive)(operation.driveFileId, tempPath);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        return res.sendFile(tempPath, (error) => {
            fs_1.default.promises
                .unlink(tempPath)
                .catch(() => { });
            if (error && !res.headersSent) {
                (0, utils_1.handleErr)(error, res);
            }
        });
    }
    catch (error) {
        for (const file of tempFiles) {
            fs_1.default.promises
                .unlink(file)
                .catch(() => { });
        }
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.downloadExportController = downloadExportController;
const getSchoolDataOperationsController = async (req, res) => {
    try {
        const operations = await (0, schoolDataLifecycle_service_1.getSchoolOperations)(req.params.schoolId);
        return res.status(200).json({ operations });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.getSchoolDataOperationsController = getSchoolDataOperationsController;
const archiveSchoolController = async (req, res) => {
    try {
        const school = await (0, schoolDataLifecycle_service_1.archiveSchool)(req.params.schoolId, req.userId);
        return res.status(200).json({ message: "School archived successfully", school: { id: school.id, status: school.status } });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.archiveSchoolController = archiveSchoolController;
const restoreSchoolController = async (req, res) => {
    try {
        const school = await (0, schoolDataLifecycle_service_1.restoreSchool)(req.params.schoolId, req.userId);
        return res.status(200).json({ message: "School restored successfully", school: { id: school.id, status: school.status } });
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.restoreSchoolController = restoreSchoolController;
const deleteAcademicYearController = async (req, res) => {
    try {
        const confirmation = String(req.body?.confirmation || "");
        const result = await (0, schoolDataLifecycle_service_1.deleteAcademicYear)(req.params.schoolId, req.params.academicYearId, confirmation, req.userId);
        return res.status(200).json(result);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.deleteAcademicYearController = deleteAcademicYearController;
const deleteSchoolController = async (req, res) => {
    try {
        const confirmation = String(req.body?.confirmation || "");
        const result = await (0, schoolDataLifecycle_service_1.deleteSchool)(req.params.schoolId, confirmation, req.userId);
        return res.status(200).json(result);
    }
    catch (error) {
        return (0, utils_1.handleErr)(error, res);
    }
};
exports.deleteSchoolController = deleteSchoolController;
