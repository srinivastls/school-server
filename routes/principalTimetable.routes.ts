import { Express } from "express";
import { principalTimetableControllers } from "../controllers";
import { authJwt } from "../middlewares";

export const usePrincipalTimetableRoutes = (app: Express) => {
  app.get("/api/principal-timetable/options", authJwt.verifyToken, authJwt.isPrincipal, principalTimetableControllers.getTimetableOptions);
  app.get("/api/principal-timetable", authJwt.verifyToken, authJwt.isPrincipal, principalTimetableControllers.getPrincipalTimetable);
  app.post("/api/principal-timetable", authJwt.verifyToken, authJwt.isPrincipal, principalTimetableControllers.createTimetableEntry);
  app.put("/api/principal-timetable/:timetableId", authJwt.verifyToken, authJwt.isPrincipal, principalTimetableControllers.updateTimetableEntry);
  app.delete("/api/principal-timetable/:timetableId", authJwt.verifyToken, authJwt.isPrincipal, principalTimetableControllers.deleteTimetableEntry);
};
