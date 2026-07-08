import { pgTable, serial, integer, varchar, real, text, date, timestamp } from "drizzle-orm/pg-core";
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
  baseSalary: real("base_salary").notNull(),
  dailyRate: real("daily_rate").notNull(),
  hourlyRate: real("hourly_rate").notNull(),
  workingDaysInMonth: integer("working_days_in_month").notNull(),
  daysPresent: integer("days_present").notNull(),
  daysAbsent: integer("days_absent").notNull(),
  paidLeaveDays: integer("paid_leave_days").notNull().default(0),
  unpaidLeaveDays: integer("unpaid_leave_days").notNull().default(0),
  totalOvertimeHours: real("total_overtime_hours").notNull().default(0),
  totalLateMinutes: integer("total_late_minutes").notNull().default(0),
  overtimeBonus: real("overtime_bonus").notNull().default(0),
  latePenalty: real("late_penalty").notNull().default(0),
  unpaidLeaveDeduction: real("unpaid_leave_deduction").notNull().default(0),
  totalDeductions: real("total_deductions").notNull().default(0),
  totalAdditions: real("total_additions").notNull().default(0),
  netSalary: real("net_salary").notNull(),
  notes: text("notes"),
  generatedBy: integer("generated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPayrollReportSchema = createInsertSchema(payrollReportsTable).omit({ id: true, createdAt: true });
export type InsertPayrollReport = z.infer<typeof insertPayrollReportSchema>;
export type PayrollReport = typeof payrollReportsTable.$inferSelect;
