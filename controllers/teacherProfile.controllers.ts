import { Request, Response } from "../types";
import { prisma } from "../config";
import { handleErr } from "../utils";

/**
 * GET /api/v1/teacher/profile
 */
const getTeacherProfile = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        message: "School information is missing",
      });
    }

    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherUserId,
        schoolId,
        role: "TEACHER",
      },
      select: {
        id: true,
        schoolId: true,
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

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher profile not found",
      });
    }

    return res.status(200).json({
      teacher,
    });
  } catch (error) {
    return handleErr(error, res);
  }
};

/**
 * PATCH /api/v1/teacher/profile
 *
 * Editable:
 * - name
 * - phone
 * - profilePhotoUrl
 *
 * Controlled by Admin:
 * - email
 * - designation
 * - department
 * - employeeId
 * - role
 * - isActive
 */
const updateTeacherProfile = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherUserId = req.user?.id;
    const schoolId = req.user?.schoolId;

    if (!teacherUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!schoolId) {
      return res.status(400).json({
        message: "School information is missing",
      });
    }

    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherUserId,
        schoolId,
        role: "TEACHER",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profilePhotoUrl: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({
        message: "Teacher profile not found",
      });
    }

    const {
      name,
      phone,
      profilePhotoUrl,
    } = req.body || {};

    const data: {
      name?: string;
      phone?: string | null;
      profilePhotoUrl?: string | null;
    } = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          message: "Name cannot be empty",
        });
      }

      if (name.trim().length > 150) {
        return res.status(400).json({
          message:
            "Name cannot exceed 150 characters",
        });
      }

      data.name = name.trim();
    }

    if (phone !== undefined) {
      if (
        phone !== null &&
        typeof phone !== "string"
      ) {
        return res.status(400).json({
          message: "Invalid phone number",
        });
      }

      if (
        typeof phone === "string" &&
        phone.length > 20
      ) {
        return res.status(400).json({
          message:
            "Phone number cannot exceed 20 characters",
        });
      }

      data.phone =
        phone === null
          ? null
          : phone?.trim() || null;
    }

    if (profilePhotoUrl !== undefined) {
      if (
        profilePhotoUrl !== null &&
        typeof profilePhotoUrl !== "string"
      ) {
        return res.status(400).json({
          message:
            "Invalid profile photo URL",
        });
      }

      data.profilePhotoUrl =
        profilePhotoUrl === null
          ? null
          : profilePhotoUrl.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: "No profile changes provided",
      });
    }

    const updatedTeacher =
      await prisma.user.update({
        where: {
          id: teacher.id,
        },
        data,
        select: {
          id: true,
          schoolId: true,
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

    return res.status(200).json({
      message: "Profile updated successfully",
      teacher: updatedTeacher,
    });
  } catch (error) {
    return handleErr(error, res);
  }
};

export {
  getTeacherProfile,
  updateTeacherProfile,
};