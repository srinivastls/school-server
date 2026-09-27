import fs from "fs";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

const serviceAccount = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "config", "sa.json"),
    "utf-8"
  )
);

// ------------------------------------------------------------
// ENVIRONMENT
// ------------------------------------------------------------

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

// ------------------------------------------------------------
// GOOGLE DRIVE
// ------------------------------------------------------------

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

const credentials =
  serviceAccount as ServiceAccountCredentials;

// ------------------------------------------------------------
// BACKUP FOLDER
// ------------------------------------------------------------

function getBackupFolderId(): string {
  const folderId =
    process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim();

  if (!folderId) {
    throw new Error(
      "GOOGLE_DRIVE_BACKUP_FOLDER_ID is not configured in the backend .env file."
    );
  }

  return folderId;
}

// ------------------------------------------------------------
// DRIVE CLIENT
// ------------------------------------------------------------

function getDriveClient() {
  if (!credentials.client_email) {
    throw new Error(
      "Google service account client_email is missing from config/sa.json."
    );
  }

  if (!credentials.private_key) {
    throw new Error(
      "Google service account private_key is missing from config/sa.json."
    );
  }

  const auth =
    new google.auth.GoogleAuth({
      credentials: {
        client_email:
          credentials.client_email,

        private_key:
          credentials.private_key,
      },

      scopes: SCOPES,
    });

  return google.drive({
    version: "v3",
    auth,
  });
}

// ------------------------------------------------------------
// RESULT TYPE
// ------------------------------------------------------------

export interface GoogleDriveUploadResult {
  fileId: string;
  fileName: string;
  webViewLink?: string;
  webContentLink?: string;
}

// ------------------------------------------------------------
// UPLOAD BACKUP
// ------------------------------------------------------------

export async function uploadBackupToGoogleDrive(
  filePath: string,
  fileName: string
): Promise<GoogleDriveUploadResult> {
  // ----------------------------------------------------------
  // FILE CHECK
  // ----------------------------------------------------------

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Backup file does not exist: ${filePath}`
    );
  }

  const stat =
    await fs.promises.stat(filePath);

  if (!stat.isFile()) {
    throw new Error(
      `Backup path is not a file: ${filePath}`
    );
  }

  if (stat.size === 0) {
    throw new Error(
      `Backup file is empty: ${filePath}`
    );
  }

  // ----------------------------------------------------------
  // GOOGLE DRIVE CONFIG
  // ----------------------------------------------------------

  const folderId =
    getBackupFolderId();

  const drive =
    getDriveClient();



  try {
    // --------------------------------------------------------
    // VERIFY FOLDER
    // --------------------------------------------------------

    const folder =
      await drive.files.get({
        fileId: folderId,

        fields:
          "id,name,mimeType,driveId,parents",
      });

    if (
      folder.data.mimeType !==
      "application/vnd.google-apps.folder"
    ) {
      throw new Error(
        `GOOGLE_DRIVE_BACKUP_FOLDER_ID is not a folder: ${folderId}`
      );
    }



    // --------------------------------------------------------
    // UPLOAD
    // --------------------------------------------------------

    const response =
      await drive.files.create({
        requestBody: {
          name: fileName,

          mimeType:
            "application/zip",

          parents: [
            folderId,
          ],
        },

        media: {
          mimeType:
            "application/zip",

          body:
            fs.createReadStream(
              filePath
            ),
        },

        fields:
          "id,name,webViewLink,webContentLink",
      });

    // --------------------------------------------------------
    // VALIDATE RESPONSE
    // --------------------------------------------------------

    if (!response.data.id) {
      throw new Error(
        "Google Drive upload succeeded but no file ID was returned."
      );
    }



    return {
      fileId:
        response.data.id,

      fileName:
        response.data.name ||
        fileName,

      webViewLink:
        response.data.webViewLink ||
        undefined,

      webContentLink:
        response.data.webContentLink ||
        undefined,
    };
  } catch (error: any) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown Google Drive error.";

    const status =
      error?.response?.status;

    console.error(
      "[Google Drive] Upload failed:",
      message
    );

    if (status) {
      console.error(
        "[Google Drive] HTTP status:",
        status
      );
    }

    throw new Error(
      `Google Drive upload failed${
        status
          ? ` (${status})`
          : ""
      }: ${message}`
    );
  }
}

// ------------------------------------------------------------
// DOWNLOAD BACKUP
// ------------------------------------------------------------

export async function downloadBackupFromGoogleDrive(
  fileId: string,
  outputPath: string
): Promise<void> {
  const drive =
    getDriveClient();

  await fs.promises.mkdir(
    path.dirname(outputPath),
    {
      recursive: true,
    }
  );

  try {
    const response =
      await drive.files.get(
        {
          fileId,

          alt: "media",
        },

        {
          responseType:
            "stream",
        }
      );

    const output =
      fs.createWriteStream(
        outputPath
      );

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        response.data
          .on(
            "error",
            reject
          )
          .pipe(output)
          .on(
            "finish",
            resolve
          )
          .on(
            "error",
            reject
          );
      }
    );
  } catch (error: any) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown Google Drive error.";

    throw new Error(
      `Google Drive download failed: ${message}`
    );
  }
}

// ------------------------------------------------------------
// DELETE BACKUP
// ------------------------------------------------------------

export async function deleteBackupFromGoogleDrive(
  fileId: string
): Promise<void> {
  const drive =
    getDriveClient();

  try {
    await drive.files.delete({
      fileId,
    });

    console.log(
      `[Google Drive] Deleted: ${fileId}`
    );
  } catch (error: any) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown Google Drive error.";

    throw new Error(
      `Google Drive delete failed: ${message}`
    );
  }
}

// ------------------------------------------------------------
// GET BACKUP
// ------------------------------------------------------------

export async function getGoogleDriveBackup(
  fileId: string
) {
  const drive =
    getDriveClient();

  try {
    const response =
      await drive.files.get({
        fileId,

        fields:
          "id,name,size,createdTime,modifiedTime,mimeType,webViewLink",
      });

    return response.data;
  } catch (error: any) {
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unknown Google Drive error.";

    throw new Error(
      `Google Drive lookup failed: ${message}`
    );
  }
}