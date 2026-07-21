import { pgTable, serial, integer, varchar, text, timestamp, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const requestsTable = pgTable("requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: varchar("type", { length: 30 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  hours: real("hours"),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Request = typeof requestsTable.$inferSelect;
