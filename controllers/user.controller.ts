import {
  Response,
  Request,
  GetAllUsersResponse,
  UserItem,
  Roles,
} from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getAllUsers = async (
  req: Request,
  res: Response<GetAllUsersResponse>
) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        roles: true,
      },
    });

    const usersList: UserItem[] = users.map((user) => ({
      name: user.name,
      designation: user.designation,
      adminId: user.adminId,
      email: user.email,
      roles: user.roles.map((role) => role.name as Roles),
    }));

    return res.status(200).json({ users: usersList });
  } catch (err) {
    return handleErr(err, res);
  }
};

export const userController = { getAllUsers };
