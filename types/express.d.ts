// types/express.d.ts

import { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userId?: string;

      user?: {
        id: string;
        schoolId?: string;
        role?: RoleName;
      };
    }
  }
}

export {};