"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useClassRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useClassRoutes = (app) => {
    app.post("/api/class/create", [middlewares_1.authJwt.verifyToken, middlewares_1.classMiddleWares.checkDuplicateClass], controllers_1.classControllers.createClass);
    app.get("/api/class/getAll", [middlewares_1.authJwt.verifyToken], controllers_1.classControllers.getAllClasses);
    app.post("/api/class/delete", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isSuperAdmin], controllers_1.classControllers.deleteClass);
    app.get("/api/class/get", [middlewares_1.authJwt.verifyToken], controllers_1.classControllers.getClassDetails);
    app.post("/api/class/edit", [
        middlewares_1.authJwt.verifyToken,
        middlewares_1.authJwt.isSuperAdmin,
        middlewares_1.classMiddleWares.checkClassExists,
    ], controllers_1.classControllers.editClassDetails);
    app.post("/api/class/markAsCompleted", [middlewares_1.authJwt.verifyToken], controllers_1.classControllers.markClassAsCompleted);
};
exports.useClassRoutes = useClassRoutes;
