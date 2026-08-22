import { Roles, UserType } from "./entities.types";

export type UserItem = Omit<UserType, "roles"> & { roles: Roles[] };
export type GetAllUsersResponse = { users: UserItem[] };
