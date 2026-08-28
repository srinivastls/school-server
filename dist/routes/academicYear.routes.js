"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAcademicYearRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useAcademicYearRoutes = (app) => {
    /* ==========================================================
       GET ALL
       
       GET /academic-year
    ========================================================== */
    app.get("/api/academic-year", middlewares_1.authJwt.verifyToken, controllers_1.academicYearControllers.getAcademicYears);
    /* ==========================================================
       GET CURRENT
       
       GET /academic-year/current
    ========================================================== */
    app.get("/api/academic-year/current", middlewares_1.authJwt.verifyToken, controllers_1.academicYearControllers.getCurrentAcademicYear);
    /* ==========================================================
       GET BY ID
       
       GET /academic-year/:academicYearId
    ========================================================== */
    app.get("/academic-year/:academicYearId", middlewares_1.authJwt.verifyToken, controllers_1.academicYearControllers.getAcademicYearById);
    /* ==========================================================
       CREATE
       
       POST /academic-year
    ========================================================== */
    app.post("/api/academic-year", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.academicYearControllers.createAcademicYear);
    /* ==========================================================
       SET CURRENT
       
       PATCH /academic-year/:academicYearId/current
    ========================================================== */
    app.patch("/api/academic-year/:academicYearId/current", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.academicYearControllers.setCurrentAcademicYear);
    app.post("/api/academic-year/populate", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.academicYearControllers.populateAcademicYear);
};
exports.useAcademicYearRoutes = useAcademicYearRoutes;
