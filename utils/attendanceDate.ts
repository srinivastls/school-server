import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export const parseAttendanceDate = (
  value: unknown
): Date | null => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const input = value.trim();

  const acceptedFormats = [
    "YYYY-MM-DD",
    "DD/MM/YYYY",
  ];

  const parsed = dayjs(input, acceptedFormats, true);

  if (!parsed.isValid()) {
    return null;
  }

  return parsed.startOf("day").toDate();
};