"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useReportRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useReportRoutes = (app) => {
    app.get("/api/report/getUnpaidPercStudents", [middlewares_1.authJwt.verifyToken], controllers_1.reportControllers.getPercUnpaidStudents);
    app.post("/api/report/getMonthOrDateReport", [middlewares_1.authJwt.verifyToken], controllers_1.reportControllers.getMonthOrDateReport);
    app.post("/api/report/getStudentMonthOrDateReport", [middlewares_1.authJwt.verifyToken], controllers_1.reportControllers.getStudentMonthOrDateReport);
    app.get("/api/report/getPendingDues", [middlewares_1.authJwt.verifyToken], controllers_1.reportControllers.getPendingDues);
};
exports.useReportRoutes = useReportRoutes;
