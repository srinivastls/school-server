import { Express } from "express";

import { authJwt } from "../middlewares";
import * as teacherTimetableControllers from "../controllers/";

export const useTeacherTimetableRoutes = (app: Express) => {

app.get(
  "/api/teacher-timetable/my-timetable",
  authJwt.verifyToken,
    authJwt.isTeacher,
  teacherTimetableControllers.getMyTimetable
);

}