import { prisma } from "../config";

import {
  ClassType,
  CreateClassRequest,
  DeleteClassRequest,
  EditClassRequest,
  GetAllClassesResponse,
  GetClassRequest,
  GetClassResponse,
  MarkClassCompleteRequest,
  Request,
  RequestWithBody,
  RequestWithQuery,
  Response,
} from "../types";

import { handleErr } from "../utils";

const createClass = async (
  req: RequestWithBody<CreateClassRequest>,
  res: Response
) => {
  try {
    const {
      classNumber,
      tuitionFee,
      textBookFee,
      noteBookFee,
      year,
      diary,
    } = req.body;

    if (
      !classNumber ||
      !tuitionFee ||
      !textBookFee ||
      !noteBookFee ||
      !year ||
      !diary
    ) {
      return res
        .status(400)
        .json({ message: "Some fields are missing in request body" });
    }

    await prisma.class.create({
      data: {
        classNumber,
        tuitionFee,
        textBookFee,
        noteBookFee,
        year,
        diary,
      },
    });

    return res.json({
      message: "Class created successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const getAllClasses = async (
  req: Request,
  res: Response<GetAllClassesResponse>
) => {
  try {
    const classes = await prisma.class.findMany();

    const classList: ClassType[] = [];

    classes.forEach((classDetails) => {
      const {
        classNumber,
        tuitionFee,
        textBookFee,
        noteBookFee,
        year,
        diary,
      } = classDetails;

      if (!classNumber.includes("COMPLETED")) {
        classList.push({
          classNumber,
          tuitionFee,
          textBookFee,
          noteBookFee,
          year,
          diary,
        });
      }
    });

    classList.sort((a, b) => {
      return +a.classNumber - +b.classNumber;
    });

    return res.status(200).json({
      classes: classList,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const deleteClass = async (
  req: RequestWithBody<DeleteClassRequest>,
  res: Response
) => {
  try {
    if (!req.body.classNumber) {
      return res.status(400).json({
        message: "classNumber missing in request body",
      });
    }

    const classDetails = await prisma.class.findFirst({
      where: {
        classNumber: req.body.classNumber,
      },
      include: {
        students: true,
      },
    });

    if (!classDetails) {
      return res.status(400).json({
        message: "Class doesn't exist",
      });
    }

    // Prevent deletion if students belong to this class
    if (classDetails.students.length > 0) {
      return res.status(400).json({
        message: "Cannot delete class because it has students",
      });
    }

    await prisma.class.delete({
      where: {
        id: classDetails.id,
      },
    });

    return res.status(200).json({
      message: "Class deleted successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const getClassDetails = async (
  req: RequestWithQuery<GetClassRequest>,
  res: Response<GetClassResponse>
) => {
  try {
    if (!req.query.classNumber) {
      return res.status(400).json({
        message: "classNumber missing in request query parameter",
      });
    }

    const classDetails = await prisma.class.findFirst({
      where: {
        classNumber: req.query.classNumber,
      },
    });

    if (!classDetails) {
      return res.status(404).json({
        message: "Class not found",
      });
    }

    const {
      classNumber,
      tuitionFee,
      textBookFee,
      noteBookFee,
      year,
      diary,
    } = classDetails;

    return res.status(200).json({
      classNumber,
      tuitionFee,
      textBookFee,
      noteBookFee,
      year,
      diary,
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const editClassDetails = async (
  req: RequestWithBody<EditClassRequest>,
  res: Response
) => {
  try {
    const existingClass = await prisma.class.findFirst({
      where: {
        classNumber: req.body.classNumber,
      },
    });

    if (!existingClass) {
      return res.status(404).json({
        message: "Class not found",
      });
    }

    await prisma.class.update({
      where: {
        id: existingClass.id,
      },
      data: {
        ...req.body,
      },
    });

    return res.status(200).json({
      message: "Class details updated successfully.",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

const markClassAsCompleted = async (
  req: RequestWithBody<MarkClassCompleteRequest>,
  res: Response
) => {
  const { classNumber } = req.body;

  if (!classNumber) {
    return res.status(400).json({
      message: "Request body is missing some params",
    });
  }

  try {
    const classDetails = await prisma.class.findFirst({
      where: {
        classNumber,
      },
    });

    if (!classDetails) {
      return res.status(400).json({
        message: "Source class doesn't exist",
      });
    }

    const newClassName =
      `${classNumber}-${classDetails.year}-COMPLETED`;

    await prisma.class.update({
      where: {
        id: classDetails.id,
      },
      data: {
        classNumber: newClassName,
      },
    });

    return res.status(200).json({
      message: "Class emptied successfully",
    });
  } catch (err) {
    return handleErr(err, res);
  }
};

export const classControllers = {
  createClass,
  getAllClasses,
  deleteClass,
  getClassDetails,
  editClassDetails,
  markClassAsCompleted,
};