import { Request, Response } from "express";
import { getActiveBulkImportSession } from "../services/bulkImportSession.service";

export const getBulkImportSession = async (req: Request, res: Response) => {
  const schoolId = (req as any).user?.schoolId;
  const sessionId = req.params.sessionId;
  if (!schoolId || !sessionId) {
    return res.status(400).json({ message: "schoolId and sessionId are required" });
  }
  const session = await getActiveBulkImportSession({ id: sessionId, schoolId });
  if (!session) return res.status(404).json({ message: "Session not found or expired" });
  return res.json({
    message: "Bulk import session fetched",
    data: {
      id: session.id,
      module: session.module,
      status: session.status,
      rowCount: session.rowCount,
      validRows: session.validRows,
      invalidRows: session.invalidRows,
      originalFileName: session.originalFileName,
      expiresAt: session.expiresAt,
      errors: session.errors,
    },
  });
};
