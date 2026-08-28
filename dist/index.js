"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const routes_1 = require("./routes");
dotenv_1.default.config();
const app = (0, express_1.default)();
/* ============================================================
   MIDDLEWARE
============================================================ */
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({
    extended: true,
}));
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept");
    next();
});
/* ============================================================
   HEALTH CHECK
============================================================ */
app.get("/", (req, res) => {
    res.json({
        message: `Oxford EMUP - ${process.env.DEPLOY_ENV ?? "dev"}`,
    });
});
/* ============================================================
   ROUTES
============================================================ */
(0, routes_1.useAuthRoutes)(app);
(0, routes_1.useUserRoutes)(app);
(0, routes_1.useClassRoutes)(app);
(0, routes_1.useCouponRoutes)(app);
(0, routes_1.useStudentRoutes)(app);
(0, routes_1.useTransactionRoutes)(app);
(0, routes_1.useReportRoutes)(app);
(0, routes_1.usePlatformRoutes)(app);
(0, routes_1.usePrincipalRoutes)(app);
(0, routes_1.useParentRoutes)(app);
(0, routes_1.useAcademicYearRoutes)(app);
(0, routes_1.useAttendanceRoutes)(app);
(0, routes_1.useLeaveRoutes)(app);
(0, routes_1.useStudentPromotionRoutes)(app);
(0, routes_1.useClassTeacherRoutes)(app);
//useTeacherAttendanceRoutes(app);
/* ============================================================
   SERVER
============================================================ */
const port = Number(process.env.PORT || 3000);
/* ============================================================
   BOOTSTRAP
============================================================ */
const bootstrap = async () => {
    try {
        /* --------------------------------------------------------
           CONNECT DATABASE
        -------------------------------------------------------- */
        await config_1.prisma.$connect();
        console.log("connected to postgres");
        /* --------------------------------------------------------
           START SERVER
        -------------------------------------------------------- */
        app.listen(port, "0.0.0.0", () => {
            console.log(`listening on port ${port}`);
        });
    }
    catch (error) {
        console.error("startup failed:", error);
        await config_1.prisma.$disconnect()
            .catch(() => { });
        process.exit(1);
    }
};
void bootstrap();
