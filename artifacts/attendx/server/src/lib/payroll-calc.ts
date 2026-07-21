import { db, usersTable, attendanceTable, leaveTable, payrollReportsTable, bonusesTable, requestsTable, salaryAdvancesTable, purchasesTable } from "../../../db/src/index.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { getLateThresholdMinutes, getLateGraceMinutes, getWorkStartTime, getBreakMinutes } from "./gemini-config.js";
import { getLocalMinutesFromMidnight } from "./timezone.js";

/*
 * Shared payroll calculation engine.
 *
 * Extracted from the POST /api/payroll/calculate route handler so the exact
 * same math can be reused by the automatic month-end payroll dispatch
 * (server/src/lib/auto-payroll.ts) without duplicating ~400 lines of
 * business logic that would inevitably drift out of sync.
 */

/** Count Mon–Fri days in a given month (or custom date range). */
function workingDaysInRange(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay(); // 0=Sun 6=Sat
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** Late minutes above the configured threshold.
 * @param threshold  Minutes-from-midnight of the late cutoff. Defaults to global setting.
 */
function lateMinutesFor(checkIn: Date, threshold?: number): number {
  const totalMin = checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes();
  return Math.max(0, totalMin - (threshold ?? getLateThresholdMinutes()));
}

/** Round to 2 decimals. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export class PayrollCalcError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function calculatePayrollForPeriod(
  userId: number,
  opts: { period?: string; dateFrom?: string; dateTo?: string }
) {
  const { period, dateFrom, dateTo } = opts;

  /* Resolve date range --------------------------------------------------- */
  let periodStart: Date;
  let periodEnd:   Date;
  let effectivePeriod: string;   // YYYY-MM used for bonus / advance matching

  if (dateFrom && dateTo) {
    periodStart     = new Date(dateFrom + "T00:00:00Z");
    periodEnd       = new Date(dateTo   + "T23:59:59Z");
    effectivePeriod = dateFrom.slice(0, 7);           // derive YYYY-MM from start
  } else if (period) {
    const [year, month] = period.split("-").map(Number);
    periodStart     = new Date(Date.UTC(year, month - 1, 1));
    periodEnd       = new Date(Date.UTC(year, month, 0));
    effectivePeriod = period;
  } else {
    throw new PayrollCalcError("Provide either 'period' (YYYY-MM) or both 'dateFrom' and 'dateTo' (YYYY-MM-DD)");
  }

  const resolvedPeriod = effectivePeriod;

  /* 1. Employee info */
  const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!emp) throw new PayrollCalcError("Employee not found", 404);

  const baseSalary  = emp.salary ?? 0;
  const contractType = (emp as any).contractType ?? "monthly";

  /* Derive effective paid hours per day.
   * If the employee has a custom shift window (workStartTime + workEndTime),
   * compute it automatically: (end - start) - break.
   * Otherwise fall back to the stored workHoursPerDay field. */
  const _ws = (emp as any).workStartTime as string | null | undefined;
  const _we = (emp as any).workEndTime   as string | null | undefined;
  const _validTime = (t: string | null | undefined): t is string =>
    !!t && /^\d{2}:\d{2}$/.test(t);

  /* standardHoursPerDay = the stored field; used ONLY for rate calculation.
   * workHoursPerDay     = actual paid hours per shift; used for attendance caps,
   *                       overtime threshold, and leave-hour counts.
   * For a daily employee whose stored rate is 1,000 kr/day (8h standard) but
   * has a custom 6h shift: hourlyRate = 1000÷8 = 125, pay/day = 125×6 = 750. */
  const standardHoursPerDay: number = emp.workHoursPerDay ?? 8;

  /* Per-employee break minutes: use employee-level value if > 0, else global. */
  const empBreakMins: number = (() => {
    const v = (emp as any).breakMinutes;
    return (typeof v === "number" && v > 0) ? v : getBreakMinutes();
  })();

  const workHoursPerDay: number = (() => {
    if (_validTime(_ws) && _validTime(_we)) {
      const [shh, smm] = _ws.split(":").map(Number);
      const [ehh, emm] = _we.split(":").map(Number);
      const mins = (ehh * 60 + emm) - (shh * 60 + smm) - empBreakMins;
      return Math.max(0, mins / 60);
    }
    return standardHoursPerDay;
  })();
  const transportAllowance = r2((emp as any).transportAllowance ?? 0);
  const housingAllowance   = r2((emp as any).housingAllowance   ?? 0);

  /* 2. Working days & rates
   *
   *  Monthly contract: daily = salary ÷ calendarDaysInMonth  (30 or 31)
   *    Standard payroll convention: the monthly salary covers every calendar
   *    day in the month, so the daily rate is salary / calendar days.
   *    Example: 25,000 ÷ 31 (July) = 806.45/day.
   *
   *  Daily   contract: daily = salary  (salary IS the per-day rate)
   *
   *  workingDaysInMonth (Mon–Fri) is still tracked for attendance KPIs
   *  (expected days, absent count) but is NOT used to derive the rate.
   *
   *  Then: hourly = daily ÷ workHoursPerDay
   *        minute = hourly ÷ 60
   *        second = minute ÷ 60
   */
  const workingDaysInMonth = workingDaysInRange(periodStart, periodEnd);
  const totalExpectedHours = workingDaysInMonth * workHoursPerDay;

  // Daily rate divisor = working days (Mon–Fri) in the FULL calendar month,
  // regardless of whether a partial date range was requested.
  // e.g. July 2026 has 23 working days → 25,000 ÷ 23 = 1,086.96/day always.
  const calYear          = periodStart.getUTCFullYear();
  const calMonth         = periodStart.getUTCMonth() + 1; // 1-based
  const fullMonthStart   = new Date(Date.UTC(calYear, calMonth - 1, 1));
  const fullMonthEnd     = new Date(Date.UTC(calYear, calMonth,     0));
  const fullMonthWorkingDays = workingDaysInRange(fullMonthStart, fullMonthEnd);

  const dailyRate  = contractType === "daily"
    ? baseSalary
    : (fullMonthWorkingDays > 0 ? baseSalary / fullMonthWorkingDays : 0);
  /* Hourly rate always divides by the STANDARD hours so a shorter custom shift
   * doesn't inflate the hourly rate. Example: 1,000 kr ÷ 8h = 125 kr/h. */
  const hourlyRate = standardHoursPerDay > 0 ? dailyRate / standardHoursPerDay : 0;
  const minuteRate = hourlyRate / 60;
  const secondRate = minuteRate / 60;

  /* 3. Attendance records */
  const startStr = periodStart.toISOString().slice(0, 10);
  const endStr   = periodEnd.toISOString().slice(0, 10);

  const attRecords = await db.select().from(attendanceTable)
    .where(and(
      eq(attendanceTable.userId, userId),
      gte(attendanceTable.date, startStr),
      lte(attendanceTable.date, endStr),
    ));

  const dateMap = new Map<string, typeof attRecords>();
  for (const rec of attRecords) {
    if (!dateMap.has(rec.date)) dateMap.set(rec.date, []);
    dateMap.get(rec.date)!.push(rec);
  }

  const WORKED_STATUSES = new Set(["present", "late", "early_leave"]);
  const daysPresent      = [...dateMap.values()].filter(
    recs => recs.some(r => WORKED_STATUSES.has(r.status))
  ).length;

  let totalNormalHours   = 0;
  let totalOvertimeHours = 0;
  let totalLateMinutes   = 0;

  /* Per-employee shift window (falls back to global settings). */
  const empStartStr  = _validTime(_ws) ? _ws : getWorkStartTime();
  const [shiftHH, shiftMM] = empStartStr.split(":").map(Number);
  const shiftStartMins = shiftHH * 60 + shiftMM;
  const breakMins      = empBreakMins;
  const shiftEndMins   = _validTime(_we)
    ? (() => { const [eh, em] = _we.split(":").map(Number); return eh * 60 + em; })()
    : shiftStartMins + workHoursPerDay * 60 + breakMins;

  /* Per-employee late threshold (shift start + grace period). */
  const empLateThreshold = shiftStartMins + getLateGraceMinutes();

  for (const [, dayRecs] of dateMap) {
    const isWorkedDay = dayRecs.some(r => WORKED_STATUSES.has(r.status));

    let dayNormalHours   = 0;
    let dayOvertimeHours = 0;

    for (const rec of dayRecs) {
      if (rec.checkIn && rec.checkOut) {
        const inMins          = getLocalMinutesFromMidnight(new Date(rec.checkIn as unknown as string));
        const outMins         = getLocalMinutesFromMidnight(new Date(rec.checkOut as unknown as string));
        const effectiveInMins = Math.max(inMins, shiftStartMins);
        const rawWorkedMins   = Math.max(0, outMins - effectiveInMins);
        const paidMins        = Math.max(0, rawWorkedMins - breakMins);
        const normalMins      = Math.min(paidMins, workHoursPerDay * 60);
        const overtimeMins    = Math.max(0, outMins - shiftEndMins);
        dayNormalHours   += normalMins   / 60;
        dayOvertimeHours += overtimeMins / 60;
      } else {
        dayNormalHours += rec.hoursWorked || 0;
      }
    }

    if (isWorkedDay) {
      const hasActualHours = dayNormalHours + dayOvertimeHours > 0;
      totalNormalHours   += hasActualHours ? Math.min(dayNormalHours, workHoursPerDay) : workHoursPerDay;
      totalOvertimeHours += hasActualHours ? dayOvertimeHours : 0;
    }

    const firstRec = dayRecs[0];
    if (firstRec.status === "late" && firstRec.checkIn) {
      totalLateMinutes += lateMinutesFor(new Date(firstRec.checkIn), empLateThreshold);
    }
  }

  /* 4. Leave records overlapping the period */
  const leaveRecords = await db.select().from(leaveTable)
    .where(and(
      eq(leaveTable.userId, userId),
      eq(leaveTable.status, "approved"),
      lte(leaveTable.startDate, endStr),
      gte(leaveTable.endDate, startStr),
    ));

  let paidLeaveDays   = 0;
  let unpaidLeaveDays = 0;

  const leaveCoveredDates = new Set<string>();

  for (const lv of leaveRecords) {
    const lvStart = new Date(Math.max(
      new Date(lv.startDate + "T12:00:00Z").getTime(), periodStart.getTime()
    ));
    const lvEnd   = new Date(Math.min(
      new Date(lv.endDate   + "T12:00:00Z").getTime(), periodEnd.getTime()
    ));

    const cur = new Date(lvStart);
    while (cur <= lvEnd) {
      const dow  = cur.getUTCDay();
      const dateStr = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !leaveCoveredDates.has(dateStr)) {
        leaveCoveredDates.add(dateStr);
        const isUnpaid = lv.isPaid === false || (lv.isPaid === null && lv.type === "unpaid");
        if (isUnpaid) unpaidLeaveDays++;
        else paidLeaveDays++;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const extraOnLeaveDays = [...dateMap.entries()].filter(([date, recs]) => {
    if (leaveCoveredDates.has(date)) return false;
    const dow = new Date(date + "T12:00:00Z").getUTCDay();
    if (dow === 0 || dow === 6) return false;
    return recs.some(r => r.status === "on_leave") &&
           !recs.some(r => WORKED_STATUSES.has(r.status));
  }).length;

  const daysAbsent = Math.max(
    0,
    workingDaysInMonth - daysPresent - paidLeaveDays - unpaidLeaveDays - extraOnLeaveDays
  );

  const paidLeaveHours   = paidLeaveDays * workHoursPerDay;
  const totalPaidHours   = r2(totalNormalHours + paidLeaveHours);

  const fullDaysWorked  = Math.floor(totalNormalHours / workHoursPerDay);
  const remainingHours  = totalNormalHours % workHoursPerDay;
  /* For daily contracts with a custom shorter shift, a "full day" earns
   * workHoursPerDay × hourlyRate (not the raw dailyRate).
   * Example: 6h × 125 kr/h = 750 kr/day  (not 1,000 kr).
   * For monthly contracts dailyRate is already salary÷workingDays, so use it directly. */
  const effectiveDayEarning = contractType === "daily"
    ? r2(workHoursPerDay * hourlyRate)
    : dailyRate;
  const fullDaysEarned  = r2(fullDaysWorked * effectiveDayEarning + paidLeaveHours * hourlyRate);

  const remHoursPart   = Math.floor(remainingHours);
  const remMinutesFloat = (remainingHours - remHoursPart) * 60;
  const remMinutesPart = Math.floor(remMinutesFloat);
  const remSecondsPart = Math.round((remMinutesFloat - remMinutesPart) * 60);
  const partialHoursEarned = r2(
    remHoursPart * hourlyRate + remMinutesPart * minuteRate + remSecondsPart * secondRate
  );

  const overtimeBonus        = r2(totalOvertimeHours * hourlyRate * 1.0);
  const latePenalty          = r2((totalLateMinutes / 60) * hourlyRate);
  const unpaidLeaveDeduction = r2(unpaidLeaveDays * workHoursPerDay * hourlyRate);

  const overtimeRequests = await db.select().from(requestsTable)
    .where(and(
      eq(requestsTable.userId, userId),
      eq(requestsTable.type, "overtime"),
      eq(requestsTable.status, "approved"),
      gte(requestsTable.date, startStr),
      lte(requestsTable.date, endStr),
    ));

  let approvedOvertimeHours = 0;
  for (const req of overtimeRequests) {
    if (!dateMap.has(req.date) && req.hours && req.hours > 0) {
      approvedOvertimeHours += req.hours;
    }
  }
  totalOvertimeHours = r2(totalOvertimeHours + approvedOvertimeHours);

  const bonusRows = await db.select().from(bonusesTable)
    .where(and(eq(bonusesTable.userId, userId), eq(bonusesTable.period, resolvedPeriod)));
  const adminBonusTotal     = r2(bonusRows.filter(b => b.type === "bonus").reduce((s, b) => s + b.amount, 0));
  const adminDeductionTotal = r2(bonusRows.filter(b => b.type === "deduction").reduce((s, b) => s + b.amount, 0));

  // Fetch all approved advances that have a start period, then filter to those
  // that have an installment falling on resolvedPeriod.
  const allAdvanceRows = await db.select().from(salaryAdvancesTable)
    .where(and(
      eq(salaryAdvancesTable.userId, userId),
      eq(salaryAdvancesTable.status, "approved"),
    ));

  /** Convert "YYYY-MM" → total months since year 0 */
  const periodToMonths = (p: string) => {
    const [y, m] = p.split("-").map(Number);
    return y * 12 + m;
  };
  const currentMonths = periodToMonths(resolvedPeriod);

  const advanceRows = allAdvanceRows.filter(a => {
    if (!a.deductedPeriod) return false;
    const startMonths  = periodToMonths(a.deductedPeriod);
    const installments = a.installments ?? 1;
    const diff = currentMonths - startMonths;
    return diff >= 0 && diff < installments;
  });

  const advanceDeductionTotal = r2(
    advanceRows.reduce((s, a) => s + (a.amount / (a.installments ?? 1)), 0)
  );

  const purchaseRows = await db.select().from(purchasesTable)
    .where(and(eq(purchasesTable.userId, userId), eq(purchasesTable.period, resolvedPeriod)));
  const purchasesTotal = r2(purchaseRows.reduce((s, p) => s + p.amount, 0));

  const baseEarned      = r2(fullDaysEarned + partialHoursEarned);
  const totalAllowances = r2(transportAllowance + housingAllowance);
  const totalDeductions = r2(latePenalty + unpaidLeaveDeduction + adminDeductionTotal + advanceDeductionTotal);
  const totalAdditions  = r2(overtimeBonus + adminBonusTotal + totalAllowances + purchasesTotal);
  const netSalary       = r2(baseEarned + totalAdditions - totalDeductions);

  return {
    employeeId:   emp.id,
    employeeName: emp.name,
    employeeEmail: emp.email,
    department:   emp.department,
    period:       resolvedPeriod,
    dateFrom:     startStr,
    dateTo:       endStr,
    periodStart:  startStr,
    periodEnd:    endStr,
    baseSalary,
    contractType,
    dailyRate:  r2(dailyRate),
    hourlyRate: r2(hourlyRate),
    minuteRate: Math.round(minuteRate * 1000) / 1000,
    secondRate: Math.round(secondRate * 10000) / 10000,
    remainingTimeBreakdown: { hours: remHoursPart, minutes: remMinutesPart, seconds: remSecondsPart },
    workHoursPerDay,
    workingDaysInMonth,
    totalExpectedHours,
    daysPresent,
    daysAbsent,
    paidLeaveDays,
    unpaidLeaveDays,
    totalNormalHours:   r2(totalNormalHours),
    totalOvertimeHours: r2(totalOvertimeHours),
    paidLeaveHours,
    totalPaidHours,
    fullDaysWorked,
    remainingHours,
    fullDaysEarned,
    partialHoursEarned,
    totalLateMinutes,
    baseEarned,
    overtimeBonus,
    latePenalty,
    unpaidLeaveDeduction,
    adminBonusTotal,
    adminDeductionTotal,
    advanceDeductionTotal,
    approvedOvertimeHours,
    transportAllowance,
    housingAllowance,
    totalAllowances,
    purchasesTotal,
    totalDeductions,
    totalAdditions,
    netSalary,
    bonusItems: [
      ...bonusRows.map(b => ({
        id: b.id,
        type: b.type,
        amount: b.amount,
        reason: b.reason,
        period: b.period,
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
        source: "bonus" as const,
      })),
      ...advanceRows.map(a => {
        const installments   = a.installments ?? 1;
        const installmentAmt = r2(a.amount / installments);
        const installmentNum = a.deductedPeriod
          ? currentMonths - periodToMonths(a.deductedPeriod) + 1
          : 1;
        const installmentLabel = installments > 1
          ? ` (دفعة ${installmentNum} من ${installments})`
          : "";
        return {
          id: a.id,
          type: "deduction" as const,
          amount: installmentAmt,
          reason: `سلفة معتمدة${installmentLabel}${a.reason ? ` — ${a.reason}` : ""}`,
          period: resolvedPeriod,
          createdAt: a.reviewedAt instanceof Date ? a.reviewedAt.toISOString() : (a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt),
          source: "advance" as const,
        };
      }),
      ...overtimeRequests.filter(req => !dateMap.has(req.date) && req.hours && req.hours > 0).map(req => ({
        id: req.id,
        type: "bonus" as const,
        amount: r2((req.hours ?? 0) * hourlyRate),
        reason: `إضافي معتمد — ${req.date}${req.hours ? ` (${req.hours} ساعة)` : ""}`,
        period: resolvedPeriod,
        createdAt: req.reviewedAt instanceof Date ? req.reviewedAt.toISOString() : (req.createdAt instanceof Date ? req.createdAt.toISOString() : req.createdAt),
        source: "overtime_request" as const,
      })),
      ...purchaseRows.map(p => ({
        id: p.id,
        type: "bonus" as const,
        amount: p.amount,
        reason: `${p.itemLabel}${p.description ? ` — ${p.description}` : ""}`,
        period: p.period,
        receiptUrl: p.receiptUrl,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
        source: "purchase" as const,
      })),
    ],
    attendanceRecords: (() => {
      return [...dateMap.entries()].map(([date, dayRecs]) => {
        const dayHours   = dayRecs.reduce((s, r) => s + (r.hoursWorked || 0), 0);
        const dayOT      = r2(Math.max(0, dayHours - workHoursPerDay));
        const firstRec   = dayRecs[0];
        const lateMinutes = firstRec.status === "late" && firstRec.checkIn
          ? lateMinutesFor(new Date(firstRec.checkIn), empLateThreshold) : 0;
        return {
          date,
          status:       firstRec.status,
          hoursWorked:  r2(dayHours),
          overtime:     dayOT,
          sessions:     dayRecs.length,
          lateMinutes,
          checkIn:      firstRec.checkIn  ? new Date(firstRec.checkIn).toISOString()  : null,
          checkOut:     dayRecs.at(-1)?.checkOut ? new Date(dayRecs.at(-1)!.checkOut!).toISOString() : null,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
    })(),
    leaveRecords: leaveRecords.map(l => ({
      type:      l.type,
      startDate: l.startDate,
      endDate:   l.endDate,
      totalDays: l.totalDays,
    })),
  };
}

/** True if a payroll report already exists for this employee + period (manual or automatic). */
export async function payrollReportExists(userId: number, period: string): Promise<boolean> {
  const rows = await db.select({ id: payrollReportsTable.id }).from(payrollReportsTable)
    .where(and(eq(payrollReportsTable.userId, userId), eq(payrollReportsTable.period, period)))
    .limit(1);
  return rows.length > 0;
}
