import { prisma } from "../config";

export type BulkSessionModule = "students" | "teachers" | "parents" | "transactions";

const SESSION_TTL_MINUTES = 15;

export const createBulkImportSession = async (input: {
  schoolId: string;
  createdByUserId: string;
  module: BulkSessionModule;
  originalFileName: string;
  rowCount: number;
  validRows: number;
  invalidRows: number;
  payload: unknown;
  errors?: unknown;
}) => {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);
  return (prisma as any).bulkImportSession.create({
    data: {
      schoolId: input.schoolId,
      createdByUserId: input.createdByUserId,
      module: input.module,
      originalFileName: input.originalFileName,
      rowCount: input.rowCount,
      validRows: input.validRows,
      invalidRows: input.invalidRows,
      payload: input.payload as any,
      errors: input.errors as any,
      expiresAt,
    },
  });
};

export const getActiveBulkImportSession = async (input: {
  id: string;
  schoolId: string;
}) => {
  const session = await (prisma as any).bulkImportSession.findFirst({
    where: { id: input.id, schoolId: input.schoolId },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await (prisma as any).bulkImportSession.update({
      where: { id: session.id },
      data: { status: "EXPIRED" },
    });
    return null;
  }
  return session;
};

export const markBulkImportCommitted = async (id: string, schoolId: string) =>
  (prisma as any).bulkImportSession.updateMany({
    where: { id, schoolId, status: "READY" },
    data: { status: "COMMITTED", committedAt: new Date() },
  });
