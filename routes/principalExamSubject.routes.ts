import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { principalExamSubjectControllers } from "../controllers";

const {
  verifyToken,
  isPrincipal,
  isAdmin,
  isPrincipalOrAdmin,
} = authJwt;
export const usePrincipalExamSubjectRoutes = (app: Express) => {

app.get("/api/principal-exam-subjects/options",[verifyToken, isPrincipalOrAdmin], principalExamSubjectControllers.getOptions);
app.get("/api/principal-exam-subjects", [verifyToken, isPrincipalOrAdmin], principalExamSubjectControllers.getAll);
app.post("/api/principal-exam-subjects", [verifyToken, isPrincipalOrAdmin], principalExamSubjectControllers.create);
app.put("/api/principal-exam-subjects/:examSubjectId", [verifyToken, isPrincipalOrAdmin], principalExamSubjectControllers.update);
app.delete("/api/principal-exam-subjects/:examSubjectId", [verifyToken, isPrincipalOrAdmin], principalExamSubjectControllers.delete);
}
