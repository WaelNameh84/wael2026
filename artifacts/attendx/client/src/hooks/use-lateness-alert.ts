/**
 * use-lateness-alert — Detects employees with recurring lateness.
 * Scans the last N days of attendance records and flags employees
 * who have been late `threshold` or more times within that window.
 */
import { useMemo } from "react";

export interface LatenessOffender {
  userId: number;
  userName: string;
  department?: string | null;
  lateDates: string[];   // ISO date strings
  lateCount: number;
}

export interface AttendanceRecord {
  userId: number;
  userName?: string | null;
  date: string;
  status: string;
  checkIn?: string | null;
  department?: string | null;
}

interface Options {
  /** How many calendar days to look back (default: 7) */
  windowDays?: number;
  /** How many late occurrences trigger an alert (default: 3) */
  threshold?: number;
  /** Whether the feature is enabled */
  enabled?: boolean;
}

export function useLatenessAlert(
  records: AttendanceRecord[] | undefined,
  opts: Options = {}
): LatenessOffender[] {
  const { windowDays = 7, threshold = 3, enabled = true } = opts;

  return useMemo(() => {
    if (!enabled || !records || records.length === 0) return [];

    const now   = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - windowDays);

    // Gather late records within the window
    const lateByUser = new Map<number, { userName: string; department?: string | null; dates: string[] }>();

    for (const rec of records) {
      if (rec.status !== "late") continue;
      const d = new Date(rec.date);
      if (d < cutoff) continue;

      const entry = lateByUser.get(rec.userId) ?? {
        userName:   rec.userName ?? String(rec.userId),
        department: rec.department,
        dates:      [],
      };
      if (!entry.dates.includes(rec.date)) entry.dates.push(rec.date);
      lateByUser.set(rec.userId, entry);
    }

    const offenders: LatenessOffender[] = [];
    lateByUser.forEach(({ userName, department, dates }, userId) => {
      if (dates.length >= threshold) {
        offenders.push({ userId, userName, department, lateDates: dates.sort(), lateCount: dates.length });
      }
    });

    return offenders.sort((a, b) => b.lateCount - a.lateCount);
  }, [records, windowDays, threshold, enabled]);
}
