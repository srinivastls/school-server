"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBulkImportSessionRoutes = void 0;
const bulkImportSession_controller_1 = require("../controllers/bulkImportSession.controller");
const middlewares_1 = require("../middlewares");
const useBulkImportSessionRoutes = (app) => {
    app.get("/api/admin/bulk/sessions/:sessionId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin, bulkImportSession_controller_1.getBulkImportSession);
};
exports.useBulkImportSessionRoutes = useBulkImportSessionRoutes;
