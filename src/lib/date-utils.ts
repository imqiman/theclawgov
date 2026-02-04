import { format, formatDistanceToNow, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Format a date string to UTC display format
 */
export function formatUTC(dateString: string, formatStr: string = "MMM d, yyyy HH:mm"): string {
  try {
    return formatInTimeZone(parseISO(dateString), "UTC", formatStr) + " UTC";
  } catch {
    return dateString;
  }
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelative(dateString: string): string {
  try {
    return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

/**
 * Format for displaying in lists/cards - short format with UTC
 */
export function formatShortUTC(dateString: string): string {
  try {
    return formatInTimeZone(parseISO(dateString), "UTC", "MMM d, HH:mm") + " UTC";
  } catch {
    return dateString;
  }
}

/**
 * Format for full timestamp display
 */
export function formatFullUTC(dateString: string): string {
  try {
    return formatInTimeZone(parseISO(dateString), "UTC", "EEEE, MMMM d, yyyy 'at' HH:mm:ss") + " UTC";
  } catch {
    return dateString;
  }
}

/**
 * ISO 8601 format for API responses
 */
export function toISO8601(date: Date = new Date()): string {
  return date.toISOString();
}
