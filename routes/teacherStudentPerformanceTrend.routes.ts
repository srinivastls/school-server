import { Express } from "express";
import { authJwt } from "../middlewares/authJwt";
import { getTeacherPerformanceTrendOptions, getTeacherPerformanceTrends } from "../controllers/teacherStudentPerformanceTrendControllers";
export const useTeacherStudentPerformanceTrendRoutes = (app: Express) => {
    app.get("/api/teacher-student-performance-trends/options", authJwt.verifyToken, authJwt.isTeacher, getTeacherPerformanceTrendOptions);
    app.get("/api/teacher-student-performance-trends", authJwt.verifyToken, authJwt.isTeacher, getTeacherPerformanceTrends);
};
