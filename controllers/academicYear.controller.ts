import { prisma } from "../config";
import {
  Request,
  Response,
} from "../types";
import { handleErr } from "../utils";

const getSchoolId = (req: any): string | undefined => {
  return req.user?.schoolId ?? req.body?.schoolId;
};

const getAcademicYears = async (
  req: Request,
  res: Response
) => {
  try {
    const schoolId = getSchoolId(req);

    if (!schoolId) {
      return res.status(400).json({
        message: "schoolId is required",
      });
    }

    const academicYears =
      await prisma.academicYear.findMany({
        where: {
          schoolId,
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          isCurrent: true,
        },
        orderBy: {
          startDate: "desc",
        },
      });

    return res.status(200).json({
      academicYears,
    });
  } catch (err) {
    return handleErr(err as any, res);
  }
};

export const academicYearControllers = {
  getAcademicYears,
};