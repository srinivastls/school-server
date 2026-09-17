import { Express } from "express";

import {
  authJwt,
} from "../middlewares";

import * as teacherMarksControllers
  from "../controllers/teacherMarks.controllers";

export const useTeacherMarksRoutes = (
  app: Express
) => {

app.get(
  "/api/marks/teacher/options",
  authJwt.verifyToken,
  teacherMarksControllers
    .getTeacherMarksOptions
);


app.get(
  "/api/marks/teacher/entry",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherMarksControllers
    .getTeacherMarksEntry
);


app.post(
  "/api/marks/teacher/entry",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherMarksControllers
    .saveTeacherMarks
);
}
