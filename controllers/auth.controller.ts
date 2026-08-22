import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { prisma, authConfig } from "../config";

import {
  AuthSigninRequest,
  AuthSigninResponse,
  AuthSignupRequest,
  CreateSuperAdminRequest,
  DeleteUserRequest,
  RequestWithBody,
  Response,
  Roles,
} from "../types";

import { handleErr } from "../utils";

const signup = async (
  req: RequestWithBody<AuthSignupRequest>,
  res: Response
) => {
  try {
    const { name, email, password, roles, designation, adminId } = req.body;

    if (!name || !email || !password || !designation || !adminId) {
      return res
        .status(400)
        .json({ message: "Some fields are missing in request body" });
    }

    // Find requested roles, or use admin by default
    let roleRecords;

    if (roles && roles.length > 0) {
      roleRecords = await prisma.role.findMany({
        where: {
          name: {
            in: roles,
          },
        },
      });
    } else {
      roleRecords = await prisma.role.findMany({
        where: {
          name: Roles.admin,
        },
      });
    }

    if (roleRecords.length === 0) {
      return res.status(400).json({
        message: "Role not found. Please create roles first.",
      });
    }

    await prisma.user.create({
      data: {
        name,
        email,
        designation,
        adminId,
        password: bcrypt.hashSync(password, 8),

        roles: {
          connect: roleRecords.map((role) => ({
            id: role.id,
          })),
        },
      },
    });

    return res.json({
      message: "User created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const signin = async (
  req: RequestWithBody<AuthSigninRequest>,
  res: Response<AuthSigninResponse>
) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        roles: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found!",
      });
    }

    const isPasswordValid = bcrypt.compareSync(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Password incorrect",
      });
    }

    const isSuperAdmin = user.roles.some(
      (role) => role.name === Roles.superadmin
    );

    const token = jwt.sign(
      { id: user.id },
      authConfig.secret,
      {
        expiresIn: 86400,
      }
    );

    const ttl = isSuperAdmin ? 86400 : 0;

    return res.status(200).json({
      id: user.id,
      accessToken: token,
      accessTokenTTL: ttl,
      name: user.name,
      email: user.email,
      roles: user.roles.map((role) => role.name as Roles),
      designation: user.designation,
      adminId: user.adminId,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const deleteUser = async (
  req: RequestWithBody<DeleteUserRequest>,
  res: Response
) => {
  try {
    if (!req.body.email) {
      return res.status(400).json({
        message: "Email field missing in request body",
      });
    }

    await prisma.user.delete({
      where: {
        email: req.body.email,
      },
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const createSuperAdmin = async (
  req: RequestWithBody<CreateSuperAdminRequest>,
  res: Response
) => {
  try {
    const { name, email, password, designation, adminId } = req.body;

    if (!name || !email || !password || !designation || !adminId) {
      return res
        .status(400)
        .json({ message: "Some fields are missing in request body" });
    }

    const superAdminRole = await prisma.role.findUnique({
      where: {
        name: Roles.superadmin,
      },
    });

    if (!superAdminRole) {
      return res.status(400).json({
        message:
          "Superadmin role not found. Please create it first.",
      });
    }

    await prisma.user.create({
      data: {
        name,
        email,
        password: bcrypt.hashSync(password, 8),
        designation,
        adminId,

        roles: {
          connect: {
            id: superAdminRole.id,
          },
        },
      },
    });

    return res.json({
      message: "User created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

export const authController = {
  signin,
  signup,
  delete: deleteUser,
  createSuperAdmin,
};