"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTestRoutes = void 0;
const controllers_1 = require("../controllers");
const authJwt_1 = require("../middlewares/authJwt");
const useTestRoutes = (app) => {
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept");
        next();
    });
    app.get("/api/test/all", controllers_1.testController.allAccess);
    app.get("/api/test/superadmin", [authJwt_1.authJwt.verifyToken, authJwt_1.authJwt.isSuperAdmin], controllers_1.testController.adminBoard);
};
exports.useTestRoutes = useTestRoutes;
