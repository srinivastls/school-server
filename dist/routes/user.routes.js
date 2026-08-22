"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useUserRoutes = void 0;
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const useUserRoutes = (app) => {
    app.get("/api/users/getAll", [middlewares_1.authJwt.verifyToken, middlewares_1.authJwt.isSuperAdmin], controllers_1.userController.getAllUsers);
};
exports.useUserRoutes = useUserRoutes;
