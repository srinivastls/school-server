import express from "express";
import { Query, Send } from "express-serve-static-core";
import { RoleName } from "@prisma/client";

/* ============================================================
   AUTHENTICATED USER
============================================================ */

export interface AuthenticatedUser {
  id: string;
  schoolId?: string;
  role?: RoleName;
}

/* ============================================================
   REQUEST TYPES
============================================================ */

export interface Request<
  Q extends Query = any,
  B = any
> extends express.Request {
  body: B;
  query: Q;

  /*
   * Backward compatibility:
   * Existing controllers/middlewares still use req.userId.
   */
  userId?: string;

  /*
   * New authentication context.
   */
  user?: AuthenticatedUser;
}

export interface RequestWithBody<B>
  extends Request {
  body: B;
}

export interface RequestWithQuery<Q extends Query>
  extends Request {
  query: Q;
}

/* ============================================================
   RESPONSE TYPES
============================================================ */

export interface Response<B = any>
  extends express.Response {
  json: Send<
    B | { message: string | unknown },
    this
  >;
}