import { Express } from "express";
import { principalTimetableControllers } from "../controllers";
import { authJwt } from "../middlewares";
const { verifyToken, isPrincipalOrAdmin, isPrincipal } = authJwt;

export const usePrincipalTimetableRoutes = (app: Express) => {
  app.get("/api/principal-timetable/options", verifyToken, isPrincipalOrAdmin, principalTimetableControllers.getTimetableOptions);
  app.get("/api/principal-timetable", verifyToken, isPrincipalOrAdmin, principalTimetableControllers.getPrincipalTimetable);
  app.post("/api/principal-timetable", verifyToken, isPrincipalOrAdmin, principalTimetableControllers.createTimetableEntry);
  app.put("/api/principal-timetable/:timetableId", verifyToken, isPrincipalOrAdmin, principalTimetableControllers.updateTimetableEntry);
  app.delete("/api/principal-timetable/:timetableId", verifyToken, isPrincipalOrAdmin, principalTimetableControllers.deleteTimetableEntry);
};
