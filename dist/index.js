"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const types_1 = require("./types");
const routes_1 = require("./routes");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept");
    next();
});
const seedRoles = async () => {
    await config_1.prisma.role.upsert({
        where: { name: types_1.Roles.admin },
        create: { name: types_1.Roles.admin },
        update: {},
    });
    await config_1.prisma.role.upsert({
        where: { name: types_1.Roles.superadmin },
        create: { name: types_1.Roles.superadmin },
        update: {},
    });
    await config_1.prisma.role.upsert({
        where: { name: types_1.Roles.owner },
        create: { name: types_1.Roles.owner },
        update: {},
    });
};
// Railway automatically provides PORT
const port = Number(process.env.PORT ||
    (process.env.DEPLOY_ENV === "prod"
        ? process.env.PORT_PROD
        : process.env.PORT_UAT) ||
    3000);
app.get("/", (req, res) => {
    res.json({
        message: `Oxford EMUP - ${process.env.DEPLOY_ENV ?? "dev"}`,
    });
});
(0, routes_1.useAuthRoutes)(app);
(0, routes_1.useUserRoutes)(app);
(0, routes_1.useClassRoutes)(app);
(0, routes_1.useCouponRoutes)(app);
(0, routes_1.useStudentRoutes)(app);
(0, routes_1.useTransactionRoutes)(app);
(0, routes_1.useReportRoutes)(app);
const bootstrap = async () => {
    try {
        await config_1.prisma.$connect();
        await seedRoles();
        console.log("connected to postgres");
        app.listen(port, "0.0.0.0", () => {
            console.log(`listening on port ${port}`);
        });
    }
    catch (error) {
        console.error("error connecting to postgres:", error);
        process.exit(1);
    }
};
void bootstrap();
