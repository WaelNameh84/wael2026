import { pgTable, serial, text, varchar, real, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("employee"),
  department: varchar("department", { length: 255 }),
  position: varchar("position", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  avatarUrl: text("avatar_url"),
  workHoursPerDay: real("work_hours_per_day").notNull().default(8),
  salary: real("salary"),
  /** "monthly" = salary is a monthly figure; "daily" = salary is a per-day rate */
  contractType: varchar("contract_type", { length: 20 }).notNull().default("monthly"),
  /** Monthly allowances added on top of earned salary */
  transportAllowance: real("transport_allowance").notNull().default(0),
  housingAllowance: real("housing_allowance").notNull().default(0),
  /** Employee date of birth — used for birthday reminders. */
  birthDate: date("birth_date"),
  /** Contract expiry date — used for contract-expiry reminders. */
  contractEndDate: date("contract_end_date"),
  /** Per-employee shift start time (HH:MM). Overrides global setting when set. */
  workStartTime: varchar("work_start_time", { length: 5 }),
  /** Per-employee shift end time (HH:MM). Used for overtime & early-leave detection. */
  workEndTime: varchar("work_end_time", { length: 5 }),
  /** Break duration in minutes for this employee (overrides global setting for daily-contract employees). */
  breakMinutes: real("break_minutes").notNull().default(0),
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
