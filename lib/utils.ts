import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get today's date in Central Standard Time (CST) as YYYY-MM-DD string
 * Only works on client-side (browser)
 */
export function getTodayCST(): string {
  if (typeof window === "undefined") {
    // Server-side: return UTC date as fallback
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  
  try {
    const now = new Date();
    // Use Intl.DateTimeFormat for better timezone handling
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === "year")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const day = parts.find(p => p.type === "day")?.value || "";
    return `${year}-${month}-${day}`;
  } catch (error) {
    // Fallback to local date if timezone conversion fails
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Convert a date string (YYYY-MM-DD) to ISO timestamp at noon CST
 * This creates a timestamp that represents noon in Central Time (America/Chicago)
 * We store as 18:00 UTC (noon CST in winter) or 17:00 UTC (noon CDT in summer)
 * to ensure the date portion is correct when extracted using timestampToDateString
 */
export function dateToCSTTimestamp(dateString: string): string {
  // Store as 18:00 UTC, which is approximately noon CST (accounting for DST)
  // This ensures that when we extract the date in CST timezone, we get the same calendar day
  // 18:00 UTC = 12:00 CST (winter) or 13:00 CDT (summer), both on the same day
  return new Date(`${dateString}T18:00:00Z`).toISOString();
}

/**
 * Extract date portion (YYYY-MM-DD) from an ISO timestamp, accounting for CST
 */
export function timestampToDateString(timestamp: string): string {
  try {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    // Use Intl.DateTimeFormat for better timezone handling
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === "year")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const day = parts.find(p => p.type === "day")?.value || "";
    return `${year}-${month}-${day}`;
  } catch (error) {
    // Fallback to simple date extraction if timezone conversion fails
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
