import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores uploaded image binary data directly in PostgreSQL.
 * Avoids disk-file ephemerality on platforms like Render.
 * Images are served via GET /api/images/:id with proper caching headers.
 */
export const imageStoreTable = pgTable("image_store", {
  id:        serial("id").primaryKey(),
  data:      text("data").notNull(),           // raw base64 (no data: prefix)
  mimeType:  varchar("mime_type", { length: 50 }).notNull().default("image/jpeg"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ImageStore = typeof imageStoreTable.$inferSelect;
