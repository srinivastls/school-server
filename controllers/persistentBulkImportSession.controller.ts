
import { Request, Response } from "express";
import {
  getPersistentImportSession,
} from "../services/persistentBulkImportSession.service";

function getSchoolContext(req: Request) {
  const user = (req as any).user;
  return {
    schoolId: user?.schoolId as string | undefined,
    userId: (user?.id ?? user?.userId) as string | undefined,
  };
}

export async function getBulkImportSessionStatus(
  req: Request,
  res: Response
) {
  try {
    const { schoolId } = getSchoolContext(req);
    const sessionId = String(req.params.sessionId || "");

    if (!schoolId || !sessionId) {
      return res.status(400).json({ message: "Invalid session context" });
    }

    const session = await getPersistentImportSession(sessionId, schoolId);

    if (!session) {
      return res.status(404).json({ message: "Import session not found" });
    }

    return res.json({
      message: "Import session retrieved",
      data: {
        id: session.id,
        module: session.module,
        status: session.status,
        originalFileName: session.originalFileName,
        totalRows: session.totalRows,
        validRows: session.validRows,
        invalidRows: session.invalidRows,
        errors: session.errors,
        expiresAt: session.expiresAt,
        committedAt: session.committedAt,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("getBulkImportSessionStatus:", error);
    return res.status(500).json({ message: "Unable to retrieve import session" });
  }
}
