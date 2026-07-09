import { pgTable, serial, integer, varchar, text, real, boolean, date, timestamp } from "drizzle-orm/pg-core";
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
  status: varchar("status", { length: 30 }).notNull().default("present"),
  notes: text("notes"),
  biometricVerified: boolean("biometric_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
