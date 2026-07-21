import { db, usersTable, attendanceTable } from "../../../db/src/index.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { sendMonthlyReportToEmployee, type PayrollDetail } from "./mailer.js";
import { calculatePayrollForPeriod } from "./payroll-calc.js";
import { createNotification } from "./notify.js";
import { getLateThresholdMinutes } from "./gemini-config.js";
import { getLocalMinutesFromMidnight } from "./timezone.js";

/*
 * End-of-month report dispatcher.
 *
 * Fires automatically on the LAST DAY of every calendar month.
 * Sends each approved employee a full monthly report covering:
 *   • Attendance summary (days present/absent, late arrivals, overtime hours)
 *   • Payroll estimate (base salary, deductions, net salary)
 *
 * Idempotency: a Set of already-sent "YYYY-MM:userId" keys is kept per
 * server process — so multiple ticks on the same day never double-send.
 * The set is cleared on the first tick of any new day.
 */

function appUrl(): string {
  return (
    process.env.REPLIT_APP_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    process.env.APP_URL ??
    "http://localhost:10000"
  );
}

/** Returns true when `date` is the last calendar day of its month. */
function isLastDayOfMonth(date: Date): boolean {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return next.getUTCDate() === 1;
}

/** "YYYY-MM" for the month of `date`. */
function currentMonthPeriod(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Arabic month names */
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${ARABIC_MONTHS[m - 1]} ${y}`;
}

/** Count Mon–Fri days in a month. */
function workingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// ── In-process dedup: tracks which reports were sent in this server run ──────
const sentKeys = new Set<string>();
let lastTickDay = -1;

export async function runMonthEndReportDispatch(now: Date = new Date()) {
  // Clear dedup set at the start of each new UTC day so the key never stales.
  const todayDay = now.getUTCDate();
  if (todayDay !== lastTickDay) {
    sentKeys.clear();
    lastTickDay = todayDay;
  }

  // Only run on the last day of the month.
  if (!isLastDayOfMonth(now)) return;

  const period = currentMonthPeriod(now);

  console.log(`📅  Month-end report dispatch running for period ${period}…`);

  try {
    const employees = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.isApproved, true));

    for (const emp of employees) {
      const key = `${period}:${emp.id}`;
      if (sentKeys.has(key)) continue; // already sent this run

      if (!emp.email) continue; // no email address — skip silently

      try {
        // ── Attendance data for this month ───────────────────────────────────
        const [year, month] = period.split("-").map(Number);
        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate   = new Date(Date.UTC(year, month, 0));
        const startStr  = startDate.toISOString().slice(0, 10);
        const endStr    = endDate.toISOString().slice(0, 10);

        const records = await db
          .select()
          .from(attendanceTable)
          .where(
            and(
              eq(attendanceTable.userId, emp.id),
              gte(attendanceTable.date, startStr),
              lte(attendanceTable.date, endStr)
            )
          );

        const lateThreshold = getLateThresholdMinutes();
        let daysPresent      = 0;
        let lateArrivals     = 0;
        let totalOvertime    = 0;
        let totalHoursWorked = 0;

        for (const rec of records) {
          if (rec.status === "absent") continue;
          daysPresent++;
          totalOvertime    += rec.overtime    ?? 0;
          totalHoursWorked += rec.hoursWorked ?? 0;

          if (rec.checkIn) {
            const checkInMin = getLocalMinutesFromMidnight(rec.checkIn);
            if (checkInMin > lateThreshold) lateArrivals++;
          }
        }

        const workingDaysInMonth = workingDaysInRange(startDate, endDate);
        let daysAbsent           = Math.max(0, workingDaysInMonth - daysPresent);

        // ── Payroll estimate ─────────────────────────────────────────────────
        let baseSalary      = emp.salary ?? 0;
        let overtimeBonus   = 0;
        let totalDeductions = 0;
        let netSalary       = baseSalary;
        let payrollDetail: PayrollDetail | undefined;

        try {
          const payroll   = await calculatePayrollForPeriod(emp.id, { period });
          baseSalary      = payroll.baseSalary;
          overtimeBonus   = payroll.overtimeBonus;
          totalDeductions = payroll.totalDeductions;
          netSalary       = payroll.netSalary;
          payrollDetail   = {
            baseSalary:            payroll.baseSalary,
            baseEarned:            payroll.baseEarned,
            dailyRate:             payroll.dailyRate,
            hourlyRate:            payroll.hourlyRate,
            contractType:          payroll.contractType,
            workingDaysInMonth:    payroll.workingDaysInMonth,
            daysPresent:           payroll.daysPresent,
            daysAbsent:            payroll.daysAbsent,
            paidLeaveDays:         payroll.paidLeaveDays,
            unpaidLeaveDays:       payroll.unpaidLeaveDays,
            totalLateMinutes:      payroll.totalLateMinutes,
            totalOvertimeHours:    payroll.totalOvertimeHours,
            overtimeBonus:         payroll.overtimeBonus,
            latePenalty:           payroll.latePenalty,
            unpaidLeaveDeduction:  payroll.unpaidLeaveDeduction,
            adminBonusTotal:       payroll.adminBonusTotal,
            adminDeductionTotal:   payroll.adminDeductionTotal,
            advanceDeductionTotal: payroll.advanceDeductionTotal,
            transportAllowance:    payroll.transportAllowance,
            housingAllowance:      payroll.housingAllowance,
            totalAllowances:       payroll.totalAllowances,
            purchasesTotal:        payroll.purchasesTotal,
            totalDeductions:       payroll.totalDeductions,
            totalAdditions:        payroll.totalAdditions,
            netSalary:             payroll.netSalary,
            bonusItems:            payroll.bonusItems,
          };
          // Use payroll's accurate counts
          daysPresent      = payroll.daysPresent;
          daysAbsent       = payroll.daysAbsent;
          totalOvertime    = payroll.totalOvertimeHours;
          totalHoursWorked = payroll.totalNormalHours;
        } catch {
          // fall back to manual counts + no detailed payroll
        }

        // ── Send the email ───────────────────────────────────────────────────
        const attRecordsForEmail = records
          .filter(r => r.status !== "absent")
          .map(r => ({
            date:        r.date,
            status:      r.status,
            checkIn:     r.checkIn  ? new Date(r.checkIn as any).toISOString()  : null,
            checkOut:    r.checkOut ? new Date(r.checkOut as any).toISOString() : null,
            hoursWorked: r.hoursWorked ?? 0,
            overtime:    r.overtime    ?? 0,
            lateMinutes: (() => {
              if (r.status === "late" && r.checkIn) {
                const ci = r.checkIn instanceof Date ? r.checkIn : new Date(r.checkIn as string);
                return Math.max(0, getLocalMinutesFromMidnight(ci) - lateThreshold);
              }
              return 0;
            })(),
          }))
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        await sendMonthlyReportToEmployee(
          { name: emp.name, email: emp.email },
          {
            period,
            periodLabel: periodLabel(period),
            daysPresent,
            daysAbsent,
            lateArrivals,
            totalOvertimeHours: totalOvertime,
            totalHoursWorked,
            workingDaysInMonth,
            baseSalary,
            overtimeBonus,
            totalDeductions,
            netSalary,
          },
          appUrl(),
          attRecordsForEmail,
          payrollDetail
        );

        sentKeys.add(key);

        // Notify admin via Action Center
        await createNotification({
          type: "MONTHLY_REPORT_SENT",
          title: "تم إرسال التقرير الشهري",
          message: `تم إرسال التقرير الشهري لـ ${emp.name} عن شهر ${periodLabel(period)} بالبريد الإلكتروني تلقائياً.`,
          relatedId: emp.id,
          relatedType: "user",
        });

        console.log(`✅  Monthly report sent → ${emp.name} (${period})`);
      } catch (err) {
        console.error(`⚠️  Monthly report failed for user ${emp.id} (${period}):`, err);
      }
    }
  } catch (err) {
    console.error("⚠️  Month-end report dispatch error:", err);
  }
}

/**
 * Manual send: dispatches monthly reports for a specific period.
 * Unlike runMonthEndReportDispatch, this:
 *   - Does NOT check isLastDayOfMonth (manual trigger can run any day)
 *   - Does NOT use sentKeys dedup (manual sends always go through)
 *   - Accepts optional userId to target one employee or all
 *   - Throws if no email provider is configured
 */
export async function sendMonthlyReportManual(
  period: string,
  userId?: number
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { isResendConfigured, getSmtpConfig, isBrevoConfigured } = await import("./gemini-config.js");

  // Check email provider up-front so caller gets a clear error
  const resendReady = isResendConfigured();
  const brevoReady  = isBrevoConfigured();
  const smtpCfg     = getSmtpConfig();
  const smtpReady   = !!(smtpCfg.host && smtpCfg.user && smtpCfg.pass);
  if (!brevoReady && !resendReady && !smtpReady) {
    throw new Error("NO_EMAIL_PROVIDER");
  }

  const [year, month] = period.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate   = new Date(Date.UTC(year, month, 0));
  const startStr  = startDate.toISOString().slice(0, 10);
  const endStr    = endDate.toISOString().slice(0, 10);

  // Fetch target employees
  let employees: any[];
  if (userId) {
    employees = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  } else {
    employees = await db.select().from(usersTable).where(eq(usersTable.isApproved, true));
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const emp of employees) {
    if (!emp.email) { skipped++; continue; }

    try {
      const records = await db
        .select()
        .from(attendanceTable)
        .where(and(
          eq(attendanceTable.userId, emp.id),
          gte(attendanceTable.date, startStr),
          lte(attendanceTable.date, endStr)
        ));

      const lateThreshold = getLateThresholdMinutes();
      let daysPresent = 0, lateArrivals = 0, totalOvertime = 0, totalHoursWorked = 0;

      for (const rec of records) {
        if (rec.status === "absent") continue;
        daysPresent++;
        totalOvertime    += rec.overtime    ?? 0;
        totalHoursWorked += rec.hoursWorked ?? 0;
        if (rec.checkIn) {
          const checkInMin = getLocalMinutesFromMidnight(rec.checkIn);
          if (checkInMin > lateThreshold) lateArrivals++;
        }
      }

      const workingDaysInMonth = workingDaysInRange(startDate, endDate);
      let daysAbsent = Math.max(0, workingDaysInMonth - daysPresent);

      let baseSalary      = emp.salary ?? 0;
      let overtimeBonus   = 0;
      let totalDeductions = 0;
      let netSalary       = baseSalary;
      let payrollDetail2: PayrollDetail | undefined;

      try {
        const payroll   = await calculatePayrollForPeriod(emp.id, { period });
        baseSalary      = payroll.baseSalary;
        overtimeBonus   = payroll.overtimeBonus;
        totalDeductions = payroll.totalDeductions;
        netSalary       = payroll.netSalary;
        payrollDetail2  = {
          baseSalary:            payroll.baseSalary,
          baseEarned:            payroll.baseEarned,
          dailyRate:             payroll.dailyRate,
          hourlyRate:            payroll.hourlyRate,
          contractType:          payroll.contractType,
          workingDaysInMonth:    payroll.workingDaysInMonth,
          daysPresent:           payroll.daysPresent,
          daysAbsent:            payroll.daysAbsent,
          paidLeaveDays:         payroll.paidLeaveDays,
          unpaidLeaveDays:       payroll.unpaidLeaveDays,
          totalLateMinutes:      payroll.totalLateMinutes,
          totalOvertimeHours:    payroll.totalOvertimeHours,
          overtimeBonus:         payroll.overtimeBonus,
          latePenalty:           payroll.latePenalty,
          unpaidLeaveDeduction:  payroll.unpaidLeaveDeduction,
          adminBonusTotal:       payroll.adminBonusTotal,
          adminDeductionTotal:   payroll.adminDeductionTotal,
          advanceDeductionTotal: payroll.advanceDeductionTotal,
          transportAllowance:    payroll.transportAllowance,
          housingAllowance:      payroll.housingAllowance,
          totalAllowances:       payroll.totalAllowances,
          purchasesTotal:        payroll.purchasesTotal,
          totalDeductions:       payroll.totalDeductions,
          totalAdditions:        payroll.totalAdditions,
          netSalary:             payroll.netSalary,
          bonusItems:            payroll.bonusItems,
        };
        // Prefer payroll engine's accurate counts
        daysPresent      = payroll.daysPresent;
        daysAbsent       = payroll.daysAbsent;
        totalOvertime    = payroll.totalOvertimeHours;
        totalHoursWorked = payroll.totalNormalHours;
      } catch { /* fall back to manual counts */ }

      const attRecordsForEmail2 = records
        .filter(r => r.status !== "absent")
        .map(r => ({
          date:        r.date,
          status:      r.status,
          checkIn:     r.checkIn  ? new Date(r.checkIn as any).toISOString()  : null,
          checkOut:    r.checkOut ? new Date(r.checkOut as any).toISOString() : null,
          hoursWorked: r.hoursWorked ?? 0,
          overtime:    r.overtime    ?? 0,
          lateMinutes: (() => {
            if (r.status === "late" && r.checkIn) {
              const ci = r.checkIn instanceof Date ? r.checkIn : new Date(r.checkIn as string);
              return Math.max(0, getLocalMinutesFromMidnight(ci) - lateThreshold);
            }
            return 0;
          })(),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      await sendMonthlyReportToEmployee(
        { name: emp.name, email: emp.email },
        { period, periodLabel: periodLabel(period), daysPresent, daysAbsent, lateArrivals,
          totalOvertimeHours: totalOvertime, totalHoursWorked, workingDaysInMonth,
          baseSalary, overtimeBonus, totalDeductions, netSalary },
        appUrl(),
        attRecordsForEmail2,
        payrollDetail2
      );

      await createNotification({
        type: "MONTHLY_REPORT_SENT",
        title: "تم إرسال التقرير الشهري",
        message: `تم إرسال التقرير الشهري لـ ${emp.name} عن شهر ${periodLabel(period)} يدوياً.`,
        relatedId: emp.id,
        relatedType: "user",
      });

      console.log(`✅  Manual monthly report sent → ${emp.name} (${period})`);
      sent++;
    } catch (err: any) {
      console.error(`⚠️  Manual monthly report failed for user ${emp.id}:`, err);
      errors.push(`${emp.name}: ${err.message ?? err}`);
    }
  }

  return { sent, skipped, errors };
}

/**
 * Starts the daily scheduler.
 * Runs once an hour and triggers the month-end dispatch when conditions are met.
 * Using 1-hour intervals keeps resource use low while still catching the last
 * day of month within ±1 hour regardless of when the server started.
 */
export function startMonthEndReportScheduler(): ReturnType<typeof setInterval> {
  const INTERVAL = 60 * 60 * 1000; // 1 hour

  // Run once at startup (catches a missed last-day if server restarted).
  runMonthEndReportDispatch().catch(err =>
    console.error("⚠️  Startup month-end check failed:", err)
  );

  const handle = setInterval(() => {
    runMonthEndReportDispatch().catch(err =>
      console.error("⚠️  Scheduled month-end check failed:", err)
    );
  }, INTERVAL);

  console.log("📅  Month-end report scheduler started (checks every hour).");
  return handle;
}
