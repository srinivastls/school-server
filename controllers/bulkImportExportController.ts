import { Request, Response } from '../types';
import { handleErr } from '../utils';
import { getImportMetadata, stageImport, commitImport, exportRows, createIndividualStaff, getExportFilterOptions } from '../services/bulkImportExport.service';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

export async function metadata(_req: Request, res: Response) {
  try { res.json(await getImportMetadata()); } catch(err) { handleErr(err,res); }
}
export async function filterOptions(req: any, res: Response) {
  try { res.json(await getExportFilterOptions(req, String(req.params.module || ''), req.query || {})); } catch(err) { handleErr(err,res); }
}
export async function uploadAndValidate(req: any, res: Response) {
  try {
    const moduleKey = String(req.params.module || '');
    if (!req.file?.buffer) return res.status(400).json({message:'Upload a CSV or XLSX file using field name "file"'});
    const ext = req.file.originalname.toLowerCase().split('.').pop();
    if (!['csv','xlsx'].includes(ext || '')) return res.status(400).json({message:'Only CSV and XLSX files are supported for import'});
    const workbook = XLSX.read(req.file.buffer, {type:'buffer', cellDates:true, raw:false, codepage:65001});
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return res.status(400).json({message:'No worksheet found'});
    const rows = XLSX.utils.sheet_to_json<Record<string,any>>(sheet,{defval:undefined,raw:false,blankrows:false});
    if (!rows.length) return res.status(400).json({message:'No data rows found. Ensure the first row contains column headers and the file has at least one data row.'});
    let fieldMap: Record<string,string> = {}; try { fieldMap = req.body?.fieldMap ? JSON.parse(req.body.fieldMap) : {}; } catch { return res.status(400).json({message:'fieldMap must be valid JSON'}); }
    const result = await stageImport(req,moduleKey,req.file.originalname,rows,fieldMap);
    res.status(201).json(result);
  } catch(err) { handleErr(err,res); }
}
export async function commit(req: any, res: Response) {
  try {
    const mode = req.body?.mode;
    if (!['create','update','both'].includes(mode)) return res.status(400).json({message:'mode must be create, update, or both'});
    const result = await commitImport(req,String(req.body?.sessionId || ''),mode);
    res.json(result);
  } catch(err) { handleErr(err,res); }
}
export async function exportData(req: any, res: Response) {
  try {
    const moduleKey=String(req.params.module || ''), format=String(req.query.format || 'csv').toLowerCase();
    if (!['csv','xlsx','pdf'].includes(format)) return res.status(400).json({message:'format must be csv, xlsx, or pdf'});
    const rows=await exportRows(req,moduleKey,req.query);
    const fields = rows.length ? Object.keys(rows[0]) : [];
    const filename=`${moduleKey}-export-${new Date().toISOString().slice(0,10)}`;
    if(format==='csv') {
      const ws=XLSX.utils.json_to_sheet(rows); const csv=XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition',`attachment; filename="${filename}.csv"`); return res.send('\uFEFF'+csv);
    }
    if(format==='xlsx') {
      const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,'Export');
      const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition',`attachment; filename="${filename}.xlsx"`); return res.send(buffer);
    }
    res.setHeader('Content-Type','application/pdf'); res.setHeader('Content-Disposition',`attachment; filename="${filename}.pdf"`);
    const doc=new PDFDocument({size:'A4',margin:32,layout:'landscape'}); doc.pipe(res); doc.fontSize(16).text(`${moduleKey} export`,{align:'center'}); doc.moveDown();
    if(!fields.length) doc.fontSize(10).text('No records found.');
    else {
      const usable=780, colW=Math.max(12,Math.min(usable/fields.length,140)); let y=doc.y;
      doc.fontSize(7).font('Helvetica-Bold'); fields.forEach((f,i)=>doc.text(f,32+i*colW,y,{width:colW-4,continued:false})); y+=22; doc.font('Helvetica').fontSize(7);
      for(const row of rows) { if(y>540){doc.addPage({size:'A4',layout:'landscape',margin:32}); y=32;} fields.forEach((f,i)=>doc.text(String(row[f]??'').slice(0,80),32+i*colW,y,{width:colW-4,height:18,ellipsis:true})); y+=18; }
    }
    doc.end();
  } catch(err) { handleErr(err,res); }
}

export async function createStaff(req: any, res: Response) {
  try { const result = await createIndividualStaff(req, req.body || {}); res.status(201).json(result); } catch(err) { handleErr(err,res); }
}
