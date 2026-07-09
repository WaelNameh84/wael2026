import { pgTable, integer, varchar, text, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const userSettingsTable = pgTable("user_settings", {
  userId: integer("user_id").notNull().references(() => usersTable.id).primaryKey(),
  theme: varchar("theme", { length: 20 }).notNull().default("system"),
  fontSize: varchar("font_size", { length: 20 }).notNull().default("medium"),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  aiKey: text("ai_key").default(null),
});

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable);
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;
