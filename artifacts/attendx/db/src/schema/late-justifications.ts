import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { attendanceTable } from "./attendance";

export const lateJustificationsTable = pgTable("late_justifications", {
  id:           serial("id").primaryKey(),
  attendanceId: integer("attendance_id").notNull().references(() => attendanceTable.id),
  userId:       integer("user_id").notNull().references(() => usersTable.id),
  reason:       text("reason").notNull(),
  /** 'late' = late check-in justification, 'early_leave' = early departure justification */
  type:         varchar("type", { length: 20 }).notNull().default("late"),
  status:       varchar("status", { length: 20 }).notNull().default("pending"),
  adminNote:    text("admin_note"),
  reviewedBy:   integer("reviewed_by").references(() => usersTable.id),
  reviewedAt:   timestamp("reviewed_at"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export type LateJustification = typeof lateJustificationsTable.$inferSelect;
