import { pgTable, serial, integer, varchar, real, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const bonusesTable = pgTable("bonuses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: varchar("type", { length: 20 }).notNull().default("bonus"),
  amount: real("amount").notNull(),
  reason: text("reason"),
  period: varchar("period", { length: 7 }),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Bonus = typeof bonusesTable.$inferSelect;
