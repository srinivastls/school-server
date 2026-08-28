"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLeaveRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useLeaveRoutes = (app) => {
    /* ============================================================
       TEACHER / USER
    ============================================================ */
    app.post("/leave/request", middlewares_1.authJwt.verifyToken, controllers_1.leaveControllers
        .createLeaveRequest);
    app.get("/leave/my", middlewares_1.authJwt.verifyToken, controllers_1.leaveControllers
        .getMyLeaveRequests);
    /* ============================================================
       ADMIN
    ============================================================ */
    app.get("/leave/pending", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin, controllers_1.leaveControllers
        .getPendingLeaveRequests);
    app.patch("/leave/update", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin, controllers_1.leaveControllers
        .updateLeaveRequest);
    app.get("/leave/history", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isAdmin, controllers_1.leaveControllers
        .getLeaveHistory);
};
exports.useLeaveRoutes = useLeaveRoutes;
