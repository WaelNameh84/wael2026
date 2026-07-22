import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Add it to your Render environment variables.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hard limits so a slow/lost DB connection never hangs the server forever
  connectionTimeoutMillis: 8_000,   // fail fast if we can't get a connection
  idleTimeoutMillis:       30_000,  // release idle connections after 30 s
  max:                     20,      // cap the pool size
  statement_timeout:       15_000,  // kill any query running > 15 s
});

pool.on("error", (err) => {
  console.error("[pg pool] unexpected error on idle client:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
