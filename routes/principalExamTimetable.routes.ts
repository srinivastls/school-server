import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { principalExamTimetableControllers } from "../controllers";

const {
  verifyToken,
  isPrincipal,
  isAdmin,
  isPrincipalOrAdmin,
} = authJwt;
export const usePrincipalExamTimetableRoutes = (app: Express) => {

app.get("/api/principal-exam-timetable/options",[verifyToken, isPrincipal] , principalExamTimetableControllers.getOptions);
app.get("/api/principal-exam-timetable",[verifyToken, isPrincipal] , principalExamTimetableControllers.getAll);
app.post("/api/principal-exam-timetable", [verifyToken, isPrincipal], principalExamTimetableControllers.create);
app.put("/api/principal-exam-timetable/:timetableId", [verifyToken, isPrincipal], principalExamTimetableControllers.update);
app.delete("/api/principal-exam-timetable/:timetableId", [verifyToken, isPrincipal], principalExamTimetableControllers.delete);
}
