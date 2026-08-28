import { Express } from "express";
import { studentcontrollers } from "../controllers";
import { authJwt, studentMiddlewares } from "../middlewares";

const { checkDuplicateStudent, checkSiblingsExist } = studentMiddlewares;
const { verifyToken } = authJwt;

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
} = studentcontrollers;

export const useStudentRoutes = (app: Express) => {
  app.post(
    "/api/student/create",
    [verifyToken, checkDuplicateStudent, checkSiblingsExist],
    createStudent
  );

  app.post("/api/student/getByClass", [verifyToken], getStudentsByClass);

  app.post("/api/student/getByCoupon", [verifyToken], getStudentByCoupon);

  app.post("/api/student/get", [verifyToken], getStudent);

  app.post("/api/student/edit", [verifyToken, checkSiblingsExist], editStudent);

  app.get("/api/students/getAll", [verifyToken], getAllStudents);

  app.get(
    "/api/student/classCounts",
    [verifyToken],
    groupStudentsByClassAndCount
  );

  app.post("/api/student/promoteDemote", [verifyToken], promoteDemote);

  app.get("/api/student/registrationOptions", [verifyToken], getStudentRegistrationOptions);
};
