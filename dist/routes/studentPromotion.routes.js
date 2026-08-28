"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudentPromotionRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
/* ============================================================
   STUDENT PROMOTION ROUTES
============================================================ */
const useStudentPromotionRoutes = (app) => {
    /* ----------------------------------------------------------
       GET STUDENTS FOR PROMOTION
    ---------------------------------------------------------- */
    app.get("/academic-year/promotion/students", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.studentPromotionControllers
        .getPromotionStudents);
    app.post("/academic-year/promotion/student", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.studentPromotionControllers
        .processStudentPromotion);
    app.post("/academic-year/promotion/students/bulk", middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isPrincipal, controllers_1.studentPromotionControllers
        .processBulkStudentPromotion);
};
exports.useStudentPromotionRoutes = useStudentPromotionRoutes;
