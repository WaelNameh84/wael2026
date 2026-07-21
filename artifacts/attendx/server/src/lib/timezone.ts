import { getAppTimezone } from "./gemini-config.js";

/**
 * App timezone — all "today" / local-time calculations use this zone.
 * Reads from gemini-config.json so admins can change it from the settings page.
 */
export const APP_TIMEZONE = "Europe/Stockholm"; // fallback constant; runtime always calls getAppTimezone()

/**
 * Returns today's date string (YYYY-MM-DD) in the app timezone.
 */
export function getLocalDate(tz: string = getAppTimezone()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(new Date());
}

/**
 * Returns the local hour (0-23) of a given Date in the app timezone.
 */
export function getLocalHour(date: Date, tz: string = getAppTimezone()): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(date),
    10,
  );
}

/**
 * Returns the local minute (0-59) of a given Date in the app timezone.
 */
export function getLocalMinute(date: Date, tz: string = getAppTimezone()): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      minute: "2-digit",
    }).format(date),
    10,
  );
}

/**
 * Returns local hours + minutes as total minutes from midnight for a given
 * Date in the app timezone.
 */
export function getLocalMinutesFromMidnight(date: Date, tz: string = getAppTimezone()): number {
  return getLocalHour(date, tz) * 60 + getLocalMinute(date, tz);
}
