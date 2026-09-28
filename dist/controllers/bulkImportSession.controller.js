"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBulkImportSession = void 0;
const bulkImportSession_service_1 = require("../services/bulkImportSession.service");
const getBulkImportSession = async (req, res) => {
    const schoolId = req.user?.schoolId;
    const sessionId = req.params.sessionId;
    if (!schoolId || !sessionId) {
        return res.status(400).json({ message: "schoolId and sessionId are required" });
    }
    const session = await (0, bulkImportSession_service_1.getActiveBulkImportSession)({ id: sessionId, schoolId });
    if (!session)
        return res.status(404).json({ message: "Session not found or expired" });
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
exports.getBulkImportSession = getBulkImportSession;
