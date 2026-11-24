import { Express } from "express";
import multer from "multer";
import { studentcontrollers } from "../controllers";
import { authJwt, studentMiddlewares } from "../middlewares";

const { checkDuplicateStudent, checkSiblingsExist } = studentMiddlewares;
const { verifyToken, isPrincipalOrAdmin } = authJwt;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const {
  createStudent,
  getStudentsByClass,
  getStudentByCoupon,
  getStudent,
  editStudent,
  groupStudentsByClassAndCount,
  promoteDemote,
  getStudentRegistrationOptions,
  getAllStudents,
  generateStudentIdCard,
  generateBulkStudentIdCards,
} = studentcontrollers;

export const useStudentRoutes = (app: Express) => {
  app.post(
    "/api/student/create",
    [verifyToken, isPrincipalOrAdmin, checkDuplicateStudent, checkSiblingsExist],
    createStudent
  );

  app.post("/api/student/getByClass", [verifyToken, isPrincipalOrAdmin], getStudentsByClass);

  app.post("/api/student/getByCoupon", [verifyToken], getStudentByCoupon);

  app.post("/api/student/get", [verifyToken], getStudent);

  app.post("/api/student/edit", [verifyToken, isPrincipalOrAdmin, checkSiblingsExist], editStudent);

  app.get("/api/students/getAll", [verifyToken, isPrincipalOrAdmin], getAllStudents);

  app.post(
    "/api/student/:studentId/id-card",
    [verifyToken, isPrincipalOrAdmin, upload.single("photo")],
    generateStudentIdCard
  );

  app.post(
    "/api/students/id-cards/bulk",
    [verifyToken, isPrincipalOrAdmin],
    generateBulkStudentIdCards
  );

  app.get(
    "/api/student/classCounts",
    [verifyToken, isPrincipalOrAdmin],
    groupStudentsByClassAndCount
  );

  app.post("/api/student/promoteDemote", [verifyToken, isPrincipalOrAdmin], promoteDemote);

  app.get("/api/student/registrationOptions", [verifyToken, isPrincipalOrAdmin], getStudentRegistrationOptions);
};
