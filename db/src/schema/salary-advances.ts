import { pgTable, serial, integer, real, text, varchar, timestamp } from "drizzle-orm/pg-core";
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
  deductedPeriod: varchar("deducted_period", { length: 7 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SalaryAdvance = typeof salaryAdvancesTable.$inferSelect;
