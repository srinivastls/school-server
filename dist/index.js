"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const seedRoles = () => __awaiter(void 0, void 0, void 0, function* () {
    yield config_1.prisma.role.upsert({
        where: { name: types_1.Roles.admin },
        create: { name: types_1.Roles.admin },
        update: {},
    });
    yield config_1.prisma.role.upsert({
        where: { name: types_1.Roles.superadmin },
        create: { name: types_1.Roles.superadmin },
        update: {},
    });
    yield config_1.prisma.role.upsert({
        where: { name: types_1.Roles.owner },
        create: { name: types_1.Roles.owner },
        update: {},
    });
});
const port = process.env.DEPLOY_ENV === "prod"
    ? process.env.PORT_PROD
    : process.env.PORT_UAT;
app.listen(port, () => {
    console.log("listening on port " + port);
});
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    res.json({ message: `Oxford EMUP - ${(_a = process.env.DEPLOY_ENV) !== null && _a !== void 0 ? _a : "dev"}` });
}));
(0, routes_1.useAuthRoutes)(app);
(0, routes_1.useUserRoutes)(app);
(0, routes_1.useClassRoutes)(app);
(0, routes_1.useCouponRoutes)(app);
(0, routes_1.useStudentRoutes)(app);
(0, routes_1.useTransactionRoutes)(app);
(0, routes_1.useReportRoutes)(app);
const bootstrap = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield config_1.prisma.$connect();
        yield seedRoles();
        console.log("connected to postgres");
    }
    catch (error) {
        console.log("error connecting to postgres:", error);
        process.exit(1);
    }
});
void bootstrap();
