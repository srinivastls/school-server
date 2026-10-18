"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalExamTimetableRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const controllers_1 = require("../controllers");
const { verifyToken, isPrincipal, isAdmin, isPrincipalOrAdmin, } = authJwt_1.authJwt;
const usePrincipalExamTimetableRoutes = (app) => {
    app.get("/api/principal-exam-timetable/options", [verifyToken, isPrincipal], controllers_1.principalExamTimetableControllers.getOptions);
    app.get("/api/principal-exam-timetable", [verifyToken, isPrincipal], controllers_1.principalExamTimetableControllers.getAll);
    app.post("/api/principal-exam-timetable", [verifyToken, isPrincipal], controllers_1.principalExamTimetableControllers.create);
    app.put("/api/principal-exam-timetable/:timetableId", [verifyToken, isPrincipal], controllers_1.principalExamTimetableControllers.update);
    app.delete("/api/principal-exam-timetable/:timetableId", [verifyToken, isPrincipal], controllers_1.principalExamTimetableControllers.delete);
};
exports.usePrincipalExamTimetableRoutes = usePrincipalExamTimetableRoutes;
