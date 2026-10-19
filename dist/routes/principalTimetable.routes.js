"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalTimetableRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { verifyToken, isPrincipalOrAdmin, isPrincipal } = middlewares_1.authJwt;
const usePrincipalTimetableRoutes = (app) => {
    app.get("/api/principal-timetable/options", verifyToken, isPrincipalOrAdmin, controllers_1.principalTimetableControllers.getTimetableOptions);
    app.get("/api/principal-timetable", verifyToken, isPrincipalOrAdmin, controllers_1.principalTimetableControllers.getPrincipalTimetable);
    app.post("/api/principal-timetable", verifyToken, isPrincipalOrAdmin, controllers_1.principalTimetableControllers.createTimetableEntry);
    app.put("/api/principal-timetable/:timetableId", verifyToken, isPrincipalOrAdmin, controllers_1.principalTimetableControllers.updateTimetableEntry);
    app.delete("/api/principal-timetable/:timetableId", verifyToken, isPrincipalOrAdmin, controllers_1.principalTimetableControllers.deleteTimetableEntry);
};
exports.usePrincipalTimetableRoutes = usePrincipalTimetableRoutes;
