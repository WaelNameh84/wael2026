import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(__dirname, "dist/index.cjs"),
  sourcemap: true,
  external: [
    "pg-native",
    "better-sqlite3",
    "mysql2",
    "@electric-sql/pglite",
    "bun:sqlite",
    "pino",
    "pino-http",
    "pino-pretty",
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
});

console.log("✅ Server built → server/dist/index.cjs");
