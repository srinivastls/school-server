import {
  RoleName,
  PlatformAdminRole,
} from "@prisma/client";

/* ============================================================
   SCHOOL USER SIGN IN
============================================================ */

export type AuthSigninRequest = {
  schoolCode: string;
  email: string;
  password: string;
};

export type AuthSigninResponse = {
  id: string;

  accessToken: string;

  accessTokenTTL: number;

  name: string;

  email: string;

  role: RoleName;

  designation: string | null;

  schoolId: string;

  schoolCode: string;

  schoolName: string;

  mustChangePassword: boolean;
};

/* ============================================================
   PLATFORM ADMIN SIGN IN
============================================================ */

export type PlatformAdminSigninRequest = {
  email: string;

  password: string;
};

export type PlatformAdminSigninResponse = {
  id: string;

  accessToken: string;

  accessTokenTTL: number;

  name: string;

  email: string;

  role: PlatformAdminRole;

  type: "PLATFORM_ADMIN";
};

/* ============================================================
   CREATE PRINCIPAL
   ------------------------------------------------------------
   Only PLATFORM_ADMIN can create a principal.
============================================================ */

// export type CreatePrincipalRequest = {
//   schoolId: string;

//   name: string;

//   email: string;

//   password: string;

//   designation?: string;

//   phone?: string;

//   department?: string;

//   employeeId?: string;
// };

/* ============================================================
   CREATE SCHOOL ADMIN
   ------------------------------------------------------------
   Only PRINCIPAL can create an ADMIN.
   
   schoolId is intentionally NOT accepted.
   It comes from req.user.schoolId.
============================================================ */

export type CreateAdminRequest = {
  name: string;

  email: string;

  password: string;

  designation?: string;

  phone?: string;

  department?: string;

  employeeId?: string;
};

/* ============================================================
   CREATE TEACHER
   ------------------------------------------------------------
   PRINCIPAL / ADMIN can create a TEACHER.
   
   schoolId comes from authenticated user.
============================================================ */

export type CreateTeacherRequest = {
  name: string;

  email: string;

  password: string;

  designation?: string;

  phone?: string;

  department?: string;

  employeeId?: string;
};

/* ============================================================
   CREATE PARENT
   ------------------------------------------------------------
   PRINCIPAL / ADMIN can create a PARENT account.
   
   schoolId comes from authenticated user.
============================================================ */

export type CreateParentRequest = {
  name: string;

  email: string;

  password: string;

  phone?: string;
};

/* ============================================================
   DELETE USER
   ------------------------------------------------------------
   Principal can delete school users.
   
   schoolId is intentionally NOT accepted.
   It comes from req.user.schoolId.
============================================================ */

export type DeleteUserRequest = {
  email: string;
};
