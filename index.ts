import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import { prisma } from "./config";

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

/* ============================================================
   MIDDLEWARE
============================================================ */

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  (req, res, next) => {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );

    next();
  }
);

/* ============================================================
   HEALTH CHECK
============================================================ */

app.get(
  "/",
  (req, res) => {
    res.json({
      message: `Oxford EMUP - ${
        process.env.DEPLOY_ENV ?? "dev"
      }`,
    });
  }
);

/* ============================================================
   ROUTES
============================================================ */

useAuthRoutes(app);

useUserRoutes(app);

useClassRoutes(app);

useCouponRoutes(app);

useStudentRoutes(app);

useTransactionRoutes(app);

useReportRoutes(app);

/* ============================================================
   SERVER
============================================================ */

const port =
  Number(
    process.env.PORT || 3000
  );

/* ============================================================
   BOOTSTRAP
============================================================ */

const bootstrap = async () => {
  try {
    /* --------------------------------------------------------
       CONNECT DATABASE
    -------------------------------------------------------- */

    await prisma.$connect();

    console.log(
      "connected to postgres"
    );

    /* --------------------------------------------------------
       START SERVER
    -------------------------------------------------------- */

    app.listen(
      port,
      "0.0.0.0",
      () => {
        console.log(
          `listening on port ${port}`
        );
      }
    );
  } catch (error) {
    console.error(
      "startup failed:",
      error
    );

    await prisma.$disconnect()
      .catch(() => {});

    process.exit(1);
  }
};

void bootstrap();