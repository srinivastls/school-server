import { RoleName } from "@prisma/client";

export type UserItem = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  role: RoleName;
  schoolId: string;
};

export type GetAllUsersResponse = {
  users: UserItem[];
};