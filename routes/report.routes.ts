import { Express } from "express";
import { reportControllers } from "../controllers";
import { authJwt } from "../middlewares";


export const useReportRoutes = (app: Express) => {
  app.get(
    "/api/report/getUnpaidPercStudents",
    [authJwt.verifyToken],
    reportControllers.getPercUnpaidStudents
  );

  app.post(
    "/api/report/getMonthOrDateReport",
    [authJwt.verifyToken],
    reportControllers.getMonthOrDateReport
  );

  app.post(
    "/api/report/getStudentMonthOrDateReport",
    [authJwt.verifyToken],
    reportControllers.getStudentMonthOrDateReport
  );

  app.get(
  "/api/report/getPendingDues",
  [authJwt.verifyToken],
  reportControllers.getPendingDues
);
};
