import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import router from "./routes/index.js";

// NOTE: __dirname is a native CommonJS global here — the server bundle is
// built with esbuild's "cjs" format (see server/build.mjs) because several
// dependencies (express, body-parser, debug) rely on dynamic `require()`
// calls that break when bundled as ESM.
const app: Express = express();

const rawAllowed = process.env.ALLOWED_ORIGINS ?? "";
const extraOrigins = rawAllowed ? rawAllowed.split(",").map((o) => o.trim()).filter(Boolean) : [];

app.use(
  cors({
    origin: extraOrigins.length > 0 ? extraOrigins : true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204,
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

app.use("/api", router);

// Unknown API routes should 404, not fall through to the SPA index.html
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

const STATIC_DIR = path.join(__dirname, "../public");

app.use(express.static(STATIC_DIR));

app.use((_req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"), (err) => {
    if (err) {
      res.status(500).json({ error: "Could not serve frontend" });
    }
  });
});

export default app;
