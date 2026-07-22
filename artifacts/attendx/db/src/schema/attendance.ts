import { pgTable, serial, integer, varchar, text, real, boolean, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { locationsTable } from "./locations";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  locationId: integer("location_id").references(() => locationsTable.id),
  date: date("date").notNull(),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out"),
  hoursWorked: real("hours_worked"),
  overtime: real("overtime"),
  /** "pending" | "approved" | "rejected" — overtime hours only count toward payroll once approved. */
  overtimeStatus: varchar("overtime_status", { length: 20 }).notNull().default("pending"),
  status: varchar("status", { length: 30 }).notNull().default("present"),
  notes: text("notes"),
  biometricVerified: boolean("biometric_verified").notNull().default(false),
  gpsLat: real("gps_lat"),
  gpsLng: real("gps_lng"),
  gpsAddress: text("gps_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("attendance_user_id_idx").on(table.userId),
  index("attendance_date_idx").on(table.date),
  index("attendance_user_date_idx").on(table.userId, table.date),
]);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
