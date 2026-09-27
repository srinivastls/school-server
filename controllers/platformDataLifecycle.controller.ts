import fs from "fs";
import crypto from "crypto";
import { Request, Response } from "../types";
import { handleErr } from "../utils";
import { authConfig } from "../config/auth.config";
import {
  archiveSchool,
  deleteAcademicYear,
  deleteSchool,
  exportAcademicYear,
  exportSchool,
  getAcademicYearDeletionPreview,
  getOperation,
  getSchoolOperations,
  restoreSchool,
} from "../services/schoolDataLifecycle.service";

import { downloadBackupFromGoogleDrive } from "../services/googleDrive.service";
import path from "path";

function signedDownload(operationId: string, expires: number) {
  return crypto.createHmac("sha256", authConfig.secret).update(`${operationId}:${expires}`).digest("hex");
}

function buildDownloadUrl(req: Request, operationId: string) {
  const expires = Date.now() + 15 * 60 * 1000;
  const protocol = String(req.headers["x-forwarded-proto"] || req.protocol).split(",")[0];
  const host = req.get("host");
  return `${protocol}://${host}/api/platform/exports/${operationId}/download?expires=${expires}&token=${signedDownload(operationId, expires)}`;
}

export const getAcademicYearDeletionPreviewController = async (req: Request, res: Response) => {
  try {
    const result = await getAcademicYearDeletionPreview(req.params.schoolId, req.params.academicYearId);
    return res.status(200).json(result);
  } catch (error) {
    return handleErr(error, res);
  }
};

export const exportSchoolController = async (req: Request, res: Response) => {
  try {
    const result = await exportSchool(req.params.schoolId, req.userId!);
    return res.status(201).json({ ...result, downloadUrl: buildDownloadUrl(req, result.operationId) });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const exportAcademicYearController = async (req: Request, res: Response) => {
  try {
    const result = await exportAcademicYear(req.params.schoolId, req.params.academicYearId, req.userId!);
    return res.status(201).json({ ...result, downloadUrl: buildDownloadUrl(req, result.operationId) });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const getExportStatusController = async (req: Request, res: Response) => {
  try {
    const operation = await getOperation(req.params.operationId);
    if (!operation) return res.status(404).json({ message: "Export operation not found" });
    return res.status(200).json({ operation });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const downloadExportController = async (
  req: Request,
  res: Response
) => {
  const tempFiles: string[] = [];

  try {
    const expires = Number(
      req.query.expires
    );

    const token = String(
      req.query.token || ""
    );

    const expected = signedDownload(
      req.params.operationId,
      expires
    );

    const tokenBuffer =
      Buffer.from(token);

    const expectedBuffer =
      Buffer.from(expected);

    if (
      !Number.isFinite(expires) ||
      expires < Date.now() ||
      tokenBuffer.length !==
        expectedBuffer.length ||
      !crypto.timingSafeEqual(
        tokenBuffer,
        expectedBuffer
      )
    ) {
      return res.status(401).json({
        message:
          "Download link is invalid or expired",
      });
    }

    const operation =
      await getOperation(
        req.params.operationId
      );

    if (!operation) {
      return res.status(404).json({
        message:
          "Export operation not found",
      });
    }

    if (
      operation.status !== "COMPLETED"
    ) {
      return res.status(404).json({
        message:
          "Completed export not found",
      });
    }

    if (!operation.driveFileId) {
      return res.status(404).json({
        message:
          "Backup is not available in Google Drive",
      });
    }

    const fileName =
      operation.fileName ||
      "school-backup.zip";

    const tempDir = path.join(
      process.cwd(),
      "storage",
      "temp-downloads"
    );

    await fs.promises.mkdir(
      tempDir,
      {
        recursive: true,
      }
    );

    const tempPath = path.join(
      tempDir,
      `${operation.id}-${fileName}`
    );

    tempFiles.push(tempPath);

    await downloadBackupFromGoogleDrive(
      operation.driveFileId,
      tempPath
    );

    res.setHeader(
      "Content-Type",
      "application/zip"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    return res.sendFile(
      tempPath,
      (error) => {
        fs.promises
          .unlink(tempPath)
          .catch(() => {});

        if (error && !res.headersSent) {
          handleErr(error, res);
        }
      }
    );
  } catch (error) {
    for (const file of tempFiles) {
      fs.promises
        .unlink(file)
        .catch(() => {});
    }

    return handleErr(error, res);
  }
};

export const getSchoolDataOperationsController = async (req: Request, res: Response) => {
  try {
    const operations = await getSchoolOperations(req.params.schoolId);
    return res.status(200).json({ operations });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const archiveSchoolController = async (req: Request, res: Response) => {
  try {
    const school = await archiveSchool(req.params.schoolId, req.userId!);
    return res.status(200).json({ message: "School archived successfully", school: { id: school.id, status: school.status } });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const restoreSchoolController = async (req: Request, res: Response) => {
  try {
    const school = await restoreSchool(req.params.schoolId, req.userId!);
    return res.status(200).json({ message: "School restored successfully", school: { id: school.id, status: school.status } });
  } catch (error) {
    return handleErr(error, res);
  }
};

export const deleteAcademicYearController = async (req: Request, res: Response) => {
  try {
    const confirmation = String(req.body?.confirmation || "");
    const result = await deleteAcademicYear(req.params.schoolId, req.params.academicYearId, confirmation, req.userId!);
    return res.status(200).json(result);
  } catch (error) {
    return handleErr(error, res);
  }
};

export const deleteSchoolController = async (req: Request, res: Response) => {
  try {
    const confirmation = String(req.body?.confirmation || "");
    const result = await deleteSchool(req.params.schoolId, confirmation, req.userId!);
    return res.status(200).json(result);
  } catch (error) {
    return handleErr(error, res);
  }
};
