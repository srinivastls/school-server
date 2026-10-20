"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const authJwt_1 = require("../middlewares/authJwt");
const controller = __importStar(require("../controllers/bulkImportExportController"));
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 10, fieldSize: 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.toLowerCase().split('.').pop();
        if (ext === 'csv' || ext === 'xlsx')
            return cb(null, true);
        cb(new Error('Only .csv and .xlsx files are supported'));
    }
});
router.use(authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isPrincipal);
router.get('/metadata', controller.metadata);
router.get('/export/:module/filter-options', controller.filterOptions);
router.post('/import/:module/validate', upload.single('file'), controller.uploadAndValidate, (err, _req, res, next) => {
    if (!err)
        return next();
    if (err instanceof multer_1.default.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 15 MB upload limit' : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Upload exactly one file using the field name \"file\"' : `Upload failed: ${err.message}`;
        return res.status(400).json({ message });
    }
    return res.status(400).json({ message: err.message || 'Upload failed' });
});
router.post('/import/commit', controller.commit);
router.post('/staff/individual', controller.createStaff);
router.get('/export/:module', controller.exportData);
exports.default = router;
