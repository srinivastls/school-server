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
exports.metadata = metadata;
exports.filterOptions = filterOptions;
exports.uploadAndValidate = uploadAndValidate;
exports.commit = commit;
exports.exportData = exportData;
exports.createStaff = createStaff;
const utils_1 = require("../utils");
const bulkImportExportService_1 = require("../services/bulkImportExportService");
const XLSX = __importStar(require("xlsx"));
const pdfkit_1 = __importDefault(require("pdfkit"));
async function metadata(_req, res) {
    try {
        res.json(await (0, bulkImportExportService_1.getImportMetadata)());
    }
    catch (err) {
        (0, utils_1.handleErr)(err, res);
    }
}
async function filterOptions(req, res) {
    try {
        res.json(await (0, bulkImportExportService_1.getExportFilterOptions)(req, String(req.params.module || ''), req.query || {}));
    }
    catch (err) {
        (0, utils_1.handleErr)(err, res);
    }
}
async function uploadAndValidate(req, res) {
    try {
        const moduleKey = String(req.params.module || '');
        if (!req.file?.buffer)
            return res.status(400).json({ message: 'Upload a CSV or XLSX file using field name "file"' });
        const ext = req.file.originalname.toLowerCase().split('.').pop();
        if (!['csv', 'xlsx'].includes(ext || ''))
            return res.status(400).json({ message: 'Only CSV and XLSX files are supported for import' });
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet)
            return res.status(400).json({ message: 'No worksheet found' });
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: undefined, raw: false, blankrows: false });
        let fieldMap = {};
        try {
            fieldMap = req.body?.fieldMap ? JSON.parse(req.body.fieldMap) : {};
        }
        catch {
            return res.status(400).json({ message: 'fieldMap must be valid JSON' });
        }
        const result = await (0, bulkImportExportService_1.stageImport)(req, moduleKey, req.file.originalname, rows, fieldMap);
        res.status(201).json(result);
    }
    catch (err) {
        (0, utils_1.handleErr)(err, res);
    }
}
async function commit(req, res) {
    try {
        const mode = req.body?.mode;
        if (!['create', 'update', 'both'].includes(mode))
            return res.status(400).json({ message: 'mode must be create, update, or both' });
        const result = await (0, bulkImportExportService_1.commitImport)(req, String(req.body?.sessionId || ''), mode);
        res.json(result);
    }
    catch (err) {
        (0, utils_1.handleErr)(err, res);
    }
}
async function exportData(req, res) {
    try {
        const moduleKey = String(req.params.module || ''), format = String(req.query.format || 'csv').toLowerCase();
        if (!['csv', 'xlsx', 'pdf'].includes(format))
            return res.status(400).json({ message: 'format must be csv, xlsx, or pdf' });
        const rows = await (0, bulkImportExportService_1.exportRows)(req, moduleKey, req.query);
        const fields = rows.length ? Object.keys(rows[0]) : [];
        const filename = `${moduleKey}-export-${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') {
            const ws = XLSX.utils.json_to_sheet(rows);
            const csv = XLSX.utils.sheet_to_csv(ws);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            return res.send('\uFEFF' + csv);
        }
        if (format === 'xlsx') {
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, 'Export');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
            return res.send(buffer);
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        const doc = new pdfkit_1.default({ size: 'A4', margin: 32, layout: 'landscape' });
        doc.pipe(res);
        doc.fontSize(16).text(`${moduleKey} export`, { align: 'center' });
        doc.moveDown();
        if (!fields.length)
            doc.fontSize(10).text('No records found.');
        else {
            const usable = 780, colW = Math.max(12, Math.min(usable / fields.length, 140));
            let y = doc.y;
            doc.fontSize(7).font('Helvetica-Bold');
            fields.forEach((f, i) => doc.text(f, 32 + i * colW, y, { width: colW - 4, continued: false }));
            y += 22;
            doc.font('Helvetica').fontSize(7);
            for (const row of rows) {
                if (y > 540) {
                    doc.addPage({ size: 'A4', layout: 'landscape', margin: 32 });
                    y = 32;
                }
                fields.forEach((f, i) => doc.text(String(row[f] ?? '').slice(0, 80), 32 + i * colW, y, { width: colW - 4, height: 18, ellipsis: true }));
                y += 18;
            }
        }
        doc.end();
    }
    catch (err) {
        (0, utils_1.handleErr)(err, res);
    }
}
async function createStaff(req, res) {
    try {
        const result = await (0, bulkImportExportService_1.createIndividualStaff)(req, req.body || {});
        res.status(201).json(result);
    }
    catch (err) {
        (0, utils_1.handleErr)(err, res);
    }
}
