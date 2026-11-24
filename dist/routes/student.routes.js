"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudentRoutes = void 0;
const multer_1 = __importDefault(require("multer"));
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const { checkDuplicateStudent, checkSiblingsExist } = middlewares_1.studentMiddlewares;
const { verifyToken, isPrincipalOrAdmin } = middlewares_1.authJwt;
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const { createStudent, getStudentsByClass, getStudentByCoupon, getStudent, editStudent, groupStudentsByClassAndCount, promoteDemote, getStudentRegistrationOptions, getAllStudents, generateStudentIdCard, generateBulkStudentIdCards, } = controllers_1.studentcontrollers;
const useStudentRoutes = (app) => {
    app.post("/api/student/create", [verifyToken, isPrincipalOrAdmin, checkDuplicateStudent, checkSiblingsExist], createStudent);
    app.post("/api/student/getByClass", [verifyToken, isPrincipalOrAdmin], getStudentsByClass);
    app.post("/api/student/getByCoupon", [verifyToken], getStudentByCoupon);
    app.post("/api/student/get", [verifyToken], getStudent);
    app.post("/api/student/edit", [verifyToken, isPrincipalOrAdmin, checkSiblingsExist], editStudent);
    app.get("/api/students/getAll", [verifyToken, isPrincipalOrAdmin], getAllStudents);
    app.post("/api/student/:studentId/id-card", [verifyToken, isPrincipalOrAdmin, upload.single("photo")], generateStudentIdCard);
    app.post("/api/students/id-cards/bulk", [verifyToken, isPrincipalOrAdmin], generateBulkStudentIdCards);
    app.get("/api/student/classCounts", [verifyToken, isPrincipalOrAdmin], groupStudentsByClassAndCount);
    app.post("/api/student/promoteDemote", [verifyToken, isPrincipalOrAdmin], promoteDemote);
    app.get("/api/student/registrationOptions", [verifyToken, isPrincipalOrAdmin], getStudentRegistrationOptions);
};
exports.useStudentRoutes = useStudentRoutes;
