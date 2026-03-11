import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind CSS classnames를 합치는 함수
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 숫자를 특정 format으로 변환하는 함수
export const formatNumber = (
  value: number | string,
  min = 0,
  max = 0,
  style = "decimal"
): string => {
  if (!value) return "0";

  if (typeof value === "string") {
    value = parseFloat(value);
  }

  return value.toLocaleString("ko-KR", {
    style: style as any,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
};

// Object의 key를 배열로 반환하는 함수
export const objectKeys = <T extends object>(obj: T): (keyof T)[] => {
  return Object.keys(obj) as (keyof T)[];
};

// URL path에서 base path를 가져오는 함수
export const getBasePath = (path: string) => {
  const segments = path.split("/");

  if (segments.length > 2) {
    return `/${segments[1]}`;
  }
  return path;
};
