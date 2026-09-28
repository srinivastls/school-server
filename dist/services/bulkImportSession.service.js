"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markBulkImportCommitted = exports.getActiveBulkImportSession = exports.createBulkImportSession = void 0;
const config_1 = require("../config");
const SESSION_TTL_MINUTES = 15;
const createBulkImportSession = async (input) => {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60000);
    return config_1.prisma.bulkImportSession.create({
        data: {
            schoolId: input.schoolId,
            createdByUserId: input.createdByUserId,
            module: input.module,
            originalFileName: input.originalFileName,
            rowCount: input.rowCount,
            validRows: input.validRows,
            invalidRows: input.invalidRows,
            payload: input.payload,
            errors: input.errors,
            expiresAt,
        },
    });
};
exports.createBulkImportSession = createBulkImportSession;
const getActiveBulkImportSession = async (input) => {
    const session = await config_1.prisma.bulkImportSession.findFirst({
        where: { id: input.id, schoolId: input.schoolId },
    });
    if (!session)
        return null;
    if (session.expiresAt.getTime() < Date.now()) {
        await config_1.prisma.bulkImportSession.update({
            where: { id: session.id },
            data: { status: "EXPIRED" },
        });
        return null;
    }
    return session;
};
exports.getActiveBulkImportSession = getActiveBulkImportSession;
const markBulkImportCommitted = async (id, schoolId) => config_1.prisma.bulkImportSession.updateMany({
    where: { id, schoolId, status: "READY" },
    data: { status: "COMMITTED", committedAt: new Date() },
});
exports.markBulkImportCommitted = markBulkImportCommitted;
