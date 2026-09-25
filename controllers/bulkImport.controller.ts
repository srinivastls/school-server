import { Request, Response } from "express";
import { parseTabularBuffer, BulkModule,commitPreview, createPreview } from "../services/bulkTabular.service";


const modules: BulkModule[] = ["students", "teachers", "parents", "transactions"];
const getContext = (req: Request) => ({ schoolId: req.user?.schoolId, userId: req.userId });
const validModule = (value: string): value is BulkModule => modules.includes(value as BulkModule);

export const bulkImportController = {
  preview: async (req: Request, res: Response) => {
    try {
      const module = req.params.module;
      if (!validModule(module)) return res.status(400).json({ message: "Unsupported import module" });
      const { schoolId, userId } = getContext(req);
      if (!schoolId || !userId) return res.status(401).json({ message: "School authentication required" });
      if (!req.file) return res.status(400).json({ message: "Upload a CSV or XLSX file" });
      const rows = parseTabularBuffer(req.file.buffer, req.file.originalname);
      return res.status(200).json({ message: "Preview generated", data: createPreview(schoolId, userId, module, rows) });
    } catch (error: any) { return res.status(400).json({ message: error?.message || "Unable to preview import" }); }
  },
  commit: async (req: Request, res: Response) => {
    try {
      const module = req.params.module;
      if (!validModule(module)) return res.status(400).json({ message: "Unsupported import module" });
      const { schoolId, userId } = getContext(req);
      if (!schoolId || !userId) return res.status(401).json({ message: "School authentication required" });
      if (!req.body?.previewId) return res.status(400).json({ message: "previewId is required" });
      const result = await commitPreview(req.body.previewId, schoolId, userId, module);
      return res.status(200).json({ message: "Import committed", data: result });
    } catch (error: any) { return res.status(400).json({ message: error?.message || "Unable to commit import" }); }
  },
};
