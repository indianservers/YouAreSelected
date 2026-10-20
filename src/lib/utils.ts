import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const date = (value: string, pattern = "dd MMM yyyy, hh:mm a") => {
  try {
    return format(new Date(value), pattern);
  } catch {
    return "Not scheduled";
  }
};
export const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.max(0, seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export const examDate = (
  value: string,
  timeZone: string,
  pattern = "dd MMM yyyy, hh:mm a zzz",
) => {
  try {
    return formatInTimeZone(value, timeZone, pattern);
  } catch {
    return "Not scheduled";
  }
};
