import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
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
