import { prisma } from "../config";
import {
  Request,
  Response,
} from "../types";
import { handleErr } from "../utils";

/* ============================================================
   GET PARENT DASHBOARD
============================================================ */

const getParentDashboard = async (
  req: Request,
  res: Response
) => {
  try {

    /* --------------------------------------------------------
       LOGGED-IN USER
    -------------------------------------------------------- */

    const parentUserId =
      req.userId;

    if (!parentUserId) {
      return res.status(401).json({
        message:
          "Authentication required",
      });
    }


    /* --------------------------------------------------------
       FIND PARENT
    -------------------------------------------------------- */

    const parent =
      await prisma.user.findUnique({
        where: {
          id: parentUserId,
        },

        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,

          parentLinks: {
            include: {
              student: {
                include: {
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
      });


    /* --------------------------------------------------------
       PARENT NOT FOUND
    -------------------------------------------------------- */

    if (!parent) {
      return res.status(404).json({
        message:
          "Parent account not found",
      });
    }


    /* --------------------------------------------------------
       ROLE CHECK
    -------------------------------------------------------- */

    if (parent.role !== "PARENT") {
      return res.status(403).json({
        message:
          "Parent access required",
      });
    }


    /* --------------------------------------------------------
       ACTIVE CHECK
    -------------------------------------------------------- */

    if (!parent.isActive) {
      return res.status(403).json({
        message:
          "Parent account is inactive",
      });
    }


    /* --------------------------------------------------------
       RESPONSE
    -------------------------------------------------------- */

    const children =
      parent.parentLinks.map(
        (link) => ({
          id:
            link.student.id,

          admissionNo:
            link.student.admissionNo,

          name:
            link.student.name,

          phone:
            link.student.phone,

          status:
            link.student.status,

          relationship:
            link.relationship,

          isPrimary:
            link.isPrimary,

          class: {
            id:
              link.student.class.id,

            classNumber:
              link.student.class.classNumber,

            displayName:
              link.student.class.displayName,
          },

          section: {
            id:
              link.student.section.id,

            sectionName:
              link.student.section.sectionName,
          },
        })
      );


    return res.status(200).json({

      parent: {
        id:
          parent.id,

        name:
          parent.name,

        email:
          parent.email,

        phone:
          parent.phone,
      },

      children,

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

export const parentController = {
  getParentDashboard,
};