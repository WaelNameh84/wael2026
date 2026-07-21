import { db, usersTable, payrollReportsTable } from "../../../db/src/index.js";
import { eq } from "drizzle-orm";
import { calculatePayrollForPeriod, payrollReportExists } from "./payroll-calc.js";
import { sendPayrollReportToEmployee } from "./mailer.js";
import { createNotification } from "./notify.js";

/*
 * Month-end safety net: if the manager forgets to generate/send an
 * employee's payroll report, the system generates and emails it
 * automatically a few days into the new month.
 *
 * Idempotency: a payroll_reports row for (userId, period) — whether created
 * manually by an admin or by this job — is the single source of truth for
 * "already sent". This function is safe to call repeatedly (every server
 * tick / restart); it only ever acts on employees still missing a report.
 */

function appUrl(): string {
  return process.env.REPLIT_APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? process.env.APP_URL ?? "http://localhost:10000";
}

/** "YYYY-MM" for the calendar month before `date`. */
function previousMonthPeriod(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-based; previous month is m-1
  const prev = new Date(Date.UTC(y, m - 1, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Only run the check during the first week of the month — the previous
// month is always fully finished by then, and it gives the manager a short
// grace window to send reports manually before the system steps in.
const GRACE_WINDOW_DAY_OF_MONTH = 7;

export async function runAutoPayrollDispatch(now: Date = new Date()) {
  if (now.getUTCDate() > GRACE_WINDOW_DAY_OF_MONTH) return;

  const period = previousMonthPeriod(now);

  try {
    const employees = await db.select().from(usersTable).where(eq(usersTable.isApproved, true));

    for (const emp of employees) {
      if (!emp.salary || emp.salary <= 0) continue; // nothing meaningful to report
      if (await payrollReportExists(emp.id, period)) continue; // already sent (manually or automatically)

      try {
        const result = await calculatePayrollForPeriod(emp.id, { period });

        // FIX #2: Save all detail fields (allowances, bonus/deduction breakdown, baseEarned)
        // so saved auto-payroll reports have full granularity, not just totals.
        const [saved] = await db.insert(payrollReportsTable).values({
          userId:               emp.id,
          employeeName:         emp.name,
          period:               result.period,
          periodStart:          result.periodStart,
          periodEnd:            result.periodEnd,
          baseSalary:           result.baseSalary,
          dailyRate:            result.dailyRate,
          hourlyRate:           result.hourlyRate,
          workingDaysInMonth:   result.workingDaysInMonth,
          daysPresent:          result.daysPresent,
          daysAbsent:           result.daysAbsent,
          paidLeaveDays:        result.paidLeaveDays,
          unpaidLeaveDays:      result.unpaidLeaveDays,
          totalNormalHours:     result.totalNormalHours,
          totalOvertimeHours:   result.totalOvertimeHours,
          totalLateMinutes:     result.totalLateMinutes,
          baseEarned:           result.baseEarned,
          overtimeBonus:        result.overtimeBonus,
          latePenalty:          result.latePenalty,
          unpaidLeaveDeduction: result.unpaidLeaveDeduction,
          adminBonusTotal:      result.adminBonusTotal,
          adminDeductionTotal:  result.adminDeductionTotal,
          advanceDeductionTotal: result.advanceDeductionTotal,
          transportAllowance:   result.transportAllowance,
          housingAllowance:     result.housingAllowance,
          totalDeductions:      result.totalDeductions,
          totalAdditions:       result.totalAdditions,
          netSalary:            result.netSalary,
          notes:                "تم الإنشاء والإرسال تلقائياً — لم يُرسل المدير كشف الراتب لهذا الشهر.",
          generatedBy:          null,
        }).returning();

        if (emp.email) {
          await sendPayrollReportToEmployee(
            { name: emp.name, email: emp.email },
            {
              period: result.period,
              baseSalary: result.baseSalary,
              overtimeBonus: result.overtimeBonus,
              totalDeductions: result.totalDeductions,
              netSalary: result.netSalary,
              daysPresent: result.daysPresent,
              daysAbsent: result.daysAbsent,
              totalOvertimeHours: result.totalOvertimeHours,
            },
            appUrl()
          );
        }

        // Keep the manager in the loop via the existing Action Center feed.
        await createNotification({
          type: "PAYROLL_AUTO_SENT",
          title: "تم إرسال كشف راتب تلقائياً",
          message: `لم يتم إرسال كشف راتب ${emp.name} عن شهر ${period} يدوياً، فقام النظام بإنشائه وإرساله تلقائياً بالبريد الإلكتروني. صافي الراتب: ${result.netSalary.toFixed(2)}.`,
          relatedId: saved.id,
          relatedType: "payroll_report",
        });

        console.log(`✅  Auto-sent payroll report for ${emp.name} (${period})`);
      } catch (err) {
        console.error(`⚠️  Auto-payroll failed for user ${emp.id} (${period}):`, err);
        // Continue with the next employee — one failure shouldn't block the rest.
      }
    }
  } catch (err) {
    console.error("⚠️  Auto-payroll dispatch failed:", err);
  }
}
