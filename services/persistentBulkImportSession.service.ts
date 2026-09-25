
import { BulkImportSession,Prisma } from "@prisma/client";
import { prisma } from "../config";

export type SessionRow = Record<string, unknown>;
export type SessionError = {
  rowNumber: number;
  field?: string;
  message: string;
};

const SESSION_TTL_MINUTES = 30;

export async function createPersistentImportSession(input: {
  schoolId: string;
  createdByUserId: string;
  module: string;
  originalFileName: string;
  rows: SessionRow[];
  errors: SessionError[];
}) {
  const validRows = Math.max(input.rows.length - input.errors.length, 0);

  return (prisma as any).bulkImportSession.create({
    data: {
      schoolId: input.schoolId,
      createdByUserId: input.createdByUserId,
      module: input.module,
      originalFileName: input.originalFileName,
      totalRows: input.rows.length,
      validRows,
      invalidRows: input.errors.length,
      rows: input.rows as Prisma.InputJsonValue,
      errors: input.errors as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60_000),
      status:
        input.errors.length === 0
          ? "READY"
          : "FAILED",
    },
  });
}

export async function getPersistentImportSession(
  sessionId: string,
  schoolId: string
) {
  const session = await (prisma as any).bulkImportSession.findFirst({
    where: { id: sessionId, schoolId },
  });

  if (!session) return null;

  if (
    session.status !== "COMMITTED" &&
    session.expiresAt.getTime() < Date.now()
  ) {
    return (prisma as any).bulkImportSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
  }

  return session;
}

export async function markImportSessionCommitted(
  sessionId: string,
  schoolId: string
) {
  return (prisma as any).bulkImportSession.updateMany({
    where: {
      id: sessionId,
      schoolId,
      status: "READY",
    },
    data: {
      status: "COMMITTED",
      committedAt: new Date(),
    },
  });
}
