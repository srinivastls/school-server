import { Roles, UserType } from "./entities.types";

export type AuthSignupRequest = Omit<UserType, "roles"> & {
  password: string;
  roles: Roles[];
};

export type AuthSigninRequest = { email: string; password: string };
export type AuthSigninResponse = Omit<UserType, "roles"> & {
  id: string;
  accessToken: string;
  accessTokenTTL: number;
  roles: Roles[];
};

export type CreateSuperAdminRequest = Omit<UserType, "roles"> & {
  password: string;
};

export type DeleteUserRequest = { email: string };
