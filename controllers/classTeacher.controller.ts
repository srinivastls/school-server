import { prisma } from "../config";
import { Request, Response } from "../types";
import { handleErr } from "../utils";

/* ============================================================
   TYPES
============================================================ */

type AssignClassTeacherBody = {
  sectionId: string;
  teacherUserId: string | null;
};

/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (
  req: any
): string | undefined =>
  req.user?.schoolId ??
  req.body?.schoolId ??
  req.query?.schoolId;

/* ============================================================
   ASSIGN / CHANGE CLASS TEACHER
============================================================ */

const assignClassTeacher = async (
  req: Request<any, AssignClassTeacherBody>,
  res: Response
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const { sectionId, teacherUserId } = req.body;

    if (!sectionId) {
      return res.status(400).json({
        message: "sectionId is required",
      });
    }

    /* --------------------------------------------------------
       VERIFY SECTION
    -------------------------------------------------------- */

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        schoolId,
      },
      include: {
        class: {
          include: {
            academicYear: true,
          },
        },
      },
    });

    if (!section) {
      return res.status(404).json({
        message: "Section not found",
      });
    }

    /* --------------------------------------------------------
       REMOVE CLASS TEACHER
    -------------------------------------------------------- */

    if (!teacherUserId) {
      const updatedSection =
        await prisma.section.update({
          where: {
            id: section.id,
          },
          data: {
            classTeacherId: null,
          },
          include: {
            classTeacher: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
            class: true,
          },
        });

      return res.status(200).json({
        message: "Class teacher removed successfully",
        section: updatedSection,
      });
    }

    /* --------------------------------------------------------
       VERIFY TEACHER / PRINCIPAL
    -------------------------------------------------------- */

    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherUserId,
        schoolId,
        isActive: true,
        role: {
          in: ["TEACHER", "PRINCIPAL"],
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
        designation: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({
        message:
          "Teacher/Principal not found",
      });
    }

    /* --------------------------------------------------------
       PREVENT MULTIPLE CLASS TEACHER ASSIGNMENTS
       IN SAME ACADEMIC YEAR
    -------------------------------------------------------- */

    const existingAssignment =
      await prisma.section.findFirst({
        where: {
          schoolId,
          classTeacherId: teacher.id,
          id: {
            not: section.id,
          },
          class: {
            academicYearId:
              section.class.academicYearId,
          },
        },
        include: {
          class: true,
        },
      });

    if (existingAssignment) {
      return res.status(409).json({
        message: `${teacher.name} is already class teacher for Class ${existingAssignment.class.classNumber} - Section ${existingAssignment.sectionName}`,
      });
    }

    /* --------------------------------------------------------
       ASSIGN
    -------------------------------------------------------- */

    const updatedSection =
      await prisma.section.update({
        where: {
          id: section.id,
        },
        data: {
          classTeacherId: teacher.id,
        },
        include: {
          classTeacher: {
            select: {
              id: true,
              name: true,
              role: true,
              designation: true,
            },
          },
          class: true,
        },
      });

    return res.status(200).json({
      message: "Class teacher assigned successfully",
      section: updatedSection,
    });
  } catch (error) {
    return handleErr(error, res);
  }
};

/* ============================================================
   GET CLASS TEACHER ASSIGNMENTS
============================================================ */

const getClassTeacherAssignments =
  async (req: Request, res: Response) => {
    try {
      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }

      const academicYearId =
        String(
          req.query?.academicYearId ??
            ""
        ).trim();

      if (!academicYearId) {
        return res.status(400).json({
          message:
            "academicYearId is required",
        });
      }

      const sections =
        await prisma.section.findMany({
          where: {
            schoolId,
            class: {
              academicYearId,
            },
          },
          include: {
            class: true,
            classTeacher: {
              select: {
                id: true,
                name: true,
                role: true,
                designation: true,
                employeeId: true,
              },
            },
          },
          orderBy: [
            {
              class: {
                classNumber:
                  "asc",
              },
            },
            {
              sectionName:
                "asc",
            },
          ],
        });

      return res.status(200).json({
        totalSections:
          sections.length,
        assigned:
          sections.filter(
            section =>
              section.classTeacher
          ).length,
        unassigned:
          sections.filter(
            section =>
              !section.classTeacher
          ).length,
        sections,
      });
    } catch (error) {
      return handleErr(error, res);
    }
  };

/* ============================================================
   GET AVAILABLE CLASS TEACHERS
============================================================ */

const getAvailableClassTeachers =
  async (req: Request, res: Response) => {
    try {
      const schoolId =
        getSchoolId(req);

      if (!schoolId) {
        return res.status(400).json({
          message:
            "schoolId is required",
        });
      }

      const teachers =
        await prisma.user.findMany({
          where: {
            schoolId,
            isActive: true,
            role: {
              in: [
                "TEACHER",
                "PRINCIPAL",
              ],
            },
          },
          select: {
            id: true,
            name: true,
            role: true,
            designation: true,
            employeeId: true,
            classTeacherSections: {
              include: {
                class: true,
              },
            },
          },
          orderBy: {
            name: "asc",
          },
        });

      const result =
        teachers.map(teacher => ({
          id: teacher.id,
          name: teacher.name,
          role: teacher.role,
          designation:
            teacher.designation,
          employeeId:
            teacher.employeeId,
          assignedSection:
            teacher.classTeacherSections[0]
              ? {
                  sectionId:
                    teacher
                      .classTeacherSections[0]
                      .id,
                  sectionName:
                    teacher
                      .classTeacherSections[0]
                      .sectionName,
                  classNumber:
                    teacher
                      .classTeacherSections[0]
                      .class
                      .classNumber,
                }
              : null,
        }));

      return res.status(200).json({
        totalTeachers:
          result.length,
        teachers: result,
      });
    } catch (error) {
      return handleErr(error, res);
    }
  };

/* ============================================================
   EXPORT
============================================================ */

export const classTeacherControllers = {
  assignClassTeacher,
  getClassTeacherAssignments,
  getAvailableClassTeachers,
};