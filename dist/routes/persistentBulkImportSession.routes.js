"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePersistentBulkImportSessionRoutes = void 0;
const middlewares_1 = require("../middlewares");
const persistentBulkImportSession_controller_1 = require("../controllers/persistentBulkImportSession.controller");
const usePersistentBulkImportSessionRoutes = (app) => {
    app.get("/api/admin/bulk/sessions/:sessionId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin, persistentBulkImportSession_controller_1.getBulkImportSessionStatus);
};
exports.usePersistentBulkImportSessionRoutes = usePersistentBulkImportSessionRoutes;
