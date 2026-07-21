import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

/**
 * Official holidays / occasions. Any working day (Mon–Fri) that falls on a
 * holiday date is treated as a fully paid day in payroll — the employee is
 * neither marked absent nor deducted, even without an attendance record.
 */
export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  /** YYYY-MM-DD */
  date: varchar("date", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Holiday = typeof holidaysTable.$inferSelect;
