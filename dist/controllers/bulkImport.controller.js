"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkImportController = void 0;
const bulkTabular_service_1 = require("../services/bulkTabular.service");
const modules = ["students", "teachers", "parents", "transactions"];
const getContext = (req) => ({ schoolId: req.user?.schoolId, userId: req.userId });
const validModule = (value) => modules.includes(value);
exports.bulkImportController = {
    preview: async (req, res) => {
        try {
            const module = req.params.module;
            if (!validModule(module))
                return res.status(400).json({ message: "Unsupported import module" });
            const { schoolId, userId } = getContext(req);
            if (!schoolId || !userId)
                return res.status(401).json({ message: "School authentication required" });
            if (!req.file)
                return res.status(400).json({ message: "Upload a CSV or XLSX file" });
            const rows = (0, bulkTabular_service_1.parseTabularBuffer)(req.file.buffer, req.file.originalname);
            return res.status(200).json({ message: "Preview generated", data: (0, bulkTabular_service_1.createPreview)(schoolId, userId, module, rows) });
        }
        catch (error) {
            return res.status(400).json({ message: error?.message || "Unable to preview import" });
        }
    },
    commit: async (req, res) => {
        try {
            const module = req.params.module;
            if (!validModule(module))
                return res.status(400).json({ message: "Unsupported import module" });
            const { schoolId, userId } = getContext(req);
            if (!schoolId || !userId)
                return res.status(401).json({ message: "School authentication required" });
            if (!req.body?.previewId)
                return res.status(400).json({ message: "previewId is required" });
            const result = await (0, bulkTabular_service_1.commitPreview)(req.body.previewId, schoolId, userId, module);
            return res.status(200).json({ message: "Import committed", data: result });
        }
        catch (error) {
            return res.status(400).json({ message: error?.message || "Unable to commit import" });
        }
    },
};
