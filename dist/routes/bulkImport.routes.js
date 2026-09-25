"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBulkImportRoutes = void 0;
const multer_1 = __importDefault(require("multer"));
const middlewares_1 = require("../middlewares");
const bulkImport_controller_1 = require("../controllers/bulkImport.controller");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const useBulkImportRoutes = (app) => {
    app.post("/api/admin/bulk/:module/preview", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isPrincipalOrAdmin,
        upload.single("file"),
    ], (req, res, next) => {
        console.log("=== BULK UPLOAD DEBUG ===");
        console.log("Module:", req.params.module);
        console.log("Content-Type:", req.headers["content-type"]);
        console.log("File:", req.file
            ? {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length,
            }
            : undefined);
        next();
    }, bulkImport_controller_1.bulkImportController.preview);
    app.post("/api/admin/bulk/:module/commit", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipalOrAdmin], bulkImport_controller_1.bulkImportController.commit);
};
exports.useBulkImportRoutes = useBulkImportRoutes;
