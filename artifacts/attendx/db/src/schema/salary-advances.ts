import { pgTable, serial, integer, real, text, varchar, timestamp, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const salaryAdvancesTable = pgTable("salary_advances", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: real("amount").notNull(),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  /** YYYY-MM of the first (or only) monthly deduction installment */
  deductedPeriod: varchar("deducted_period", { length: 7 }),
  /** How many equal installments to split the advance into (default 1) */
  installments: integer("installments").notNull().default(1),
  /** 'month' (default) or 'day' */
  deductionUnit: varchar("deduction_unit", { length: 10 }).notNull().default("month"),
  /** Start date for daily-based deductions (YYYY-MM-DD) */
  deductionStartDate: date("deduction_start_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SalaryAdvance = typeof salaryAdvancesTable.$inferSelect;
