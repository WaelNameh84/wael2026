import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const attendanceCorrectionsTable = pgTable("attendance_corrections", {
  id:                serial("id").primaryKey(),
  userId:            integer("user_id").notNull().references(() => usersTable.id),
  attendanceId:      integer("attendance_id"), // nullable — might not exist yet
  date:              varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  requestedCheckIn:  varchar("requested_check_in", { length: 5 }),  // HH:MM
  requestedCheckOut: varchar("requested_check_out", { length: 5 }), // HH:MM
  reason:            text("reason").notNull(),
  status:            varchar("status", { length: 20 }).notNull().default("pending"),
  adminNote:         text("admin_note"),
  reviewedBy:        integer("reviewed_by").references(() => usersTable.id),
  reviewedAt:        timestamp("reviewed_at"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
});

export type AttendanceCorrection = typeof attendanceCorrectionsTable.$inferSelect;
