"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBackupToGoogleDrive = uploadBackupToGoogleDrive;
exports.downloadBackupFromGoogleDrive = downloadBackupFromGoogleDrive;
exports.deleteBackupFromGoogleDrive = deleteBackupFromGoogleDrive;
exports.getGoogleDriveBackup = getGoogleDriveBackup;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
const serviceAccount = JSON.parse(fs_1.default.readFileSync(path_1.default.resolve(process.cwd(), "config", "sa.json"), "utf-8"));
// ------------------------------------------------------------
// ENVIRONMENT
// ------------------------------------------------------------
dotenv_1.default.config({
    path: path_1.default.resolve(process.cwd(), ".env"),
});
// ------------------------------------------------------------
// GOOGLE DRIVE
// ------------------------------------------------------------
const SCOPES = [
    "https://www.googleapis.com/auth/drive",
];
const credentials = serviceAccount;
// ------------------------------------------------------------
// BACKUP FOLDER
// ------------------------------------------------------------
function getBackupFolderId() {
    const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim();
    if (!folderId) {
        throw new Error("GOOGLE_DRIVE_BACKUP_FOLDER_ID is not configured in the backend .env file.");
    }
    return folderId;
}
// ------------------------------------------------------------
// DRIVE CLIENT
// ------------------------------------------------------------
function getDriveClient() {
    if (!credentials.client_email) {
        throw new Error("Google service account client_email is missing from config/sa.json.");
    }
    if (!credentials.private_key) {
        throw new Error("Google service account private_key is missing from config/sa.json.");
    }
    const auth = new googleapis_1.google.auth.GoogleAuth({
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        },
        scopes: SCOPES,
    });
    return googleapis_1.google.drive({
        version: "v3",
        auth,
    });
}
// ------------------------------------------------------------
// UPLOAD BACKUP
// ------------------------------------------------------------
async function uploadBackupToGoogleDrive(filePath, fileName) {
    // ----------------------------------------------------------
    // FILE CHECK
    // ----------------------------------------------------------
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Backup file does not exist: ${filePath}`);
    }
    const stat = await fs_1.default.promises.stat(filePath);
    if (!stat.isFile()) {
        throw new Error(`Backup path is not a file: ${filePath}`);
    }
    if (stat.size === 0) {
        throw new Error(`Backup file is empty: ${filePath}`);
    }
    // ----------------------------------------------------------
    // GOOGLE DRIVE CONFIG
    // ----------------------------------------------------------
    const folderId = getBackupFolderId();
    const drive = getDriveClient();
    try {
        // --------------------------------------------------------
        // VERIFY FOLDER
        // --------------------------------------------------------
        const folder = await drive.files.get({
            fileId: folderId,
            fields: "id,name,mimeType,driveId,parents",
        });
        if (folder.data.mimeType !==
            "application/vnd.google-apps.folder") {
            throw new Error(`GOOGLE_DRIVE_BACKUP_FOLDER_ID is not a folder: ${folderId}`);
        }
        // --------------------------------------------------------
        // UPLOAD
        // --------------------------------------------------------
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: "application/zip",
                parents: [
                    folderId,
                ],
            },
            media: {
                mimeType: "application/zip",
                body: fs_1.default.createReadStream(filePath),
            },
            fields: "id,name,webViewLink,webContentLink",
        });
        // --------------------------------------------------------
        // VALIDATE RESPONSE
        // --------------------------------------------------------
        if (!response.data.id) {
            throw new Error("Google Drive upload succeeded but no file ID was returned.");
        }
        return {
            fileId: response.data.id,
            fileName: response.data.name ||
                fileName,
            webViewLink: response.data.webViewLink ||
                undefined,
            webContentLink: response.data.webContentLink ||
                undefined,
        };
    }
    catch (error) {
        const message = error?.response?.data?.error?.message ||
            error?.message ||
            "Unknown Google Drive error.";
        const status = error?.response?.status;
        console.error("[Google Drive] Upload failed:", message);
        if (status) {
            console.error("[Google Drive] HTTP status:", status);
        }
        throw new Error(`Google Drive upload failed${status
            ? ` (${status})`
            : ""}: ${message}`);
    }
}
// ------------------------------------------------------------
// DOWNLOAD BACKUP
// ------------------------------------------------------------
async function downloadBackupFromGoogleDrive(fileId, outputPath) {
    const drive = getDriveClient();
    await fs_1.default.promises.mkdir(path_1.default.dirname(outputPath), {
        recursive: true,
    });
    try {
        const response = await drive.files.get({
            fileId,
            alt: "media",
        }, {
            responseType: "stream",
        });
        const output = fs_1.default.createWriteStream(outputPath);
        await new Promise((resolve, reject) => {
            response.data
                .on("error", reject)
                .pipe(output)
                .on("finish", resolve)
                .on("error", reject);
        });
    }
    catch (error) {
        const message = error?.response?.data?.error?.message ||
            error?.message ||
            "Unknown Google Drive error.";
        throw new Error(`Google Drive download failed: ${message}`);
    }
}
// ------------------------------------------------------------
// DELETE BACKUP
// ------------------------------------------------------------
async function deleteBackupFromGoogleDrive(fileId) {
    const drive = getDriveClient();
    try {
        await drive.files.delete({
            fileId,
        });
        console.log(`[Google Drive] Deleted: ${fileId}`);
    }
    catch (error) {
        const message = error?.response?.data?.error?.message ||
            error?.message ||
            "Unknown Google Drive error.";
        throw new Error(`Google Drive delete failed: ${message}`);
    }
}
// ------------------------------------------------------------
// GET BACKUP
// ------------------------------------------------------------
async function getGoogleDriveBackup(fileId) {
    const drive = getDriveClient();
    try {
        const response = await drive.files.get({
            fileId,
            fields: "id,name,size,createdTime,modifiedTime,mimeType,webViewLink",
        });
        return response.data;
    }
    catch (error) {
        const message = error?.response?.data?.error?.message ||
            error?.message ||
            "Unknown Google Drive error.";
        throw new Error(`Google Drive lookup failed: ${message}`);
    }
}
