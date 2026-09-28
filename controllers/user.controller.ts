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


const getProfile = async (
  req: Request,
  res: Response
) => {
  try {

    const userId = req.userId;

    if (!userId) {

      return res.status(400).json({
        message:
          "Authenticated user is missing",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          designation: true,
          department: true,
          employeeId: true,
          profilePhotoUrl: true,
          isActive: true,
          mustChangePassword: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if (!user) {

      return res.status(404).json({
        message:
          "User not found",
      });
    }

    return res.status(200).json({
      profile: user,
    });

  } catch (error) {

    return handleErr(
      error,
      res
    );

  }

};



export const userController = {
  getAllUsers,
  getProfile,
};