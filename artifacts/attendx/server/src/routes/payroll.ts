import { Router } from "express";
import { db, usersTable, payrollReportsTable } from "../../../db/src/index.js";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { calculatePayrollForPeriod, PayrollCalcError } from "../lib/payroll-calc.js";

function httpStatus(err: any): number {
  if (err?.name === "ZodError") return 400;
  if (err?.code === "23505")    return 409;
  if (err?.code === "23503")    return 400;
  return 500;
}
import { runMonthEndReportDispatch, sendMonthlyReportManual } from "../lib/auto-reports.js";

const router = Router();

/* ─── Calculate (preview, no save) ──────────────────────── */

const calculateSchema = z.object({
  userId:     z.coerce.number().int().positive(),
  // Legacy: full-month shorthand "YYYY-MM"
  period:     z.string().regex(/^\d{4}-\d{2}$/).optional(),
  // Custom date range "YYYY-MM-DD"
  dateFrom:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(d => d.period || (d.dateFrom && d.dateTo), {
  message: "Provide either 'period' (YYYY-MM) or both 'dateFrom' and 'dateTo' (YYYY-MM-DD)",
});

router.post("/calculate", requireAuth, async (req: any, res) => {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });

  const { userId, period, dateFrom, dateTo } = parsed.data;

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!["admin", "manager"].includes(me.role) && me.id !== userId) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const result = await calculatePayrollForPeriod(userId, { period, dateFrom, dateTo });
    return res.json(result);
  } catch (err: any) {
    if (err instanceof PayrollCalcError) return res.status(err.status).json({ error: err.message });
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/* ─── Save report (server recalculates — never trusts client numbers) ─── */

// FIX #1: Accept only identifiers + optional notes.
// The server recalculates the payroll fresh and saves the authoritative result.
const saveSchema = z.object({
  userId:   z.number().int().positive(),
  period:   z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:    z.string().optional(),
}).refine(d => d.period || (d.dateFrom && d.dateTo), {
  message: "Provide either 'period' (YYYY-MM) or both 'dateFrom' and 'dateTo' (YYYY-MM-DD)",
});

router.post("/save", requireAuth, requireAdmin, async (req: any, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });

  const { userId, period, dateFrom, dateTo, notes } = parsed.data;

  try {
    // Recalculate on the server — never use numbers from the request body
    const result = await calculatePayrollForPeriod(userId, { period, dateFrom, dateTo });

    const [report] = await db.insert(payrollReportsTable).values({
      userId:               result.employeeId,
      employeeName:         result.employeeName,
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
      notes:                notes ?? null,
      generatedBy:          req.userId,
    }).returning();

    return res.json(report);
  } catch (err: any) {
    if (err instanceof PayrollCalcError) return res.status(err.status).json({ error: err.message });
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/* ─── List saved reports ─────────────────────────────────── */

// FIX #3: DB-level filtering instead of loading all rows into memory
router.get("/reports", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId, period } = req.query as { userId?: string; period?: string };

    const conditions = [];
    if (userId) conditions.push(eq(payrollReportsTable.userId, parseInt(userId)));
    if (period) conditions.push(eq(payrollReportsTable.period, period));

    const rows = await db.select({
      id:              payrollReportsTable.id,
      userId:          payrollReportsTable.userId,
      employeeName:    payrollReportsTable.employeeName,
      period:          payrollReportsTable.period,
      baseSalary:      payrollReportsTable.baseSalary,
      netSalary:       payrollReportsTable.netSalary,
      totalDeductions: payrollReportsTable.totalDeductions,
      totalAdditions:  payrollReportsTable.totalAdditions,
      daysPresent:     payrollReportsTable.daysPresent,
      daysAbsent:      payrollReportsTable.daysAbsent,
      createdAt:       payrollReportsTable.createdAt,
    })
    .from(payrollReportsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payrollReportsTable.createdAt));

    return res.json(rows.map(r => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })));
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/* ─── Get single report ──────────────────────────────────── */

router.get("/reports/:id", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [report] = await db.select().from(payrollReportsTable).where(eq(payrollReportsTable.id, id)).limit(1);
    if (!report) return res.status(404).json({ error: "Report not found" });
    return res.json({ ...report, createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/* ─── Send monthly reports (manual trigger — any day, any employee) ──── */

router.post("/send-monthly", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { period, userId } = req.body as { period?: string; userId?: number };

    // Resolve period: default to current month
    let resolvedPeriod: string;
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      resolvedPeriod = period;
    } else {
      const now = new Date();
      resolvedPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    const result = await sendMonthlyReportManual(
      resolvedPeriod,
      userId ? Number(userId) : undefined
    );

    if (result.sent === 0 && result.errors.length === 0) {
      return res.status(400).json({
        error: result.skipped > 0
          ? "لا يوجد بريد إلكتروني مسجّل للموظف المحدد"
          : "لم يتم إرسال أي تقرير — تحقق من إعدادات البريد الإلكتروني",
      });
    }

    if (result.errors.length > 0 && result.sent === 0) {
      const firstErr = result.errors[0] ?? "";
      const isResendDomain = firstErr.toLowerCase().includes("verify a domain") ||
        firstErr.toLowerCase().includes("testing emails to your own");
      if (isResendDomain) {
        return res.status(400).json({ error: "RESEND_DOMAIN_UNVERIFIED" });
      }
      return res.status(500).json({ error: firstErr });
    }

    return res.json({ ok: true, period: resolvedPeriod, sent: result.sent, errors: result.errors });
  } catch (err: any) {
    if (err.message === "NO_EMAIL_PROVIDER") {
      return res.status(400).json({
        error: "لم يتم إعداد أي مزود بريد إلكتروني — اذهب إلى الإعدادات وأضف Resend أو Gmail SMTP",
      });
    }
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

/* ─── Delete report ──────────────────────────────────────── */

router.delete("/reports/:id", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(payrollReportsTable).where(eq(payrollReportsTable.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

export default router;
