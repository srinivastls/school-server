"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useParentRoutes = void 0;
const parent_controller_1 = require("../controllers/parent.controller");
const middlewares_1 = require("../middlewares");
/* ============================================================
   PARENT DASHBOARD
============================================================ */
const { verifyToken, isPrincipal, isParent, } = middlewares_1.authJwt;
const useParentRoutes = (app) => {
    app.get("/api/parent/dashboard", [
        verifyToken,
        isParent,
    ], parent_controller_1.parentController.getParentDashboard);
};
exports.useParentRoutes = useParentRoutes;
