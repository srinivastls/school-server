"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudentRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { checkDuplicateStudent, checkSiblingsExist } = middlewares_1.studentMiddlewares;
const { verifyToken } = middlewares_1.authJwt;
const { createStudent, getStudentsByClass, getStudentByCoupon, getStudent, editStudent, groupStudentsByClassAndCount, promoteDemote, getStudentRegistrationOptions, } = controllers_1.studentcontrollers;
const useStudentRoutes = (app) => {
    app.post("/api/student/create", [verifyToken, checkDuplicateStudent, checkSiblingsExist], createStudent);
    app.post("/api/student/getByClass", [verifyToken], getStudentsByClass);
    app.post("/api/student/getByCoupon", [verifyToken], getStudentByCoupon);
    app.post("/api/student/get", [verifyToken], getStudent);
    app.post("/api/student/edit", [verifyToken, checkSiblingsExist], editStudent);
    app.get("/api/student/classCounts", [verifyToken], groupStudentsByClassAndCount);
    app.post("/api/student/promoteDemote", [verifyToken], promoteDemote);
    app.get("/api/student/registrationOptions", [verifyToken], getStudentRegistrationOptions);
};
exports.useStudentRoutes = useStudentRoutes;
