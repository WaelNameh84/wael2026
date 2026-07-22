import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { readFileSync } from "fs";
import router from "./routes/index.js";
import { getAppName } from "./lib/gemini-config.js";
import { SERVER_START_TIME } from "./lib/server-version.js";

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

// ── Security Headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");          // يمنع MIME-type sniffing
  res.setHeader("X-Frame-Options", "DENY");                    // يمنع تضمين الصفحة في iframe خارجي
  res.setHeader("X-XSS-Protection", "1; mode=block");         // حماية XSS في المتصفحات القديمة
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +  // Vite SPA تحتاج unsafe-inline
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com; " +
    "connect-src 'self' https://generativelanguage.googleapis.com https://api.resend.com https://api.brevo.com; " +
    "frame-ancestors 'none';"
  );
  next();
});

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

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

const noCacheHeaders = (res: import("express").Response) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
};

// index.html and manifest.json embed the app's display name. Rather than
// baking a name into these static files at build time, render them per
// request so a name change made in Settings (persisted via getAppName/
// saveAppName in gemini-config.ts) shows up immediately — including the
// PWA home-screen label — without needing a rebuild.
//
// Performance: cache the rendered output in memory and only re-render when
// the app name changes. readFileSync on every request blocks the event loop
// and causes measurable latency under load.
const _templateCache = new Map<string, { appName: string; rendered: string }>();

function renderTemplate(fileName: string): string {
  const currentName = getAppName();
  const cached = _templateCache.get(fileName);
  if (cached && cached.appName === currentName) return cached.rendered;
  const raw = readFileSync(path.join(STATIC_DIR, fileName), "utf8");
  const rendered = raw.replaceAll("{{APP_NAME}}", currentName);
  _templateCache.set(fileName, { appName: currentName, rendered });
  return rendered;
}

// Serve sw.js dynamically so __BUILD_TIME__ is always the current server
// start time. Every server restart (= deploy / code change) generates a new
// value → the browser detects a changed sw.js → installs a fresh SW →
// clears the old caches → all PWA clients reload automatically.
app.get("/sw.js", (_req, res) => {
  noCacheHeaders(res);
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  try {
    const raw = readFileSync(path.join(STATIC_DIR, "sw.js"), "utf8");
    res.send(raw.replace("__BUILD_TIME__", SERVER_START_TIME).replaceAll("{{APP_NAME}}", getAppName()));
  } catch {
    res.status(404).send("// sw.js not found");
  }
});

app.get("/manifest.json", (_req, res) => {
  noCacheHeaders(res);
  res.setHeader("Content-Type", "application/manifest+json");
  res.send(renderTemplate("manifest.json"));
});

app.get(["/", "/index.html"], (_req, res) => {
  noCacheHeaders(res);
  res.setHeader("Content-Type", "text/html");
  res.send(renderTemplate("index.html"));
});

app.use(express.static(STATIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("index.html")) {
      noCacheHeaders(res);
    }
  },
}));

app.use((_req, res) => {
  noCacheHeaders(res);
  res.setHeader("Content-Type", "text/html");
  try {
    res.send(renderTemplate("index.html"));
  } catch {
    res.status(500).json({ error: "Could not serve frontend" });
  }
});

export default app;
