import { RoleName } from "@prisma/client";

import { prisma } from "../config";

import {
  Request,
  Response,
} from "../types";

import { handleErr } from "../utils";


/* ============================================================
   AUTHENTICATED SCHOOL
============================================================ */

const getAuthenticatedSchoolId = (
  req: any
): string | undefined => {

  return req.user?.schoolId;
};


/* ============================================================
   GET TEACHERS
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */

const getTeachers = async (
  req: Request,
  res: Response
) => {

  try {

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (!schoolId) {

      return res.status(400).json({
        message:
          "Authenticated school is missing",
      });

    }


    const teachers =
      await prisma.user.findMany({

        where: {

          schoolId,

          role:
            RoleName.TEACHER,

        },

        select: {

          id: true,

          name: true,

          email: true,

          phone: true,

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

        orderBy: {

          name: "asc",

        },

      });


    return res.status(200).json({

      teachers,

    });

  } catch (error) {

    return handleErr(
      error,
      res
    );

  }

};


/* ============================================================
   GET PARENTS
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */

const getParents = async (
  req: Request,
  res: Response
) => {

  try {

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (!schoolId) {

      return res.status(400).json({
        message:
          "Authenticated school is missing",
      });

    }


    const parents =
      await prisma.user.findMany({

        where: {

          schoolId,

          role:
            RoleName.PARENT,

        },

        select: {

          id: true,

          name: true,

          email: true,

          phone: true,

          isActive: true,

          mustChangePassword: true,

          lastLogin: true,

          createdAt: true,

          updatedAt: true,

          parentLinks: {

            select: {

              relationship: true,

              isPrimary: true,

              student: {

                select: {

                  id: true,

                  admissionNo: true,

                  name: true,

                  status: true,

                  class: {

                    select: {

                      id: true,

                      classNumber: true,

                      displayName: true,

                    },

                  },

                  section: {

                    select: {

                      id: true,

                      sectionName: true,

                    },

                  },

                },

              },

            },

          },

        },

        orderBy: {

          name: "asc",

        },

      });


    const formattedParents =
      parents.map(
        (parent) => ({

          id:
            parent.id,

          name:
            parent.name,

          email:
            parent.email,

          phone:
            parent.phone,

          isActive:
            parent.isActive,

          mustChangePassword:
            parent.mustChangePassword,

          lastLogin:
            parent.lastLogin,

          createdAt:
            parent.createdAt,

          updatedAt:
            parent.updatedAt,

          children:
            parent.parentLinks.map(
              (link) => ({

                id:
                  link.student.id,

                admissionNo:
                  link.student.admissionNo,

                name:
                  link.student.name,

                status:
                  link.student.status,

                relationship:
                  link.relationship,

                isPrimary:
                  link.isPrimary,

                class:
                  link.student.class,

                section:
                  link.student.section,

              })
            ),

        })
      );


    return res.status(200).json({

      parents:
        formattedParents,

    });

  } catch (error) {

    return handleErr(
      error,
      res
    );

  }

};


/* ============================================================
   GET ADMINS
   ------------------------------------------------------------
   PRINCIPAL / ADMIN
============================================================ */

const getAdmins = async (
  req: Request,
  res: Response
) => {

  try {

    const schoolId =
      getAuthenticatedSchoolId(req);

    if (!schoolId) {

      return res.status(400).json({

        message:
          "Authenticated school is missing",

      });

    }


    /* ========================================================
       FIND SCHOOL ADMIN USERS
    ======================================================== */

    const admins =
      await prisma.user.findMany({

        where: {

          schoolId,

          role:
            RoleName.ADMIN,

        },

        select: {

          id: true,

          name: true,

          email: true,

          phone: true,

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

        orderBy: {

          name: "asc",

        },

      });


    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({

      admins,

    });

  } catch (error) {

    return handleErr(
      error,
      res
    );

  }

};


/* ============================================================
   EXPORT
============================================================ */

export const principalController = {

  getTeachers,

  getParents,

  getAdmins,

};