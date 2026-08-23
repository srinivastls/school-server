import {
  Response,
  Request,
  GetAllUsersResponse,
  UserItem,
} from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

const getAllUsers = async (
  req: Request,
  res: Response<GetAllUsersResponse>
) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        designation: true,
        role: true,
        schoolId: true,
      },
    });

    const usersList: UserItem[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      designation: user.designation,
      role: user.role,
      schoolId: user.schoolId,
    }));

    return res.status(200).json({
      users: usersList,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

export const userController = {
  getAllUsers,
};