"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePrincipalTimetableRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const usePrincipalTimetableRoutes = (app) => {
    app.get("/api/principal-timetable/options", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.principalTimetableControllers.getTimetableOptions);
    app.get("/api/principal-timetable", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.principalTimetableControllers.getPrincipalTimetable);
    app.post("/api/principal-timetable", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.principalTimetableControllers.createTimetableEntry);
    app.put("/api/principal-timetable/:timetableId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.principalTimetableControllers.updateTimetableEntry);
    app.delete("/api/principal-timetable/:timetableId", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.principalTimetableControllers.deleteTimetableEntry);
};
exports.usePrincipalTimetableRoutes = usePrincipalTimetableRoutes;
