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

app.get("/api/principal-exam-subjects/options",[verifyToken, isPrincipal], principalExamSubjectControllers.getOptions);
app.get("/api/principal-exam-subjects", [verifyToken, isPrincipal], principalExamSubjectControllers.getAll);
app.post("/api/principal-exam-subjects", [verifyToken, isPrincipal], principalExamSubjectControllers.create);
app.put("/api/principal-exam-subjects/:examSubjectId", [verifyToken, isPrincipal], principalExamSubjectControllers.update);
app.delete("/api/principal-exam-subjects/:examSubjectId", [verifyToken, isPrincipal], principalExamSubjectControllers.delete);
}
