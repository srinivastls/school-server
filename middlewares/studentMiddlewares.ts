import { NextFunction } from "express";
import { prisma } from "../config";
import { CreateStudentRequest, RequestWithBody, Response } from "../types";
import { handleErr } from "../utils";

const checkDuplicateStudent = async (
  req: RequestWithBody<CreateStudentRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { admissionNo: req.body.admissionNo },
          { aadhaar: req.body.aadhaar },
          ...(req.body.tcNo ? [{ tcNo: req.body.tcNo }] : []),
        ],
      },
      select: {
        admissionNo: true,
        aadhaar: true,
        tcNo: true,
      },
    });
    if (students.length) {
      let dupAdmissionNo = false,
        dupAadhaar = false,
        dupTcNo = false;
      students.forEach((student) => {
        if (student.admissionNo === req.body.admissionNo) {
          dupAdmissionNo = true;
        }
        if (student.aadhaar === req.body.aadhaar) {
          dupAadhaar = true;
        }
        if (student.tcNo !== "" && student.tcNo === req.body.tcNo) {
          dupTcNo = true;
        }
      });
      return res.status(400).json({
        message: `Duplicate${dupAdmissionNo ? " admission number" : ""}${
          dupAadhaar ? `${dupAdmissionNo ? ", " : " "}aadhaar` : ""
        }${
          dupTcNo ? `${dupAadhaar || dupAdmissionNo ? ", " : " "}TC No.` : ""
        }`,
      });
    }
  } catch (err) {
    return handleErr(err, res);
  }
  next();
};

const checkSiblingsExist = async (
  req: RequestWithBody<CreateStudentRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const siblings = req.body.siblings;
    if (!siblings) {
      return res
        .status(400)
        .json({ message: "siblings field missing in request body" });
    }
    if (!siblings?.length) {
      next();
      return;
    }

    //check if admission number is smae for 2 or more siblings
    const admissionNoExists: { [key: string]: boolean } = {};
    for (const sibling of siblings) {
      if (sibling.admissionNo === req.body.admissionNo) {
        return res.status(400).json({
          message: "Sibling cannot have same admission ID as the student",
        });
      }
      if (!admissionNoExists[sibling.admissionNo]) {
        admissionNoExists[sibling.admissionNo] = true;
      } else {
        return res
          .status(400)
          .json({ message: "Admission number of siblings are repeating" });
      }
    }

    //find all students using or condition of admission ids
    //if that array's length is equal to siblings length, then all sibling exists
    //otherwise, some siblings do not exist
    const admissionIdFilters = siblings.map((sibling) => ({
      admissionNo: sibling.admissionNo,
    }));
    const siblingStudents = await prisma.student.findMany({
      where: {
        OR: admissionIdFilters,
      },
      select: {
        admissionNo: true,
        name: true,
      },
    });
    if (siblingStudents.length < siblings.length) {
      //find which admission numbers are incorrect
      const correctAdmissionNos = siblingStudents.map(
        (sibling) => sibling.admissionNo
      );
      const incorrectAdmissionNumbers = siblings
        .filter((sibling) => !correctAdmissionNos.includes(sibling.admissionNo))
        .map((sibling) => sibling.admissionNo);
      return res.status(400).json({
        message: `The following admission numbers for siblings are incorrect: ${incorrectAdmissionNumbers.join(
          ", "
        )}`,
      });
    }
    req.body.siblingStudentsFromDb = siblingStudents;
  } catch (err) {
    return handleErr(err, res);
  }
  next();
};

export const studentMiddlewares = { checkDuplicateStudent, checkSiblingsExist };
