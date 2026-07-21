import { Router } from "express";
import { db, attendanceTable, usersTable, locationsTable, lateJustificationsTable, messagesTable } from "../../../db/src/index.js";
import { eq, and, gte, lte, desc, isNull, isNotNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { createNotification, createNotificationForUser } from "../lib/notify.js";

/** Returns the correct HTTP status for a caught error:
 *  - ZodError (validation failure) → 400
 *  - PostgreSQL unique-violation (23505) → 409
 *  - Everything else → 500
 */
function httpStatus(err: any): number {
  if (err?.statusCode)            return err.statusCode;
  if (err?.name === "ZodError")   return 400;
  if (err?.code === "23505")      return 409;
  if (err?.code === "23503")      return 400;
  return 500;
}

/**
 * Parse a route :id param as a positive integer.
 * Throws a 400 error (caught by each route's try/catch) when invalid.
 */
function parseId(s: string): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw Object.assign(new Error("Invalid ID — must be a positive integer"), { statusCode: 400 });
  }
  return n;
}
import { getLateThresholdMinutes, getWorkStartTime, getLateGraceMinutes, getBreakMinutes, getGpsEnabled, getGpsRadius } from "../lib/gemini-config.js";

/** Haversine distance between two GPS coordinates in metres */
function gpsDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
import { getLocalDate, getLocalMinutesFromMidnight } from "../lib/timezone.js";

const router = Router();

/**
 * All timestamps are stored in UTC in PostgreSQL.
 * Timestamps are returned as ISO 8601 UTC strings (toISOString()).
 * Clients display times in their local timezone.
 */
/** Parse "HH:MM" → total minutes from midnight */
function parseTimeMinutes(t: string): number {
  const [hh, mm] = t.split(":").map(Number);
  return hh * 60 + mm;
}

/**
 * Calculates effective PAID hours between checkIn and checkOut.
 * - Early check-in before shift start does NOT count (clamped to shift start).
 * - Break time is deducted — it is not paid.
 * @param userWorkStart  Per-employee shift start "HH:MM" — overrides global when set.
 */
function calcHours(checkIn: Date, checkOut: Date, userWorkStart?: string | null): number {
  const startStr = (userWorkStart && /^\d{2}:\d{2}$/.test(userWorkStart)) ? userWorkStart : getWorkStartTime();
  const shiftStartMinutes = parseTimeMinutes(startStr);
  const checkInMinutes = getLocalMinutesFromMidnight(checkIn);

  // Clamp early arrival to shift start
  let effectiveCheckIn = checkIn;
  if (checkInMinutes < shiftStartMinutes) {
    const earlyMs = (shiftStartMinutes - checkInMinutes) * 60_000;
    effectiveCheckIn = new Date(checkIn.getTime() + earlyMs);
  }

  const rawMs = checkOut.getTime() - effectiveCheckIn.getTime();
  if (rawMs < 0) return 0;
  const rawHours = rawMs / 3_600_000;

  // Deduct unpaid break from worked hours
  const breakHours = getBreakMinutes() / 60;
  return Math.round(Math.max(0, rawHours - breakHours) * 100) / 100;
}

/**
 * Calculates overtime based on actual check-out time vs shift end time.
 * @param userWorkStart  Per-employee shift start "HH:MM"
 * @param userWorkEnd    Per-employee shift end "HH:MM" — if set, used directly as shift end.
 */
function calcOvertimeByTime(
  checkOut: Date,
  workHoursPerDay: number,
  userWorkStart?: string | null,
  userWorkEnd?: string | null,
): number {
  let shiftEndMinutes: number;
  if (userWorkEnd && /^\d{2}:\d{2}$/.test(userWorkEnd)) {
    shiftEndMinutes = parseTimeMinutes(userWorkEnd);
  } else {
    const startStr = (userWorkStart && /^\d{2}:\d{2}$/.test(userWorkStart)) ? userWorkStart : getWorkStartTime();
    const shiftStartMinutes = parseTimeMinutes(startStr);
    // Shift end includes both paid hours AND the break duration
    shiftEndMinutes = shiftStartMinutes + workHoursPerDay * 60 + getBreakMinutes();
  }
  const checkOutMinutes = getLocalMinutesFromMidnight(checkOut);
  return Math.max(0, Math.round(((checkOutMinutes - shiftEndMinutes) / 60) * 100) / 100);
}

/**
 * Effective work hours for an employee based on their shift window.
 * Used for early-leave detection.
 */
function effectiveWorkHours(
  workHoursPerDay: number,
  userWorkStart?: string | null,
  userWorkEnd?: string | null,
): number {
  if (
    userWorkStart && userWorkEnd &&
    /^\d{2}:\d{2}$/.test(userWorkStart) && /^\d{2}:\d{2}$/.test(userWorkEnd)
  ) {
    const minutes = parseTimeMinutes(userWorkEnd) - parseTimeMinutes(userWorkStart) - getBreakMinutes();
    return Math.max(0, minutes / 60);
  }
  return workHoursPerDay;
}

/**
 * @param userWorkStart  Per-employee shift start "HH:MM" — overrides global when set.
 */
function checkInStatus(checkInTime: Date, userWorkStart?: string | null): string {
  const totalMinutes = getLocalMinutesFromMidnight(checkInTime);
  let threshold: number;
  if (userWorkStart && /^\d{2}:\d{2}$/.test(userWorkStart)) {
    threshold = parseTimeMinutes(userWorkStart) + getLateGraceMinutes();
  } else {
    threshold = getLateThresholdMinutes();
  }
  return totalMinutes > threshold ? "late" : "present";
}

/** Serialize a record's timestamps to ISO strings. */
function serializeRecord(r: any): any {
  return {
    ...r,
    checkIn: r.checkIn instanceof Date ? r.checkIn.toISOString() : r.checkIn,
    checkOut: r.checkOut instanceof Date ? r.checkOut.toISOString() : (r.checkOut ?? null),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

router.get("/", requireAuth, async (req: any, res) => {
  try {
    const { userId, from, to, status } = req.query as any;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const targetUserId = ["admin","manager"].includes(me.role) && userId ? parseInt(userId) : req.userId;

    const records = await db.select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      userName: usersTable.name,
      locationId: attendanceTable.locationId,
      locationName: locationsTable.name,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      hoursWorked: attendanceTable.hoursWorked,
      overtime: attendanceTable.overtime,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
      biometricVerified: attendanceTable.biometricVerified,
      createdAt: attendanceTable.createdAt,
    })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
      .leftJoin(locationsTable, eq(attendanceTable.locationId, locationsTable.id))
      .where(["admin","manager"].includes(me.role) && !userId ? undefined : eq(attendanceTable.userId, targetUserId))
      .orderBy(desc(attendanceTable.checkIn));

    let result = records;
    if (from) result = result.filter(r => r.date >= from);
    if (to) result = result.filter(r => r.date <= to);
    if (status) result = result.filter(r => r.status === status);

    return res.json(result.map(serializeRecord));
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/**
 * POST /check-in
 * Creates a new session for today. Blocked only if there is already an
 * open (not checked-out) session — NOT if the user has checked in before.
 */
router.post("/check-in", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      locationId: z.number().int(),
      biometricVerified: z.boolean().optional().default(false),
      notes: z.string().optional(),
      gpsLat: z.number().optional(),
      gpsLng: z.number().optional(),
      gpsAddress: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const today = getLocalDate();

    // Block only if there is currently an open session
    const openSession = await db.select()
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.userId, req.userId),
        eq(attendanceTable.date, today),
        isNull(attendanceTable.checkOut)
      ))
      .limit(1);

    if (openSession.length > 0) {
      return res.status(400).json({ error: "Already checked in. Please check out before starting a new session." });
    }

    const now = new Date();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const status = checkInStatus(now, user?.workStartTime);
    const [record] = await db.insert(attendanceTable).values({
      userId: req.userId,
      locationId: body.locationId,
      date: today,
      checkIn: now,
      status,
      notes: body.notes,
      biometricVerified: body.biometricVerified ?? false,
      gpsLat: body.gpsLat ?? null,
      gpsLng: body.gpsLng ?? null,
      gpsAddress: body.gpsAddress ?? null,
    }).returning();

    const [loc] = await db.select().from(locationsTable).where(eq(locationsTable.id, body.locationId)).limit(1);

    // ── تحقق من الموقع الجغرافي (سيرفر-سايد) ────────────────────────────────
    if (getGpsEnabled() && loc?.lat && loc?.lng) {
      if (!body.gpsLat || !body.gpsLng) {
        return res.status(400).json({ error: "GPS location is required for this attendance location.", code: "GPS_REQUIRED" });
      }
      const dist = gpsDistance(body.gpsLat, body.gpsLng, loc.lat, loc.lng);
      const allowedRadius = getGpsRadius();
      if (dist > allowedRadius) {
        return res.status(403).json({
          error: `You are ${Math.round(dist)} m away from the allowed location (max ${allowedRadius} m).`,
          code: "GPS_OUT_OF_RANGE",
          distance: Math.round(dist),
          allowedRadius,
        });
      }
    }

    if (status === "late") {
      createNotification({
        type: "LATE_CHECKIN",
        title: `Late check-in: ${user?.name ?? "Employee"}`,
        message: `${user?.name ?? "An employee"} checked in late at ${now.toUTCString()}.`,
        relatedId: record.id,
        relatedType: "attendance",
      }).catch(console.error);
    }
    return res.status(201).json({
      ...serializeRecord(record),
      userName: user?.name ?? null,
      locationName: loc?.name ?? null,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /check-out
 * Closes the latest open session for today. Can be called multiple times
 * throughout the day (each time closing the most recent open session).
 */
router.post("/check-out", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({ notes: z.string().optional() });
    const body = schema.parse(req.body);
    const today = getLocalDate();

    // Find the latest open session
    const [openRecord] = await db.select()
      .from(attendanceTable)
      .where(and(
        eq(attendanceTable.userId, req.userId),
        eq(attendanceTable.date, today),
        isNull(attendanceTable.checkOut)
      ))
      .orderBy(desc(attendanceTable.checkIn))
      .limit(1);

    if (!openRecord) {
      return res.status(404).json({ error: "Not currently checked in" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const now = new Date();
    const hoursWorked = calcHours(openRecord.checkIn, now, user?.workStartTime);
    const overtime = calcOvertimeByTime(now, user.workHoursPerDay, user?.workStartTime, user?.workEndTime);
    const effHours = effectiveWorkHours(user.workHoursPerDay, user?.workStartTime, user?.workEndTime);
    const status = hoursWorked < effHours * 0.75 ? "early_leave" : openRecord.status;

    const [updated] = await db.update(attendanceTable).set({
      checkOut: now,
      hoursWorked,
      overtime,
      status,
      notes: body.notes ?? openRecord.notes,
    }).where(eq(attendanceTable.id, openRecord.id)).returning();

    if (status === "early_leave") {
      createNotification({
        type: "EARLY_LEAVE",
        title: `مغادرة مبكرة: ${user?.name ?? "موظف"}`,
        message: `${user?.name ?? "موظف"} سجل خروجاً مبكراً بتاريخ ${openRecord.date} (${hoursWorked.toFixed(1)} ساعة من ${effHours.toFixed(1)} ساعة).`,
        relatedId: updated.id,
        relatedType: "attendance",
      }).catch(console.error);
    }

    const [loc] = openRecord.locationId
      ? await db.select().from(locationsTable).where(eq(locationsTable.id, openRecord.locationId)).limit(1)
      : [null];

    return res.json({
      ...serializeRecord(updated),
      userName: user?.name ?? null,
      locationName: (loc as any)?.name ?? null,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /today
 * Returns a summary of all sessions for today including:
 *  - sessions[]: each check-in/out pair
 *  - currentlyCheckedIn: whether there is an open session right now
 *  - totalHoursWorked: cumulative hours of all completed sessions
 * Also includes top-level fields for backward-compat (checkIn, checkOut, hoursWorked, status).
 */
router.get("/today", requireAuth, async (req: any, res) => {
  try {
    const today = getLocalDate();

    const records = await db.select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      userName: usersTable.name,
      locationId: attendanceTable.locationId,
      locationName: locationsTable.name,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      hoursWorked: attendanceTable.hoursWorked,
      overtime: attendanceTable.overtime,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
      biometricVerified: attendanceTable.biometricVerified,
      createdAt: attendanceTable.createdAt,
    })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
      .leftJoin(locationsTable, eq(attendanceTable.locationId, locationsTable.id))
      .where(and(eq(attendanceTable.userId, req.userId), eq(attendanceTable.date, today)))
      .orderBy(attendanceTable.checkIn);

    if (records.length === 0) {
      return res.status(404).json({ error: "No check-in today" });
    }

    const sessions = records.map(serializeRecord);
    const openSession = sessions.find(s => !s.checkOut) ?? null;
    const currentlyCheckedIn = openSession !== null;

    // Cumulative hours from all completed sessions
    const completedHours = sessions
      .filter(s => s.checkOut)
      .reduce((sum, s) => sum + (s.hoursWorked || 0), 0);

    // Fetch user schedule for per-employee shift times
    const [todayUser] = await db.select({
      workStartTime: usersTable.workStartTime,
      workEndTime: usersTable.workEndTime,
      workHoursPerDay: usersTable.workHoursPerDay,
    }).from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);

    // If open session, add in-progress time
    const inProgressHours = openSession
      ? calcHours(new Date(openSession.checkIn), new Date(), todayUser?.workStartTime)
      : 0;

    const totalHoursWorked = Math.round((completedHours + inProgressHours) * 100) / 100;

    const first = sessions[0];
    const last = sessions[sessions.length - 1];

    return res.json({
      // Backward-compat fields (based on first/last session of day)
      id: first.id,
      userId: first.userId,
      userName: first.userName,
      locationId: first.locationId,
      locationName: first.locationName,
      date: first.date,
      checkIn: first.checkIn,
      checkOut: currentlyCheckedIn ? null : last.checkOut,
      hoursWorked: totalHoursWorked,
      overtime: calcOvertimeByTime(new Date(), todayUser?.workHoursPerDay ?? 8, todayUser?.workStartTime, todayUser?.workEndTime),
      status: first.status,
      biometricVerified: first.biometricVerified,
      notes: first.notes,
      createdAt: first.createdAt,
      // New fields for multi-session support
      sessions,
      currentlyCheckedIn,
      totalHoursWorked,
      openSessionId: openSession?.id ?? null,
    });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

router.patch("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const schema = z.object({
      checkIn: z.string().optional(),
      checkOut: z.string().optional(),
      status: z.string().optional(),
      notes: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const updates: any = {};
    if (body.checkIn) updates.checkIn = new Date(body.checkIn);
    if (body.checkOut) updates.checkOut = new Date(body.checkOut);
    if (body.status) updates.status = body.status;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (updates.checkIn && updates.checkOut) {
      // Fetch the employee's shift schedule for accurate calculations
      const [rec] = await db.select({ userId: attendanceTable.userId }).from(attendanceTable).where(eq(attendanceTable.id, id)).limit(1);
      const [empUser] = rec ? await db.select({
        workHoursPerDay: usersTable.workHoursPerDay,
        workStartTime: usersTable.workStartTime,
        workEndTime: usersTable.workEndTime,
      }).from(usersTable).where(eq(usersTable.id, rec.userId)).limit(1) : [null];
      updates.hoursWorked = calcHours(updates.checkIn, updates.checkOut, empUser?.workStartTime);
      updates.overtime = calcOvertimeByTime(updates.checkOut, empUser?.workHoursPerDay ?? 8, empUser?.workStartTime, empUser?.workEndTime);
    }
    const [updated] = await db.update(attendanceTable).set(updates).where(eq(attendanceTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Record not found" });
    return res.json({ ...serializeRecord(updated), userName: null, locationName: null });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get("/summary/daily", requireAuth, async (req: any, res) => {
  try {
    const { date, userId } = req.query as any;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const targetDate = date || getLocalDate();

    if (["admin","manager"].includes(me.role)) {
      const allUsers = await db.select().from(usersTable);
      const dayRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.date, targetDate));
      // Per-user stats (group by userId for multi-session support)
      const userMap = new Map<number, typeof dayRecords>();
      for (const r of dayRecords) {
        if (!userMap.has(r.userId)) userMap.set(r.userId, []);
        userMap.get(r.userId)!.push(r);
      }
      let present = 0, late = 0, onLeave = 0;
      for (const [, recs] of userMap) {
        const first = recs[0];
        if (first.status === "on_leave") onLeave++;
        else if (first.status === "late") { present++; late++; }
        else present++;
      }
      const totalHours = dayRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
      return res.json({
        date: targetDate,
        totalEmployees: allUsers.length,
        present,
        absent: allUsers.length - present - onLeave,
        late,
        onLeave,
        totalHours: Math.round(totalHours * 100) / 100,
      });
    } else {
      const uid = parseInt(userId) || req.userId;
      const records = await db.select().from(attendanceTable)
        .where(and(eq(attendanceTable.userId, uid), eq(attendanceTable.date, targetDate)));
      const totalHours = records.reduce((s, r) => s + (r.hoursWorked || 0), 0);
      const first = records[0];
      return res.json({
        date: targetDate,
        totalEmployees: 1,
        present: records.length > 0 ? 1 : 0,
        absent: records.length > 0 ? 0 : 1,
        late: first?.status === "late" ? 1 : 0,
        onLeave: first?.status === "on_leave" ? 1 : 0,
        totalHours: Math.round(totalHours * 100) / 100,
      });
    }
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

router.get("/summary/monthly", requireAuth, async (req: any, res) => {
  try {
    const { month, year, userId } = req.query as any;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const targetUserId = ["admin","manager"].includes(me.role) && userId ? parseInt(userId) : req.userId;
    const now = new Date();
    const m = parseInt(month) || now.getMonth() + 1;
    const y = parseInt(year) || now.getFullYear();
    const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const toDate = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;

    const records = await db.select().from(attendanceTable)
      .where(and(
        eq(attendanceTable.userId, targetUserId),
        gte(attendanceTable.date, fromDate),
        lte(attendanceTable.date, toDate)
      ));

    // Group by date to correctly count days (multiple sessions per day)
    const dateMap = new Map<string, typeof records>();
    for (const r of records) {
      if (!dateMap.has(r.date)) dateMap.set(r.date, []);
      dateMap.get(r.date)!.push(r);
    }

    let presentDays = 0, leaveDays = 0;
    for (const [, dayRecs] of dateMap) {
      if (dayRecs[0].status === "on_leave") leaveDays++;
      else presentDays++;
    }

    const totalHours = records.reduce((s, r) => s + (r.hoursWorked || 0), 0);
    const overtime = records.reduce((s, r) => s + (r.overtime || 0), 0);

    return res.json({
      month: m,
      year: y,
      userId: targetUserId,
      totalDays: lastDay,
      presentDays,
      absentDays: Math.max(0, lastDay - presentDays - leaveDays),
      leaveDays,
      totalHours: Math.round(totalHours * 100) / 100,
      overtime: Math.round(overtime * 100) / 100,
      avgHoursPerDay: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0,
    });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/* ─── Late Justification Routes ──────────────────────────────────────────── */

/**
 * POST /:id/justify
 * Employee submits a justification for a late check-in on record :id.
 */
router.post("/:id/justify", requireAuth, async (req: any, res) => {
  try {
    const attendanceId = parseId(req.params.id);
    const schema = z.object({ reason: z.string().min(5).max(1000) });
    const { reason } = schema.parse(req.body);

    const [rec] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.id, attendanceId), eq(attendanceTable.userId, req.userId)))
      .limit(1);
    if (!rec) return res.status(404).json({ error: "Attendance record not found" });
    if (rec.status !== "late") return res.status(400).json({ error: "Justification only allowed for late records" });

    // Check if already submitted (filter by type='late' to avoid collision with early_leave justifications)
    const [existing] = await db.select().from(lateJustificationsTable)
      .where(and(eq(lateJustificationsTable.attendanceId, attendanceId), eq(lateJustificationsTable.userId, req.userId), eq(lateJustificationsTable.type, "late")))
      .limit(1);
    if (existing) return res.status(409).json({ error: "Justification already submitted", justification: existing });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);

    const [justification] = await db.insert(lateJustificationsTable).values({
      attendanceId,
      userId: req.userId,
      reason,
      type: "late",
      status: "pending",
    }).returning();

    createNotification({
      type: "LATE_JUSTIFICATION",
      title: `تبرير تأخر: ${user?.name ?? "موظف"}`,
      message: `${user?.name ?? "موظف"} تقدّم بتبرير للتأخر بتاريخ ${rec.date}. السبب: ${reason}`,
      relatedId: justification.id,
      relatedType: "late_justification",
    }).catch(console.error);

    return res.status(201).json(justification);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /justifications
 * Admin: list all late justifications with employee + attendance info.
 * Employee: list their own justifications.
 */
router.get("/justifications", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const { attendanceId: attIdQ, type: typeQ } = req.query as Record<string, string>;

    const rows = await db.select({
      id:           lateJustificationsTable.id,
      attendanceId: lateJustificationsTable.attendanceId,
      userId:       lateJustificationsTable.userId,
      reason:       lateJustificationsTable.reason,
      type:         lateJustificationsTable.type,
      status:       lateJustificationsTable.status,
      adminNote:    lateJustificationsTable.adminNote,
      reviewedBy:   lateJustificationsTable.reviewedBy,
      reviewedAt:   lateJustificationsTable.reviewedAt,
      createdAt:    lateJustificationsTable.createdAt,
      employeeName: usersTable.name,
      date:         attendanceTable.date,
      checkIn:      attendanceTable.checkIn,
      checkOut:     attendanceTable.checkOut,
    })
      .from(lateJustificationsTable)
      .leftJoin(usersTable, eq(lateJustificationsTable.userId, usersTable.id))
      .leftJoin(attendanceTable, eq(lateJustificationsTable.attendanceId, attendanceTable.id))
      .where(and(
        ["admin","manager"].includes(me.role) ? undefined : eq(lateJustificationsTable.userId, req.userId),
        attIdQ ? eq(lateJustificationsTable.attendanceId, parseInt(attIdQ)) : undefined,
        typeQ ? eq(lateJustificationsTable.type, typeQ) : undefined,
      ))
      .orderBy(desc(lateJustificationsTable.createdAt));

    return res.json(rows.map(r => ({
      ...r,
      checkIn:   r.checkIn  instanceof Date ? r.checkIn.toISOString()  : r.checkIn,
      checkOut:  r.checkOut instanceof Date ? r.checkOut.toISOString() : r.checkOut,
      reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })));
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/**
 * GET /justifications/:id
 * Fetch a single late justification with employee + attendance info.
 */
router.get("/justifications/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const [row] = await db.select({
      id:           lateJustificationsTable.id,
      attendanceId: lateJustificationsTable.attendanceId,
      userId:       lateJustificationsTable.userId,
      reason:       lateJustificationsTable.reason,
      type:         lateJustificationsTable.type,
      status:       lateJustificationsTable.status,
      adminNote:    lateJustificationsTable.adminNote,
      reviewedAt:   lateJustificationsTable.reviewedAt,
      createdAt:    lateJustificationsTable.createdAt,
      employeeName: usersTable.name,
      date:         attendanceTable.date,
      checkIn:      attendanceTable.checkIn,
      checkOut:     attendanceTable.checkOut,
    })
      .from(lateJustificationsTable)
      .leftJoin(usersTable, eq(lateJustificationsTable.userId, usersTable.id))
      .leftJoin(attendanceTable, eq(lateJustificationsTable.attendanceId, attendanceTable.id))
      .where(eq(lateJustificationsTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json({
      ...row,
      checkIn:   row.checkIn  instanceof Date ? row.checkIn.toISOString()  : row.checkIn,
      checkOut:  row.checkOut instanceof Date ? row.checkOut.toISOString() : row.checkOut,
      reviewedAt: row.reviewedAt instanceof Date ? row.reviewedAt.toISOString() : row.reviewedAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/**
 * PATCH /justifications/:id
 * Admin: approve or reject a late justification.
 * On approval, the attendance record status is changed to "present" (excused).
 */
router.patch("/justifications/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const schema = z.object({
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const [just] = await db.select().from(lateJustificationsTable)
      .where(eq(lateJustificationsTable.id, id)).limit(1);
    if (!just) return res.status(404).json({ error: "Justification not found" });

    const [updated] = await db.update(lateJustificationsTable).set({
      status:     body.status,
      adminNote:  body.adminNote ?? null,
      reviewedBy: req.userId,
      reviewedAt: new Date(),
    }).where(eq(lateJustificationsTable.id, id)).returning();

    if (body.status === "approved") {
      await db.update(attendanceTable)
        .set({ status: "present" })
        .where(eq(attendanceTable.id, just.attendanceId));
    }

    const [employee] = await db.select().from(usersTable)
      .where(eq(usersTable.id, just.userId)).limit(1);
    const [attRec] = await db.select().from(attendanceTable)
      .where(eq(attendanceTable.id, just.attendanceId)).limit(1);

    const statusAr = body.status === "approved" ? "موافقة" : "رفض";
    createNotification({
      type: "LATE_JUSTIFICATION",
      title: `${statusAr} تبرير التأخر — ${employee?.name ?? ""}`,
      message: body.status === "approved"
        ? `تمت الموافقة على تبرير التأخر بتاريخ ${attRec?.date ?? ""}. يُحتسب الحضور كاملاً.`
        : `تم رفض تبرير التأخر بتاريخ ${attRec?.date ?? ""}. ${body.adminNote ?? ""}`,
      relatedId: id,
      relatedType: "late_justification",
    }).catch(console.error);

    return res.json({ ...updated, reviewedAt: updated.reviewedAt?.toISOString() ?? null });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/daily-summary", requireAdmin, async (req: any, res) => {
  try {
    const today = getLocalDate();

    // ── Fetch everything needed in 3 queries instead of 2×N queries ─────────
    // 1) All employees
    const employees = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.role, "employee"));

    if (employees.length === 0) return res.json({ sent: 0 });

    const empIds = employees.map(e => e.id);

    // 2) All today's attendance records for all employees — ONE query
    const todayRecords = await db
      .select()
      .from(attendanceTable)
      .where(and(
        inArray(attendanceTable.userId, empIds),
        eq(attendanceTable.date, today),
      ));

    // Build a Map for O(1) lookup: userId → attendance record
    const attByUser = new Map(todayRecords.map(r => [r.userId, r]));

    // 3) Admin sender — fetched ONCE, outside the loop
    const adminUser = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "manager"]))
      .limit(1);

    const senderId = adminUser[0]?.id ?? (req as any).user?.userId;
    if (!senderId) return res.json({ sent: 0 });

    const statusLabel: Record<string, string> = {
      present:     "✅ حاضر",
      late:        "🟠 متأخر",
      absent:      "❌ غائب",
      on_leave:    "📅 إجازة",
      early_leave: "🟡 مغادرة مبكرة",
    };

    let sent = 0;

    // Insert all messages in sequence (no more per-employee DB roundtrips for attendance/admin)
    for (const emp of employees) {
      const att = attByUser.get(emp.id);
      let body = `📋 ملخص الحضور ليوم ${today}\n\nالموظف: ${emp.name}\n`;

      if (!att) {
        body += `الحالة: ❌ غائب\n`;
      } else {
        body += `الحالة: ${statusLabel[att.status ?? ""] ?? att.status}\n`;
        if (att.checkIn) {
          const ci = new Date(att.checkIn);
          body += `وقت الوصول: ${ci.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}\n`;
        }
        if (att.checkOut) {
          const co = new Date(att.checkOut);
          body += `وقت المغادرة: ${co.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}\n`;
        }
        if (att.hoursWorked != null) {
          body += `إجمالي ساعات العمل: ${att.hoursWorked} ساعة\n`;
        }
      }

      await db.insert(messagesTable).values({
        senderId,
        receiverId: emp.id,
        subject: `ملخص الحضور - ${today}`,
        body,
        isBroadcast: false,
      });

      sent++;
    }

    return res.json({ sent });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/**
 * POST /:id/justify-early
 * Employee submits a justification for an early_leave record.
 * Stored in the same lateJustificationsTable; approved → status becomes "present".
 */
router.post("/:id/justify-early", requireAuth, async (req: any, res) => {
  try {
    const attendanceId = parseId(req.params.id);
    const schema = z.object({ reason: z.string().min(5).max(1000) });
    const { reason } = schema.parse(req.body);

    const [rec] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.id, attendanceId), eq(attendanceTable.userId, req.userId)))
      .limit(1);
    if (!rec) return res.status(404).json({ error: "Attendance record not found" });
    if (rec.status !== "early_leave") return res.status(400).json({ error: "Justification only allowed for early_leave records" });

    // Filter by type='early_leave' to avoid collision with late check-in justifications for same record
    const [existing] = await db.select().from(lateJustificationsTable)
      .where(and(eq(lateJustificationsTable.attendanceId, attendanceId), eq(lateJustificationsTable.userId, req.userId), eq(lateJustificationsTable.type, "early_leave")))
      .limit(1);
    if (existing) return res.status(409).json({ error: "Justification already submitted", justification: existing });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);

    const [justification] = await db.insert(lateJustificationsTable).values({
      attendanceId,
      userId: req.userId,
      reason,
      type: "early_leave",
      status: "pending",
    }).returning();

    createNotification({
      type: "LATE_JUSTIFICATION",
      title: `تبرير خروج مبكر: ${user?.name ?? "موظف"}`,
      message: `${user?.name ?? "موظف"} تقدّم بتبرير للخروج المبكر بتاريخ ${rec.date}. السبب: ${reason}`,
      relatedId: justification.id,
      relatedType: "late_justification",
    }).catch(console.error);

    return res.status(201).json(justification);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /:id/overtime-decision
 * Employee decides, right after a checkout that produced overtime, whether
 * they actually forgot to check out on time (overtime is discarded) or
 * they genuinely worked extra hours and want them counted (overtime stays
 * pending admin approval). Either way the manager is notified.
 */
router.post("/:id/overtime-decision", requireAuth, async (req: any, res) => {
  try {
    const attendanceId = parseId(req.params.id);
    const schema = z.object({ choice: z.enum(["forgot", "overtime"]) });
    const { choice } = schema.parse(req.body);

    const [rec] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.id, attendanceId), eq(attendanceTable.userId, req.userId)))
      .limit(1);
    if (!rec) return res.status(404).json({ error: "Attendance record not found" });
    if (!rec.checkOut) return res.status(400).json({ error: "Record is not checked out yet" });
    if (!rec.overtime || rec.overtime <= 0) return res.status(400).json({ error: "No overtime to decide on" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);

    if (choice === "forgot") {
      await db.update(attendanceTable).set({
        overtime: 0,
        overtimeStatus: "rejected",
      }).where(eq(attendanceTable.id, attendanceId));

      createNotification({
        type: "OVERTIME_DECISION",
        title: `نسيان تسجيل خروج: ${user?.name ?? "موظف"}`,
        message: `${user?.name ?? "موظف"} أفاد أنه نسي تسجيل الخروج بتاريخ ${rec.date}. لم يتم احتساب أي وقت إضافي لهذه الفترة.`,
        relatedId: attendanceId,
        relatedType: "attendance",
      }).catch(console.error);

      return res.json({ ok: true, overtime: 0 });
    } else {
      await db.update(attendanceTable).set({
        overtimeStatus: "pending",
      }).where(eq(attendanceTable.id, attendanceId));

      createNotification({
        type: "OVERTIME_DECISION",
        title: `طلب احتساب وقت إضافي: ${user?.name ?? "موظف"}`,
        message: `${user?.name ?? "موظف"} سجل ${rec.overtime} ساعة عمل إضافي بتاريخ ${rec.date} وطلب احتسابها. بانتظار مراجعة الإدارة.`,
        relatedId: attendanceId,
        relatedType: "attendance",
      }).catch(console.error);

      return res.json({ ok: true, overtime: rec.overtime });
    }
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /:id
 * Fetch a single attendance record (with user + location info).
 * Admin can fetch any record; employee can only fetch their own.
 */
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const [record] = await db.select({
      id:                attendanceTable.id,
      userId:            attendanceTable.userId,
      userName:          usersTable.name,
      locationId:        attendanceTable.locationId,
      locationName:      locationsTable.name,
      date:              attendanceTable.date,
      checkIn:           attendanceTable.checkIn,
      checkOut:          attendanceTable.checkOut,
      hoursWorked:       attendanceTable.hoursWorked,
      overtime:          attendanceTable.overtime,
      overtimeStatus:    attendanceTable.overtimeStatus,
      status:            attendanceTable.status,
      notes:             attendanceTable.notes,
      biometricVerified: attendanceTable.biometricVerified,
      gpsLat:            attendanceTable.gpsLat,
      gpsLng:            attendanceTable.gpsLng,
      gpsAddress:        attendanceTable.gpsAddress,
      createdAt:         attendanceTable.createdAt,
    })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
      .leftJoin(locationsTable, eq(attendanceTable.locationId, locationsTable.id))
      .where(eq(attendanceTable.id, id))
      .limit(1);

    if (!record) return res.status(404).json({ error: "Record not found" });
    if (!["admin", "manager"].includes(me.role) && record.userId !== req.userId)
      return res.status(403).json({ error: "Forbidden" });

    return res.json(serializeRecord(record));
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/**
 * PATCH /:id/overtime-approve
 * Admin approves or rejects an overtime request on an attendance record.
 */
router.patch("/:id/overtime-approve", requireAdmin, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const schema = z.object({
      status: z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    });
    const { status, adminNote } = schema.parse(req.body);

    const [rec] = await db.select().from(attendanceTable).where(eq(attendanceTable.id, id)).limit(1);
    if (!rec) return res.status(404).json({ error: "Attendance record not found" });

    await db.update(attendanceTable).set({
      overtimeStatus: status,
      ...(status === "rejected" ? { overtime: 0 } : {}),
    }).where(eq(attendanceTable.id, id));

    // Notify the employee
    const [employee] = await db.select().from(usersTable).where(eq(usersTable.id, rec.userId)).limit(1);
    if (employee) {
      createNotificationForUser({
        type: "OVERTIME_DECISION",
        userId: employee.id,
        title: status === "approved"
          ? `تمت الموافقة على طلب وقتك الإضافي`
          : `تم رفض طلب وقتك الإضافي`,
        message: status === "approved"
          ? `تمت الموافقة على ${rec.overtime} ساعة وقت إضافي بتاريخ ${rec.date}.${adminNote ? ` ملاحظة: ${adminNote}` : ""}`
          : `تم رفض طلب الوقت الإضافي بتاريخ ${rec.date}.${adminNote ? ` ملاحظة: ${adminNote}` : ""}`,
        relatedId: id,
        relatedType: "attendance",
      }).catch(console.error);
    }

    const [updated] = await db.select({
      id:             attendanceTable.id,
      userId:         attendanceTable.userId,
      userName:       usersTable.name,
      date:           attendanceTable.date,
      checkIn:        attendanceTable.checkIn,
      checkOut:       attendanceTable.checkOut,
      hoursWorked:    attendanceTable.hoursWorked,
      overtime:       attendanceTable.overtime,
      overtimeStatus: attendanceTable.overtimeStatus,
      status:         attendanceTable.status,
    }).from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
      .where(eq(attendanceTable.id, id)).limit(1);

    return res.json(serializeRecord(updated as any));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/bulk", requireAdmin, async (req: any, res) => {
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }
    // inArray is already imported at the top of this file — no dynamic import needed
    await db.delete(lateJustificationsTable).where(inArray(lateJustificationsTable.attendanceId, ids));
    await db.delete(attendanceTable).where(inArray(attendanceTable.id, ids));
    return res.json({ deleted: ids.length });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const [exists] = await db.select({ id: attendanceTable.id }).from(attendanceTable).where(eq(attendanceTable.id, id)).limit(1);
    if (!exists) return res.status(404).json({ error: "Record not found" });
    await db.delete(lateJustificationsTable).where(eq(lateJustificationsTable.attendanceId, id));
    await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
    return res.status(204).send();
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

export default router;
