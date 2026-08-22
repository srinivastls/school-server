import { ClassType } from "./entities.types";

export type CreateClassRequest = ClassType;

export type GetAllClassesResponse = {
  classes: ClassType[];
};

export type DeleteClassRequest = Pick<ClassType, "classNumber">;

export type GetClassRequest = Pick<ClassType, "classNumber">;
export type GetClassResponse = ClassType;

export type EditClassRequest = ClassType;
