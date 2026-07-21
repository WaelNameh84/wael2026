import { pgTable, serial, integer, varchar, doublePrecision, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const payrollReportsTable = pgTable("payroll_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  employeeName: varchar("employee_name", { length: 255 }).notNull(),
  period: varchar("period", { length: 7 }).notNull(),   // "YYYY-MM"
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  baseSalary: doublePrecision("base_salary").notNull(),
  dailyRate: doublePrecision("daily_rate").notNull(),
  hourlyRate: doublePrecision("hourly_rate").notNull(),
  workingDaysInMonth: integer("working_days_in_month").notNull(),
  daysPresent: integer("days_present").notNull(),
  daysAbsent: integer("days_absent").notNull(),
  paidLeaveDays: integer("paid_leave_days").notNull().default(0),
  unpaidLeaveDays: integer("unpaid_leave_days").notNull().default(0),
  totalNormalHours: doublePrecision("total_normal_hours").notNull().default(0),
  totalOvertimeHours: doublePrecision("total_overtime_hours").notNull().default(0),
  totalLateMinutes: integer("total_late_minutes").notNull().default(0),
  baseEarned: doublePrecision("base_earned").notNull().default(0),
  overtimeBonus: doublePrecision("overtime_bonus").notNull().default(0),
  latePenalty: doublePrecision("late_penalty").notNull().default(0),
  unpaidLeaveDeduction: doublePrecision("unpaid_leave_deduction").notNull().default(0),
  adminBonusTotal: doublePrecision("admin_bonus_total").notNull().default(0),
  adminDeductionTotal: doublePrecision("admin_deduction_total").notNull().default(0),
  advanceDeductionTotal: doublePrecision("advance_deduction_total").notNull().default(0),
  transportAllowance: doublePrecision("transport_allowance").notNull().default(0),
  housingAllowance: doublePrecision("housing_allowance").notNull().default(0),
  totalDeductions: doublePrecision("total_deductions").notNull().default(0),
  totalAdditions: doublePrecision("total_additions").notNull().default(0),
  netSalary: doublePrecision("net_salary").notNull(),
  notes: text("notes"),
  generatedBy: integer("generated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPayrollReportSchema = createInsertSchema(payrollReportsTable).omit({ id: true, createdAt: true });
export type InsertPayrollReport = z.infer<typeof insertPayrollReportSchema>;
export type PayrollReport = typeof payrollReportsTable.$inferSelect;
