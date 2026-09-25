"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPersistentImportSession = createPersistentImportSession;
exports.getPersistentImportSession = getPersistentImportSession;
exports.markImportSessionCommitted = markImportSessionCommitted;
const config_1 = require("../config");
const SESSION_TTL_MINUTES = 30;
async function createPersistentImportSession(input) {
    const validRows = Math.max(input.rows.length - input.errors.length, 0);
    return config_1.prisma.bulkImportSession.create({
        data: {
            schoolId: input.schoolId,
            createdByUserId: input.createdByUserId,
            module: input.module,
            originalFileName: input.originalFileName,
            totalRows: input.rows.length,
            validRows,
            invalidRows: input.errors.length,
            rows: input.rows,
            errors: input.errors,
            expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60000),
            status: input.errors.length === 0
                ? "READY"
                : "FAILED",
        },
    });
}
async function getPersistentImportSession(sessionId, schoolId) {
    const session = await config_1.prisma.bulkImportSession.findFirst({
        where: { id: sessionId, schoolId },
    });
    if (!session)
        return null;
    if (session.status !== "COMMITTED" &&
        session.expiresAt.getTime() < Date.now()) {
        return config_1.prisma.bulkImportSession.update({
            where: { id: session.id },
            data: { status: "EXPIRED" },
        });
    }
    return session;
}
async function markImportSessionCommitted(sessionId, schoolId) {
    return config_1.prisma.bulkImportSession.updateMany({
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
