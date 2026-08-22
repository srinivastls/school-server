import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { prisma } from "./config";
import { Roles } from "./types";
import {
  useAuthRoutes,
  useUserRoutes,
  useClassRoutes,
  useCouponRoutes,
  useStudentRoutes,
  useTransactionRoutes,
  useReportRoutes,
} from "./routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "x-access-token, Origin, Content-Type, Accept"
  );
  next();
});

const seedRoles = async () => {
  await prisma.role.upsert({
    where: { name: Roles.admin },
    create: { name: Roles.admin },
    update: {},
  });

  await prisma.role.upsert({
    where: { name: Roles.superadmin },
    create: { name: Roles.superadmin },
    update: {},
  });

  await prisma.role.upsert({
    where: { name: Roles.owner },
    create: { name: Roles.owner },
    update: {},
  });
};

// Railway automatically provides PORT
const port = Number(
  process.env.PORT ||
    (process.env.DEPLOY_ENV === "prod"
      ? process.env.PORT_PROD
      : process.env.PORT_UAT) ||
    3000
);

app.get("/", (req, res) => {
  res.json({
    message: `Oxford EMUP - ${process.env.DEPLOY_ENV ?? "dev"}`,
  });
});

useAuthRoutes(app);
useUserRoutes(app);
useClassRoutes(app);
useCouponRoutes(app);
useStudentRoutes(app);
useTransactionRoutes(app);
useReportRoutes(app);

const bootstrap = async () => {
  try {
    await prisma.$connect();
    await seedRoles();

    console.log("connected to postgres");

    app.listen(port, "0.0.0.0", () => {
      console.log(`listening on port ${port}`);
    });
  } catch (error) {
    console.error("error connecting to postgres:", error);
    process.exit(1);
  }
};

void bootstrap();