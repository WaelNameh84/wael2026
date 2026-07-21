import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const announcementsTable = pgTable("announcements", {
  id:               serial("id").primaryKey(),
  title:            varchar("title", { length: 255 }).notNull(),
  body:             text("body").notNull(),
  targetDepartment: varchar("target_department", { length: 255 }), // null = all departments
  priority:         varchar("priority", { length: 20 }).notNull().default("normal"), // normal | urgent
  createdBy:        integer("created_by").references(() => usersTable.id),
  expiresAt:        timestamp("expires_at"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
