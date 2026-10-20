import { Express } from 'express';
import multer from 'multer';
import { authJwt } from '../middlewares/authJwt';
import * as controller from '../controllers/bulkImportExportController';

const upload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:15*1024*1024,files:1,fields:10,fieldSize:1024*1024},
  fileFilter:(_req,file,cb)=>{
    const ext=file.originalname.toLowerCase().split('.').pop();
    if(ext==='csv'||ext==='xlsx') return cb(null,true);
    cb(new Error('Only .csv and .xlsx files are supported'));
  }
});
export const useBulkImportExportRoutes = (app: Express) => {
  app.get('/api/bulk-data/metadata', [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], controller.metadata);
  app.post('/api/bulk-data/import/:module/validate',upload.single('file'), [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], controller.uploadAndValidate,(err:any,_req:any,res:any,next:any)=>{
  if(!err) return next();
  if(err instanceof multer.MulterError){
    const message=err.code==='LIMIT_FILE_SIZE'?'File exceeds the 15 MB upload limit':err.code==='LIMIT_UNEXPECTED_FILE'?'Upload exactly one file using the field name \"file\"':`Upload failed: ${err.message}`;
    return res.status(400).json({message});
  }
  return res.status(400).json({message:err.message||'Upload failed'});
});


  app.post('/api/bulk-data/import/commit', [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], controller.commit);
  app.get('/api/bulk-data/export/:module/filter-options', [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], controller.filterOptions);
  app.post('/api/bulk-data/staff/individual', [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], controller.createStaff);
  app.get('/api/bulk-data/export/:module', [authJwt.verifyToken, authJwt.isPrincipalOrAdmin], controller.exportData);
};



