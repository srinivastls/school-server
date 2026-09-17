import { Express } from "express";
import {
  authJwt,
} from "../middlewares";
import * as teacherLeaveControllers from "../controllers";


export const  useTeacherLeaveRoutes = (app: Express) => {

app.get(
  "/api/teacher-leave/my-leaves",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherLeaveControllers.getMyLeaveRequests
);

app.post(
  "/api/teacher-leave/",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherLeaveControllers.applyForLeave
);

app.delete(
  "/api/teacher-leave/:id",
  authJwt.verifyToken,
  authJwt.isTeacher,
  teacherLeaveControllers.cancelLeaveRequest
);

}
