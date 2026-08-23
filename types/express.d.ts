import { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;

      user?: {
        id: string;
        schoolId?: string;
        schoolCode?: string;
        role?: RoleName;
        type?:
          | "PLATFORM_ADMIN"
          | "SCHOOL_USER";
      };
    }
  }
}

export {};