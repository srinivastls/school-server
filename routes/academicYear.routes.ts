import { Express } from "express";
import { academicYearControllers } from "../controllers";

import { authJwt } from "../middlewares";
const { verifyToken } = authJwt;
export const useAcademicYearRoutes = (app: Express) => {
app.get(
  "/academic-year",
  verifyToken,
  academicYearControllers.getAcademicYears
);

}