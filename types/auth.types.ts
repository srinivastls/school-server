import { RoleName } from "@prisma/client";

/* ============================================================
   SIGN UP
============================================================ */

export type AuthSignupRequest = {
  name: string;
  email: string;
  password: string;

  role?: RoleName;

  designation?: string;
  phone?: string;
  department?: string;
  employeeId?: string;

  schoolId?: string;
};

/* ============================================================
   SIGN IN
============================================================ */

export type AuthSigninRequest = {
  email: string;
  password: string;

  schoolId?: string;
};

/* ============================================================
   SIGN IN RESPONSE
============================================================ */

export type AuthSigninResponse = {
  id: string;

  accessToken: string;
  accessTokenTTL: number;

  name: string;
  email: string;

  role: RoleName;

  designation: string | null;

  schoolId: string;
};

/* ============================================================
   CREATE PLATFORM ADMIN
============================================================ */

export type CreateSuperAdminRequest = {
  name: string;
  email: string;
  password: string;

  designation?: string;

  /*
   * Kept optional for backward compatibility.
   * Platform admins normally do not belong to a school.
   */
  schoolId?: string;
};

/* ============================================================
   DELETE USER
============================================================ */

export type DeleteUserRequest = {
  email: string;

  schoolId?: string;
};