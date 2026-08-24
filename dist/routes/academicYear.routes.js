"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAcademicYearRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { verifyToken } = middlewares_1.authJwt;
const useAcademicYearRoutes = (app) => {
    app.get("/academic-year", verifyToken, controllers_1.academicYearControllers.getAcademicYears);
};
exports.useAcademicYearRoutes = useAcademicYearRoutes;
