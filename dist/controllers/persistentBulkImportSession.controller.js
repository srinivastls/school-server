"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBulkImportSessionStatus = getBulkImportSessionStatus;
const persistentBulkImportSession_service_1 = require("../services/persistentBulkImportSession.service");
function getSchoolContext(req) {
    const user = req.user;
    return {
        schoolId: user?.schoolId,
        userId: (user?.id ?? user?.userId),
    };
}
async function getBulkImportSessionStatus(req, res) {
    try {
        const { schoolId } = getSchoolContext(req);
        const sessionId = String(req.params.sessionId || "");
        if (!schoolId || !sessionId) {
            return res.status(400).json({ message: "Invalid session context" });
        }
        const session = await (0, persistentBulkImportSession_service_1.getPersistentImportSession)(sessionId, schoolId);
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
    }
    catch (error) {
        console.error("getBulkImportSessionStatus:", error);
        return res.status(500).json({ message: "Unable to retrieve import session" });
    }
}
