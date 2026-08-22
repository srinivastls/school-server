import express from "express";
import { Query, Send } from "express-serve-static-core";

//Request types
export interface Request<Q extends Query = any, B = any>
  extends express.Request {
  body: B;
  query: Q;
}
export interface RequestWithBody<B> extends Request {
  body: B;
}
export interface RequestWithQuery<Q extends Query> extends Request {
  query: Q;
}

//Response types
export interface Response<B = never> extends express.Response {
  json: Send<B | { message: string | unknown }, this>;
}
