import { Router } from "express";
import { db, attendanceTable, usersTable, locationsTable, leaveTable, bonusesTable, salaryAdvancesTable } from "../../../db/src/index.js";
import { eq, gte, lte, and, desc } from "drizzle-orm";
import { requireAuth } from "./auth.js";
import { getLateThresholdMinutes } from "../lib/gemini-config.js";
import { getLocalDate } from "../lib/timezone.js";
import { sendCustomReportEmail } from "../lib/mailer.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends the fully-styled report HTML (the same markup used for the in-app
 * PDF/print view) as a real email via the server's SMTP transport, instead of
 * relying on a `mailto:` link — which only ever opens the device's Mail app
 * with a stripped-down plain-text body and cannot carry any of the styling.
 */
router.post("/send-email", requireAuth, async (req: any, res) => {
  const { to, subject, html } = req.body ?? {};
  if (!to || typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    return res.status(400).json({ error: "بريد إلكتروني غير صالح" });
  }
  if (!subject || typeof subject !== "string") {
    return res.status(400).json({ error: "العنوان مطلوب" });
  }
  if (!html || typeof html !== "string" || html.length > 3_000_000) {
    return res.status(400).json({ error: "محتوى التقرير غير صالح" });
  }
  try {
    await sendCustomReportEmail(to.trim(), subject, html);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[reports/send-email] failed:", err?.message ?? err);
    res.status(500).json({ error: "فشل إرسال البريد الإلكتروني" });
  }
});

const STANDARD_HOURS_PER_DAY = 8;

/**
 * Count Mon–Fri days between two date strings (inclusive).
 * Uses UTC throughout so the count is timezone-independent and matches
 * the payroll.ts `workingDaysInRange` helper exactly.
 */
function countWorkingDays(from: string, to: string): number {
  const start = new Date(from + "T00:00:00Z");
  const end   = new Date(to   + "T00:00:00Z");
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();           // 0=Sun, 6=Sat — UTC, not local
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);  // advance by 1 UTC day
  }
  return count;
}

router.get("/attendance", requireAuth, async (req: any, res) => {
  try {
    const { from, to, userId } = req.query as any;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });

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
      .where(
        ["admin","manager"].includes(me.role) && !userId
          ? and(gte(attendanceTable.date, from), lte(attendanceTable.date, to))
          : and(eq(attendanceTable.userId, targetUserId), gte(attendanceTable.date, from), lte(attendanceTable.date, to))
      )
      .orderBy(desc(attendanceTable.date));

    const leaveRecords = await db.select({
      id: leaveTable.id,
      userId: leaveTable.userId,
      userName: usersTable.name,
      type: leaveTable.type,
      startDate: leaveTable.startDate,
      endDate: leaveTable.endDate,
      totalDays: leaveTable.totalDays,
      reason: leaveTable.reason,
      status: leaveTable.status,
    })
      .from(leaveTable)
      .leftJoin(usersTable, eq(leaveTable.userId, usersTable.id))
      .where(
        ["admin","manager"].includes(me.role) && !userId
          ? and(gte(leaveTable.startDate, from), lte(leaveTable.startDate, to), eq(leaveTable.status, "approved"))
          : and(eq(leaveTable.userId, targetUserId), gte(leaveTable.startDate, from), lte(leaveTable.startDate, to), eq(leaveTable.status, "approved"))
      );

    // Group records by (userId, date) for 8-hour cap per day.
    // Fall back to computing hours from checkIn/checkOut when hoursWorked is null/0
    const dayGroups = new Map<string, number>();
    for (const r of records) {
      const key = `${r.userId}::${r.date}`;
      let hrs = r.hoursWorked;
      if ((hrs == null || hrs === 0) && r.checkIn && r.checkOut) {
        const ci = r.checkIn instanceof Date ? r.checkIn : new Date(r.checkIn as any);
        const co = r.checkOut instanceof Date ? r.checkOut : new Date(r.checkOut as any);
        hrs = Math.max(0, (co.getTime() - ci.getTime()) / (1000 * 60 * 60));
      }
      dayGroups.set(key, (dayGroups.get(key) ?? 0) + (hrs || 0));
    }

    let totalHours = 0;
    let normalHours = 0;
    let overtimeHours = 0;
    for (const dayHours of dayGroups.values()) {
      totalHours    += dayHours;
      normalHours   += Math.min(dayHours, STANDARD_HOURS_PER_DAY);
      overtimeHours += Math.max(0, dayHours - STANDARD_HOURS_PER_DAY);
    }
    totalHours    = Math.round(totalHours    * 100) / 100;
    normalHours   = Math.round(normalHours   * 100) / 100;
    overtimeHours = Math.round(overtimeHours * 100) / 100;

    const uniqueDays = new Map<string, string>();
    for (const r of records) {
      const key = `${r.userId}::${r.date}`;
      uniqueDays.set(key, r.status);
    }
    const dayStatuses = [...uniqueDays.values()];
    const presentDays = dayStatuses.filter(s => s === "present" || s === "late" || s === "early_leave").length;
    const absentDays  = dayStatuses.filter(s => s === "absent").length;
    const leaveDays   = dayStatuses.filter(s => s === "on_leave").length
                      + leaveRecords.reduce((s, l) => s + l.totalDays, 0);
    const lateDays    = dayStatuses.filter(s => s === "late").length;

    const workingDays    = countWorkingDays(from, to);
    const expectedHours  = workingDays * STANDARD_HOURS_PER_DAY;

    // Build attendance rows with lateMinutes
    const attendanceRows = records.map(r => {
      let lateMinutes = 0;
      if (r.status === "late" && r.checkIn) {
        const ci = r.checkIn instanceof Date ? r.checkIn : new Date(r.checkIn);
        const ciMin = ci.getUTCHours() * 60 + ci.getUTCMinutes();
        lateMinutes = Math.max(0, ciMin - getLateThresholdMinutes());
      }
      // Compute effective hours: use hoursWorked if set, otherwise derive from timestamps
      let effectiveHours = r.hoursWorked;
      if ((effectiveHours == null || effectiveHours === 0) && r.checkIn && r.checkOut) {
        const ci2 = r.checkIn instanceof Date ? r.checkIn : new Date(r.checkIn as any);
        const co2 = r.checkOut instanceof Date ? r.checkOut : new Date(r.checkOut as any);
        effectiveHours = Math.max(0, (co2.getTime() - ci2.getTime()) / (1000 * 60 * 60));
      }
      const normalH   = Math.min(effectiveHours || 0, STANDARD_HOURS_PER_DAY);
      const overtimeH = Math.max(0, (effectiveHours || 0) - STANDARD_HOURS_PER_DAY);
      return {
        ...r,
        isLeave: false,
        checkIn:   r.checkIn?.toISOString() ?? null,
        checkOut:  r.checkOut?.toISOString() ?? null,
        createdAt: r.createdAt?.toISOString() ?? null,
        normalHours: normalH,
        overtimeCalc: overtimeH,
        lateMinutes,
        leaveType: null,
        leaveReason: null,
        leaveStartDate: null,
        leaveEndDate: null,
        leaveTotalDays: null,
      };
    });

    // Build leave rows
    const leaveRows = leaveRecords.map(l => ({
      id: l.id,
      isLeave: true,
      userId: l.userId,
      userName: l.userName ?? "",
      locationId: null,
      locationName: null,
      date: l.startDate,
      checkIn: null,
      checkOut: null,
      hoursWorked: 0,
      overtime: 0,
      normalHours: 0,
      overtimeCalc: 0,
      lateMinutes: 0,
      status: "on_leave",
      notes: null,
      biometricVerified: false,
      createdAt: null,
      leaveType: l.type,
      leaveReason: l.reason ?? "",
      leaveStartDate: l.startDate,
      leaveEndDate: l.endDate,
      leaveTotalDays: l.totalDays,
    }));

    // Merge and sort by date descending
    const allRows = [...attendanceRows, ...leaveRows]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return res.json({
      from,
      to,
      records: allRows,
      summary: {
        totalDays: workingDays,
        totalHours:    Math.round(totalHours    * 100) / 100,
        normalHours:   Math.round(normalHours   * 100) / 100,
        overtime:      Math.round(overtimeHours * 100) / 100,
        presentDays,
        absentDays,
        leaveDays,
        lateDays,
        workingDays,
        expectedHours,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/dashboard", requireAuth, async (req: any, res) => {
  try {
    // Accept clientDate from frontend (local YYYY-MM-DD) to avoid UTC vs local-timezone mismatch.
    // Falls back to UTC date if not provided.
    const today: string = (typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
      ? req.query.date
      : getLocalDate();

    const now = new Date();
    const firstOfMonth = today.slice(0, 7) + "-01";

    const allUsers = await db.select().from(usersTable);
    const todayRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));
    const monthRecords = await db.select().from(attendanceTable)
      .where(and(gte(attendanceTable.date, firstOfMonth), lte(attendanceTable.date, today)));

    const pendingLeaves = await db.select().from(leaveTable).where(eq(leaveTable.status, "pending"));

    const recentActivity = await db.select({
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
      .orderBy(desc(attendanceTable.createdAt))
      .limit(10);

    const present = todayRecords.filter(r => r.status === "present" || r.status === "late").length;
    const onLeave = todayRecords.filter(r => r.status === "on_leave").length;
    const late = todayRecords.filter(r => r.status === "late").length;
    const totalHoursMonth = monthRecords.reduce((s, r) => s + (r.hoursWorked || 0), 0);

    return res.json({
      totalEmployees: allUsers.length,
      presentToday: present,
      absentToday: allUsers.length - present - onLeave,
      onLeaveToday: onLeave,
      lateToday: late,
      pendingLeaves: pendingLeaves.length,
      totalHoursThisMonth: Math.round(totalHoursMonth * 100) / 100,
      avgAttendanceRate: allUsers.length > 0 ? Math.round((present / allUsers.length) * 100) : 0,
      recentActivity: recentActivity.map(r => ({
        ...r,
        checkIn:   r.checkIn?.toISOString(),
        checkOut:  r.checkOut?.toISOString() ?? null,
        createdAt: r.createdAt?.toISOString(),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── Bonuses & Advances report ─────────────────────────────── */

router.get("/bonuses", requireAuth, async (req: any, res) => {
  try {
    const { userId, period } = req.query as any;
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);

    const allBonuses = await db.select({
      id: bonusesTable.id,
      userId: bonusesTable.userId,
      userName: usersTable.name,
      type: bonusesTable.type,
      amount: bonusesTable.amount,
      reason: bonusesTable.reason,
      period: bonusesTable.period,
      createdAt: bonusesTable.createdAt,
    }).from(bonusesTable)
      .leftJoin(usersTable, eq(bonusesTable.userId, usersTable.id))
      .orderBy(desc(bonusesTable.createdAt));

    let bonusResult = allBonuses;
    if (!["admin", "manager"].includes(me.role)) {
      bonusResult = bonusResult.filter(b => b.userId === req.userId);
    } else if (userId) {
      bonusResult = bonusResult.filter(b => b.userId === parseInt(userId));
    }
    if (period) bonusResult = bonusResult.filter(b => b.period === period);

    const allAdvances = await db.select({
      id: salaryAdvancesTable.id,
      userId: salaryAdvancesTable.userId,
      userName: usersTable.name,
      amount: salaryAdvancesTable.amount,
      reason: salaryAdvancesTable.reason,
      status: salaryAdvancesTable.status,
      adminNote: salaryAdvancesTable.adminNote,
      deductedPeriod: salaryAdvancesTable.deductedPeriod,
      reviewedAt: salaryAdvancesTable.reviewedAt,
      createdAt: salaryAdvancesTable.createdAt,
    }).from(salaryAdvancesTable)
      .leftJoin(usersTable, eq(salaryAdvancesTable.userId, usersTable.id))
      .orderBy(desc(salaryAdvancesTable.createdAt));

    let advanceResult = allAdvances;
    if (!["admin", "manager"].includes(me.role)) {
      advanceResult = advanceResult.filter(a => a.userId === req.userId);
    } else if (userId) {
      advanceResult = advanceResult.filter(a => a.userId === parseInt(userId));
    }
    if (period) advanceResult = advanceResult.filter(a => a.deductedPeriod === period);

    return res.json({
      bonuses: bonusResult.map(b => ({
        ...b,
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
      })),
      advances: advanceResult.map(a => ({
        ...a,
        reviewedAt: a.reviewedAt instanceof Date ? a.reviewedAt.toISOString() : a.reviewedAt,
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
