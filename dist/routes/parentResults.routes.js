"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useParentResultsRoutes = void 0;
const authJwt_1 = require("../middlewares/authJwt");
const parentResults_controller_1 = require("../controllers/parentResults.controller");
const useParentResultsRoutes = (app) => {
    app.get("/api/parent/results/children", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isParent, parentResults_controller_1.getParentResultChildren);
    app.get("/api/parent/results", authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isParent, parentResults_controller_1.getParentStudentResults);
};
exports.useParentResultsRoutes = useParentResultsRoutes;
