import { prisma } from "../config";
import { Request,Response,RequestWithBody } from "../types";
import { handleErr } from "../utils";
import bcrypt from "bcrypt";
import {
  SubscriptionPlan,
  SchoolStatus,
  RoleName,
} from "@prisma/client";

import {
  CreateSchoolRequest,
  CreatePrincipalRequest,
} from "../types";
/* ============================================================
   PLATFORM DASHBOARD
============================================================ */

const isValidUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
};

const getDashboard = async (
  req: any,
  res: Response
) => {
  try {
    const [
      totalSchools,
      activeSchools,
      onboardingSchools,
      suspendedSchools,
      archivedSchools,
      expiredSchools,

      totalStudents,
      totalTeachers,
      totalAdmins,
      totalPrincipals,
      totalParents,
    ] = await Promise.all([
      /* ------------------------------------------------------
         SCHOOLS
      ------------------------------------------------------ */

      prisma.school.count(),

      prisma.school.count({
        where: {
          status: "ACTIVE",
        },
      }),

      prisma.school.count({
        where: {
          status: "ONBOARDING",
        },
      }),

      prisma.school.count({
        where: {
          status: "SUSPENDED",
        },
      }),

      prisma.school.count({
        where: {
          status: "EXPIRED",
        },
      }),

      prisma.school.count({
        where: {
          status: "ARCHIVED" as any,
        },
      }),

      /* ------------------------------------------------------
         STUDENTS
      ------------------------------------------------------ */

      prisma.student.count(),

      /* ------------------------------------------------------
         USERS
      ------------------------------------------------------ */

      prisma.user.count({
        where: {
          role: "TEACHER",
        },
      }),

      prisma.user.count({
        where: {
          role: "ADMIN",
        },
      }),

      prisma.user.count({
        where: {
          role: "PRINCIPAL",
        },
      }),

      prisma.user.count({
        where: {
          role: "PARENT",
        },
      }),
    ]);

    return res.status(200).json({
      schools: {
        total: totalSchools,
        active: activeSchools,
        onboarding: onboardingSchools,
        suspended: suspendedSchools,
        archived: archivedSchools,
        expired: expiredSchools,
      },

      users: {
        principals: totalPrincipals,
        admins: totalAdmins,
        teachers: totalTeachers,
        parents: totalParents,
      },

      students: {
        total: totalStudents,
      },
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};


/* ============================================================
   GET ALL SCHOOLS
   ------------------------------------------------------------
   PLATFORM ADMIN ONLY
============================================================ */

const getSchools = async (
  req: any,
  res: Response
) => {
  try {
    const schools = await prisma.school.findMany({
      orderBy: {
        createdAt: "desc",
      },

      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            phone: true,
            designation: true,
            lastLogin: true,
          },
        },

        _count: {
          select: {
            students: true,
            users: true,
          },
        },
      },
    });

    const schoolData = schools.map((school) => {
      const principal = school.users.find(
        (user) => user.role === "PRINCIPAL"
      );

      const admins = school.users.filter(
        (user) => user.role === "ADMIN"
      );

      const teachers = school.users.filter(
        (user) => user.role === "TEACHER"
      );

      const parents = school.users.filter(
        (user) => user.role === "PARENT"
      );

      return {
        id: school.id,
        code: school.code,
        name: school.name,
        address: school.address,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        board: school.board,
        status: school.status,

        subscriptionPlan:
          school.subscriptionPlan,

        subscriptionStartDate:
          school.subscriptionStartDate,

        subscriptionExpiryDate:
          school.subscriptionExpiryDate,

        createdAt: school.createdAt,

        principal: principal
          ? {
              id: principal.id,
              name: principal.name,
              email: principal.email,
              phone: principal.phone,
              designation:
                principal.designation,
              isActive:
                principal.isActive,
              lastLogin:
                principal.lastLogin,
            }
          : null,

        counts: {
          students: school._count.students,
          staff: school._count.users,
          admins: admins.length,
          teachers: teachers.length,
          parents: parents.length,
        },
      };
    });

    return res.status(200).json({
      schools: schoolData,
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};



const getSchoolById = async (
  req: Request,
  res: Response
) => {
  try {
    console.log(
      "GET SCHOOL BY ID REQUEST PARAMS:",
      req.params
    );

    const { id } = req.params;

    // ============================================================
    // VALIDATE ID
    // ============================================================

    if (!id) {
      return res.status(400).json({
        message: "School ID is required.",
      });
    }

    if (!isValidUuid(id)) {
      return res.status(400).json({
        message: "Invalid school ID.",
      });
    }

    // ============================================================
    // GET SCHOOL
    // ============================================================

    const school = await prisma.school.findUnique({
      where: {
        id,
      },

      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            phone: true,
            designation: true,
            lastLogin: true,
          },
        },

        _count: {
          select: {
            students: true,
            users: true,
          },
        },

        academicYears: {
          orderBy: {
            startDate: "desc",
          },

          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isCurrent: true,
          },
        },
      },
    });

    // ============================================================
    // SCHOOL NOT FOUND
    // ============================================================

    if (!school) {
      return res.status(404).json({
        message: "School not found.",
      });
    }

    // ============================================================
    // FIND PRINCIPAL
    // ============================================================

    const principal = school.users.find(
      (user) => user.role === "PRINCIPAL"
    );

    // ============================================================
    // COUNT USERS BY ROLE
    // ============================================================

    const admins = school.users.filter(
      (user) => user.role === "ADMIN"
    );

    const teachers = school.users.filter(
      (user) => user.role === "TEACHER"
    );

    const parents = school.users.filter(
      (user) => user.role === "PARENT"
    );

    // ============================================================
    // FORMAT SCHOOL
    // ============================================================

    const schoolData = {
      id: school.id,
      code: school.code,
      name: school.name,
      address: school.address,
      contactEmail: school.contactEmail,
      contactPhone: school.contactPhone,
      board: school.board,
      status: school.status,

      // ==========================================================
      // SUBSCRIPTION
      // ==========================================================

      subscriptionPlan: school.subscriptionPlan,
      subscriptionStartDate: school.subscriptionStartDate,
      subscriptionExpiryDate: school.subscriptionExpiryDate,

      createdAt: school.createdAt,

      // ==========================================================
      // PRINCIPAL
      // ==========================================================

      principal: principal
        ? {
            id: principal.id,
            name: principal.name,
            email: principal.email,
            phone: principal.phone,
            designation: principal.designation,
            isActive: principal.isActive,
            lastLogin: principal.lastLogin,
          }
        : null,

      // ==========================================================
      // ACADEMIC YEARS
      // ==========================================================

      academicYears: school.academicYears,

      // ==========================================================
      // COUNTS
      // ==========================================================

      counts: {
        students: school._count.students,
        staff: school._count.users,
        admins: admins.length,
        teachers: teachers.length,
        parents: parents.length,
      },
    };

    // ============================================================
    // RESPONSE
    // ============================================================

    return res.status(200).json({
      school: schoolData,
    });
  } catch (error) {
    console.error(
      "GET SCHOOL BY ID ERROR:",
      error
    );

    return handleErr(error, res);
  }
};

const updateSchoolStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const { schoolId } = req.params;
    const { status } = req.body;

    if (!schoolId || !status) {
      return res.status(400).json({
        message:
          "schoolId and status are required",
      });
    }

    if (
      status !== "ACTIVE" &&
      status !== "SUSPENDED"
    ) {
      return res.status(400).json({
        message:
          "Invalid school status",
      });
    }

    const school =
      await prisma.school.findUnique({
        where: {
          id: schoolId,
        },
      });

    if (!school) {
      return res.status(404).json({
        message: "School not found",
      });
    }

    if (
      school.status === status
    ) {
      return res.status(400).json({
        message:
          `School is already ${status}`,
      });
    }

    const updatedSchool =
      await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.school.update({
              where: {
                id: schoolId,
              },
              data: {
                status,
              },
            });

          await tx.schoolOnboardingLog.create({
            data: {
              schoolId,
              platformAdminId:
                req.userId!,
              action:
                status === "ACTIVE"
                  ? "REACTIVATED"
                  : "SUSPENDED",
            } as any,
          });

          return updated;
        }
      );

    return res.status(200).json({
      message:
        status === "ACTIVE"
          ? "School reactivated successfully"
          : "School suspended successfully",

      school: {
        id: updatedSchool.id,
        status: updatedSchool.status,
      },
    });
  } catch (error) {
    return handleErr(error, res);
  }
};


const createSchool = async (
  req: RequestWithBody<CreateSchoolRequest>,
  res: Response
) => {
  try {
    const {
      code,
      name,
      address,
      contactEmail,
      contactPhone,
      logoUrl,
      board,
      subscriptionPlan,
      maxStudents,
      maxStaffAccounts,
      gracePeriodDays,
    } = req.body;

    const platformAdminId = req.userId;

    if (!platformAdminId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!code || !name) {
      return res.status(400).json({
        message:
          "School code and school name are required",
      });
    }

    const normalizedCode =
      code.trim().toUpperCase();

    const normalizedEmail =
      contactEmail?.trim().toLowerCase() || null;

    const existingSchool =
      await prisma.school.findUnique({
        where: {
          code: normalizedCode,
        },
      });

    if (existingSchool) {
      return res.status(409).json({
        message:
          "School with this code already exists",
      });
    }

    const school =
      await prisma.$transaction(
        async (tx) => {
          const createdSchool =
            await tx.school.create({
              data: {
                code: normalizedCode,

                name: name.trim(),

                address:
                  address?.trim() || null,

                contactEmail:
                  normalizedEmail,

                contactPhone:
                  contactPhone?.trim() || null,

                logoUrl:
                  logoUrl?.trim() || null,

                board:
                  board?.trim() || null,

                subscriptionPlan:
                  subscriptionPlan
                    ? (subscriptionPlan as any)
                    : "FREE",

                status: "ONBOARDING",

                gracePeriodDays:
                  gracePeriodDays ?? 7,

                maxStudents:
                  maxStudents ?? 100,

                maxStaffAccounts:
                  maxStaffAccounts ?? 5,

                createdByPlatformAdminId:
                  platformAdminId,
              },
            });

          await tx.schoolOnboardingLog.create({
            data: {
              schoolId:
                createdSchool.id,

              platformAdminId,

              action:
                "SCHOOL_CREATED",

              details: {
                code:
                  createdSchool.code,

                name:
                  createdSchool.name,
              },
            },
          });

          return createdSchool;
        }
      );

    return res.status(201).json({
      message:
        "School created successfully",

      school: {
        id: school.id,
        code: school.code,
        name: school.name,
        status: school.status,
        subscriptionPlan:
          school.subscriptionPlan,
      },
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};

const createPrincipal = async (
  req: RequestWithBody<CreatePrincipalRequest>,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      designation,
      phone,
      department,
      employeeId,
    } = req.body;

    const schoolId =
      req.params.schoolId;

    const platformAdminId =
      req.userId;

    if (!platformAdminId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (
      !schoolId ||
      !name ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        message:
          "schoolId, name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const school =
      await prisma.school.findUnique({
        where: {
          id: schoolId,
        },
      });

    if (!school) {
      return res.status(404).json({
        message: "School not found",
      });
    }

    if (
      school.status === "SUSPENDED" ||
      school.status === "EXPIRED"
    ) {
      return res.status(403).json({
        message:
          "Cannot create principal for a suspended or expired school",
      });
    }

    const existingPrincipal =
      await prisma.user.findFirst({
        where: {
          schoolId,
          role: "PRINCIPAL",
        },
      });

    if (existingPrincipal) {
      return res.status(409).json({
        message:
          "This school already has a principal",
      });
    }

    const existingUser =
      await prisma.user.findUnique({
        where: {
          schoolId_email: {
            schoolId,
            email: normalizedEmail,
          },
        },
      });

    if (existingUser) {
      return res.status(409).json({
        message:
          "User with this email already exists in this school",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    const principal = await prisma.$transaction(
  async (tx) => {
    const createdPrincipal = await tx.user.create({
      data: {
        schoolId,

        name: name.trim(),

        email: normalizedEmail,

        passwordHash,

        role: "PRINCIPAL",

        designation:
          designation?.trim() || "Principal",

        phone:
          phone?.trim() || null,

        department:
          department?.trim() || null,

        employeeId:
          employeeId?.trim() || null,

        mustChangePassword: true,
      },
    });

    // Activate the school after principal creation
    const updatedSchool = await tx.school.update({
      where: {
        id: schoolId,
      },
      data: {
        status: "ACTIVE",
      },
    });

    await tx.schoolOnboardingLog.create({
      data: {
        schoolId,

        platformAdminId,

        action: "CREDENTIALS_GENERATED",

        details: {
          principalId: createdPrincipal.id,
          email: createdPrincipal.email,
        },
      },
    });

    return {
      principal: createdPrincipal,
      school: updatedSchool,
    };
  }
);

    return res.status(201).json({
  message: "Principal created successfully",

  principal: {
    id: principal.principal.id,
    name: principal.principal.name,
    email: principal.principal.email,
    designation: principal.principal.designation,
    schoolId: principal.principal.schoolId,
    mustChangePassword:
      principal.principal.mustChangePassword,
  },

  school: {
    id: principal.school.id,
    code: principal.school.code,
    name: principal.school.name,
    status: principal.school.status,
  },
});
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};


const deletePrincipal = async (
  req: Request,
  res: Response
) => {
  try {
    const { schoolId } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        message: "School ID is required",
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found",
      });
    }

    const principal = await prisma.user.findFirst({
      where: {
        schoolId,
        role: "PRINCIPAL",
      },
    });

    if (!principal) {
      return res.status(404).json({
        message: "Principal not found for this school",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id: principal.id },
      });

      // await tx.schoolOnboardingLog.create({
      //   data: {
      //     schoolId,
      //     platformAdminId: req.userId!,
      //     action: "PRINCIPAL_DELETED",
      //     details: {
      //       principalId: principal.id,
      //       email: principal.email,
      //     },
      //   } as any,
      // });
    });

    return res.status(200).json({
      message: "Principal deleted successfully",
    });
  } catch (error) {
    return handleErr(
      error,
      res
    );
  }
};


const updatePrincipal = async (
  req: Request,
  res: Response
) => {
  try {

    const { schoolId } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        message: "School ID is required",
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({
        message: "School not found",
      });
    }

    const princi = await prisma.user.findFirst({
      where: {
        schoolId,
        role: "PRINCIPAL",
      },
    });

    if (!princi) {
      return res.status(404).json({
        message: "Principal not found for this school",
      });
    }
    const userId = princi.id;

    if (!userId) {
      return res.status(400).json({
        message: "Authenticated user is missing",
      });
    }

    const { name, email, phone, designation, department, employeeId } = req.body;

    const principal = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        designation: designation?.trim() || null,
        department: department?.trim() || null,
        employeeId: employeeId?.trim() || null,
      },
    });

    return res.status(200).json({
      message: "Principal updated successfully",
      principal: {
        id: principal.id,
        name: principal.name,
        email: principal.email,
        phone: principal.phone,
        designation: principal.designation,
        department: principal.department,
        employeeId: principal.employeeId,
        isActive: principal.isActive,
        lastLogin: principal.lastLogin,
      },
    });
  } catch (error) {
    return handleErr(error, res);
  }
};


export const platformController = {
  getDashboard,
    getSchools,
    updateSchoolStatus,
    createSchool,
    createPrincipal,
    getSchoolById,
    deletePrincipal,
    updatePrincipal,
};