import { Response } from "express";
import dayjs from "dayjs";

export const handleErr = (err: unknown, res: Response) => {
  return res.status(500).json({ message: err });
};

export const getMonthDateRange = (month: string, year: string) => {
  const days = [];
  const monthStr = month.length === 2 ? month : "0" + month;
  for (let i = 1; i <= 31; ++i) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    days.push(`${dayStr}/${monthStr}/${year}`);
  }
  return days;
};
