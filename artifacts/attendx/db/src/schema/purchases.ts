import { pgTable, serial, integer, varchar, real, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Employee purchase records (clothes / equipment / other) with an invoice/receipt
 * photo. Automatically included as a salary addition for the matching period,
 * grouped under the category label the employee entered.
 */
export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  /** "clothes" | "equipment" | "other" */
  category: varchar("category", { length: 20 }).notNull(),
  /** Display label added to the salary breakdown — the category name, or the
   *  free-text description the employee wrote when category = "other". */
  itemLabel: varchar("item_label", { length: 255 }).notNull(),
  /** Optional extra description/notes about the purchased item. */
  description: text("description"),
  amount: real("amount").notNull(),
  receiptUrl: text("receipt_url"),
  /** YYYY-MM — the payroll period this purchase is added to. */
  period: varchar("period", { length: 7 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Purchase = typeof purchasesTable.$inferSelect;
