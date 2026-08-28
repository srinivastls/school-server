import { prisma } from "../config";

import {
  Request,
  Response,
} from "../types";

import { handleErr } from "../utils";


/* ============================================================
   HELPERS
============================================================ */

const getSchoolId = (
  req: any
): string | undefined => {
  return (
    req.user?.schoolId ??
    req.body?.schoolId ??
    req.query?.schoolId
  );
};


/* ============================================================
   ASSIGN TEACHER TO SUBJECT + SECTION
============================================================ */

type AssignTeacherSubjectBody = {
  teacherUserId: string;
  subjectId: string;
  sectionId: string;
  academicYearId: string;
};


const assignTeacherSubject = async (
  req: Request<any, AssignTeacherSubjectBody>,
  res: Response
) => {

  try {

    const schoolId =
      getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message:
          "schoolId is required",
      });
    }


    const {
      teacherUserId,
      subjectId,
      sectionId,
      academicYearId,
    } = req.body;


    /* ========================================================
       VALIDATION
    ======================================================== */

    if (
      !teacherUserId ||
      !subjectId ||
      !sectionId ||
      !academicYearId
    ) {

      return res.status(400).json({
        message:
          "teacherUserId, subjectId, sectionId and academicYearId are required",
      });

    }


    /* ========================================================
       VERIFY ACADEMIC YEAR
    ======================================================== */

    const academicYear =
      await prisma.academicYear.findFirst({

        where: {
          id:
            academicYearId,

          schoolId,
        },

        select: {
          id: true,
          name: true,
        },

      });


    if (!academicYear) {

      return res.status(404).json({
        message:
          "Academic year not found",
      });

    }


    /* ========================================================
       VERIFY TEACHER
    ======================================================== */

    const teacher =
      await prisma.user.findFirst({

        where: {

          id:
            teacherUserId,

          schoolId,

          isActive:
            true,

          role:
            "TEACHER",

        },

        select: {

          id: true,
          name: true,
          email: true,
          employeeId: true,
          designation: true,

        },

      });


    if (!teacher) {

      return res.status(404).json({
        message:
          "Teacher not found",
      });

    }


    /* ========================================================
       VERIFY SUBJECT
    ======================================================== */

    const subject =
      await prisma.subject.findFirst({

        where: {

          id:
            subjectId,

          schoolId,

          class: {
            academicYearId,
          },

        },

        include: {

          class: {
            select: {
              id: true,
              classNumber: true,
              displayName: true,
            },
          },

        },

      });


    if (!subject) {

      return res.status(404).json({
        message:
          "Subject not found for this academic year",
      });

    }


    /* ========================================================
       VERIFY SECTION
    ======================================================== */

    const section =
      await prisma.section.findFirst({

        where: {

          id:
            sectionId,

          schoolId,

          class: {
            academicYearId,
          },

        },

        include: {

          class: {
            select: {
              id: true,
              classNumber: true,
              displayName: true,
            },
          },

        },

      });


    if (!section) {

      return res.status(404).json({
        message:
          "Section not found for this academic year",
      });

    }


    /* ========================================================
       SUBJECT / SECTION CLASS MATCH
    ======================================================== */

    if (
      subject.class.id !==
      section.class.id
    ) {

      return res.status(400).json({
        message:
          "Subject and section must belong to the same class",
      });

    }


    /* ========================================================
       CHECK DUPLICATE
    ======================================================== */

    const existingMapping =
      await prisma.teacherSubjectMapping.findFirst({

        where: {

          schoolId,

          teacherUserId,

          subjectId,

          sectionId,

          academicYearId,

        },

        select: {
          id: true,
        },

      });


    if (existingMapping) {

      return res.status(409).json({
        message:
          "Teacher is already assigned to this subject and section",
      });

    }


    /* ========================================================
       CREATE
    ======================================================== */

    const mapping =
      await prisma.teacherSubjectMapping.create({

        data: {

          schoolId,

          teacherUserId,

          subjectId,

          sectionId,

          academicYearId,

        },

        include: {

          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true,
              designation: true,
            },
          },

          subject: {
            include: {
              class: true,
            },
          },

          section: {
            include: {
              class: true,
            },
          },

          academicYear: true,

        },

      });


    return res.status(201).json({

      message:
        "Teacher subject mapping created successfully",

      mapping,

    });

  } catch (error) {

    return handleErr(
      error,
      res
    );

  }

};


/* ============================================================
   GET MAPPINGS
============================================================ */

const getTeacherSubjectMappings =
  async (
    req: Request,
    res: Response
  ) => {

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


      const mappings =
        await prisma.teacherSubjectMapping.findMany({

          where: {

            schoolId,

            academicYearId,

          },

          include: {

            teacher: {

              select: {

                id: true,
                name: true,
                email: true,
                employeeId: true,
                designation: true,

              },

            },

            subject: {

              select: {

                id: true,
                name: true,
                code: true,
                isOptional: true,

                class: {

                  select: {

                    id: true,
                    classNumber: true,
                    displayName: true,

                  },

                },

              },

            },

            section: {

              select: {

                id: true,
                sectionName: true,

              },

            },

          },

          orderBy: [

            {
              subject: {
                name: "asc",
              },
            },

            {
              section: {
                sectionName: "asc",
              },
            },

          ],

        });


      return res.status(200).json({

        academicYearId,

        total:
          mappings.length,

        mappings,

      });

    } catch (error) {

      return handleErr(
        error,
        res
      );

    }

  };


/* ============================================================
   GET TEACHERS
============================================================ */

const getTeachersForMapping =
  async (
    req: Request,
    res: Response
  ) => {

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

            role:
              "TEACHER",

            isActive:
              true,

          },

          select: {

            id: true,
            name: true,
            email: true,
            phone: true,
            employeeId: true,
            designation: true,
            department: true,

          },

          orderBy: {

            name:
              "asc",

          },

        });


      return res.status(200).json({

        total:
          teachers.length,

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
   GET SUBJECTS + SECTIONS FOR MAPPING
============================================================ */

const getSubjectsForMapping =
  async (
    req: Request,
    res: Response
  ) => {

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


      const classes =
        await prisma.class.findMany({

          where: {

            schoolId,

            academicYearId,

            isCompleted:
              false,

          },

          select: {

            id: true,

            classNumber: true,

            displayName: true,

            subjects: {

              select: {

                id: true,
                name: true,
                code: true,
                isOptional: true,

              },

              orderBy: {

                name:
                  "asc",

              },

            },

            sections: {

              select: {

                id: true,
                sectionName: true,

              },

              orderBy: {

                sectionName:
                  "asc",

              },

            },

          },

          orderBy: {

            classNumber:
              "asc",

          },

        });


      return res.status(200).json({

        academicYearId,

        classes,

      });

    } catch (error) {

      return handleErr(
        error,
        res
      );

    }

  };


/* ============================================================
   DELETE MAPPING
============================================================ */

const deleteTeacherSubjectMapping =
  async (
    req: Request,
    res: Response
  ) => {

    try {

      const schoolId =
        getSchoolId(req);

      if (!schoolId) {

        return res.status(400).json({
          message:
            "schoolId is required",
        });

      }


      const mappingId =
        String(
          req.params?.mappingId ??
          ""
        ).trim();


      if (!mappingId) {

        return res.status(400).json({
          message:
            "mappingId is required",
        });

      }


      const mapping =
        await prisma.teacherSubjectMapping.findFirst({

          where: {

            id:
              mappingId,

            schoolId,

          },

        });


      if (!mapping) {

        return res.status(404).json({
          message:
            "Teacher subject mapping not found",
        });

      }


      await prisma.teacherSubjectMapping.delete({

        where: {

          id:
            mapping.id,

        },

      });


      return res.status(200).json({

        message:
          "Teacher subject mapping removed successfully",

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

export const teacherSubjectMappingControllers = {

  assignTeacherSubject,

  getTeacherSubjectMappings,

  getTeachersForMapping,

  getSubjectsForMapping,

  deleteTeacherSubjectMapping,

};