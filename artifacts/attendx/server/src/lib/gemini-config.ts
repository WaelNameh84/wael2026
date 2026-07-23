import { readFileSync, existsSync } from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db, appConfigTable } from "../../../db/src/index.js";

// Legacy local-disk config file. Historically ALL app settings (name, logo,
// work-hour rules, AI key) were read/written here — but a fresh deploy gets
// a fresh filesystem, so anything saved here was wiped on every redeploy.
// It's now only used as a one-time seed source the first time the DB-backed
// `app_config` row is empty, so settings saved before this fix aren't lost.
const LEGACY_CONFIG_PATH = path.resolve(process.cwd(), "gemini-config.json");

interface GeminiConfig {
  apiKey?: string;
  appName?: string;
  appLogo?: string;
  workStartTime?: string;
  lateGraceMinutes?: number;
  breakMinutes?: number;
  appTimezone?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  resendApiKey?: string;
  resendFrom?: string;
  brevoApiKey?: string;
  brevoFrom?: string;
  // Cloudinary
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  // VAPID Web Push
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidEmail?: string;
  // Access control
  managerApiAccess?: boolean;
  // GPS
  gpsEnabled?: boolean;
  gpsRadius?: number;
  // Logo display settings
  logoWidth?: number;
  logoHeight?: number;
  logoRotation?: number;
  logoOffsetX?: number;
  logoOffsetY?: number;
  logoBgEnabled?: boolean;
  logoBgColor?: string;
  logoBgOpacity?: number;
  logoBgRadius?: number;
  // Global UI settings — all client appearance/behaviour as a JSON blob.
  // Stored here so every device that opens the app loads the admin's config.
  uiSettings?: string;
}

function readLegacyFile(): GeminiConfig {
  try {
    if (!existsSync(LEGACY_CONFIG_PATH)) return {};
    return JSON.parse(readFileSync(LEGACY_CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

// In-memory cache backing all the synchronous getters below. Populated from
// the database at startup (see initConfigCache) and kept in sync on every
// save. Reads stay synchronous/instant; writes persist to the DB in the
// background so config changes survive rebuilds/redeploys.
let cache: GeminiConfig = {};

export async function initConfigCache(): Promise<void> {
  try {
    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.id, 1)).limit(1);
    const hasAnyDbValue = row && (
      row.appName || row.appLogo || row.workStartTime ||
      row.lateGraceMinutes != null || row.breakMinutes != null ||
      row.appTimezone || row.geminiApiKey ||
      // Email provider fields — must be included or email config is lost on restart
      row.smtpHost || row.smtpUser || row.smtpPass ||
      (row as any).resendApiKey ||
      (row as any).brevoApiKey
    );

    if (hasAnyDbValue) {
      cache = {
        apiKey: row.geminiApiKey ?? undefined,
        appName: row.appName ?? undefined,
        appLogo: row.appLogo ?? undefined,
        workStartTime: row.workStartTime ?? undefined,
        lateGraceMinutes: row.lateGraceMinutes ?? undefined,
        breakMinutes: row.breakMinutes ?? undefined,
        appTimezone: row.appTimezone ?? undefined,
        smtpHost: row.smtpHost ?? undefined,
        smtpPort: row.smtpPort ?? undefined,
        smtpUser: row.smtpUser ?? undefined,
        smtpPass: row.smtpPass ?? undefined,
        smtpFrom: row.smtpFrom ?? undefined,
        resendApiKey: (row as any).resendApiKey ?? undefined,
        resendFrom: (row as any).resendFrom ?? undefined,
        brevoApiKey: (row as any).brevoApiKey ?? undefined,
        brevoFrom: (row as any).brevoFrom ?? undefined,
        cloudinaryCloudName: (row as any).cloudinaryCloudName ?? undefined,
        cloudinaryApiKey: (row as any).cloudinaryApiKey ?? undefined,
        cloudinaryApiSecret: (row as any).cloudinaryApiSecret ?? undefined,
        vapidPublicKey: (row as any).vapidPublicKey ?? undefined,
        vapidPrivateKey: (row as any).vapidPrivateKey ?? undefined,
        vapidEmail: (row as any).vapidEmail ?? undefined,
        managerApiAccess: (row as any).managerApiAccess === 1 ? true : false,
        logoWidth:     (row as any).logoWidth     ?? undefined,
        logoHeight:    (row as any).logoHeight    ?? undefined,
        logoRotation:  (row as any).logoRotation  ?? undefined,
        logoOffsetX:   (row as any).logoOffsetX   ?? undefined,
        logoOffsetY:   (row as any).logoOffsetY   ?? undefined,
        logoBgEnabled: (row as any).logoBgEnabled === 1 ? true : false,
        logoBgColor:   (row as any).logoBgColor   ?? undefined,
        logoBgOpacity: (row as any).logoBgOpacity ?? undefined,
        logoBgRadius:  (row as any).logoBgRadius  ?? undefined,
        uiSettings:    (row as any).uiSettings    ?? undefined,
      };
    } else {
      // Nothing saved in the DB yet — seed once from the legacy local file
      // (if present) so a config set before this fix isn't lost, then
      // persist it to the DB immediately.
      const legacy = readLegacyFile();
      if (Object.keys(legacy).length > 0) {
        cache = legacy;
        await persistNow(cache);
      }
    }
  } catch (err) {
    console.error("[Config] Failed to load app_config from DB, falling back to legacy file:", err);
    cache = readLegacyFile();
  }
}

async function persistNow(config: GeminiConfig): Promise<void> {
  const row: any = {
    id: 1,
    appName: config.appName ?? null,
    appLogo: config.appLogo ?? null,
    workStartTime: config.workStartTime ?? null,
    lateGraceMinutes: config.lateGraceMinutes ?? null,
    breakMinutes: config.breakMinutes ?? null,
    appTimezone: config.appTimezone ?? null,
    geminiApiKey: config.apiKey ?? null,
    smtpHost: config.smtpHost ?? null,
    smtpPort: config.smtpPort ?? null,
    smtpUser: config.smtpUser ?? null,
    smtpPass: config.smtpPass ?? null,
    smtpFrom: config.smtpFrom ?? null,
    resendApiKey: config.resendApiKey ?? null,
    resendFrom: config.resendFrom ?? null,
    brevoApiKey: config.brevoApiKey ?? null,
    brevoFrom: config.brevoFrom ?? null,
    cloudinaryCloudName: config.cloudinaryCloudName ?? null,
    cloudinaryApiKey: config.cloudinaryApiKey ?? null,
    cloudinaryApiSecret: config.cloudinaryApiSecret ?? null,
    vapidPublicKey: config.vapidPublicKey ?? null,
    vapidPrivateKey: config.vapidPrivateKey ?? null,
    vapidEmail: config.vapidEmail ?? null,
    managerApiAccess: config.managerApiAccess ? 1 : 0,
    gpsEnabled: config.gpsEnabled === false ? 0 : 1,
    gpsRadius: config.gpsRadius ?? 200,
    logoWidth:     config.logoWidth    ?? 96,
    logoHeight:    config.logoHeight   ?? 96,
    logoRotation:  config.logoRotation ?? 0,
    logoOffsetX:   config.logoOffsetX  ?? 0,
    logoOffsetY:   config.logoOffsetY  ?? 0,
    logoBgEnabled: config.logoBgEnabled ? 1 : 0,
    logoBgColor:   config.logoBgColor   ?? "#3b82f6",
    logoBgOpacity: config.logoBgOpacity ?? 10,
    logoBgRadius:  config.logoBgRadius  ?? 16,
    uiSettings:    config.uiSettings    ?? null,
  };
  await db.insert(appConfigTable)
    .values(row)
    .onConflictDoUpdate({ target: appConfigTable.id, set: row });
}

function persist(partial: Partial<GeminiConfig>): void {
  cache = { ...cache, ...partial };
  persistNow(cache).catch(err => console.error("[Config] Failed to persist app_config to DB:", err));
}

/** Apply multiple config changes in one atomic DB write (avoids parallel writes). */
export function persistBatch(changes: Partial<GeminiConfig>): void {
  cache = { ...cache, ...changes };
  persistNow(cache).catch(err => console.error("[Config] Failed to persist app_config to DB:", err));
}

export function getGeminiApiKey(): string | undefined {
  return cache.apiKey || process.env.GEMINI_API_KEY;
}

export function getGeminiKeySource(): "file" | "env" | "none" {
  if (cache.apiKey) return "file";
  if (process.env.GEMINI_API_KEY) return "env";
  return "none";
}

export function saveGeminiApiKey(key: string): void {
  persist({ apiKey: key });
}

export function clearGeminiApiKey(): void {
  persist({ apiKey: undefined });
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 4) + "••••••••••••" + key.slice(-4);
}

export function getAppName(): string {
  return cache.appName ?? "Pulse";
}

export function saveAppName(name: string): void {
  persist({ appName: name });
}

export function getAppLogo(): string {
  return cache.appLogo ?? "";
}

export function saveAppLogo(logo: string): void {
  persist({ appLogo: logo });
}

/* ─── Logo display settings ───────────────────────────────── */
export function getLogoDisplaySettings() {
  return {
    logoWidth:     cache.logoWidth     ?? 96,
    logoHeight:    cache.logoHeight    ?? 96,
    logoRotation:  cache.logoRotation  ?? 0,
    logoOffsetX:   cache.logoOffsetX   ?? 0,
    logoOffsetY:   cache.logoOffsetY   ?? 0,
    logoBgEnabled: cache.logoBgEnabled ?? false,
    logoBgColor:   cache.logoBgColor   ?? "#3b82f6",
    logoBgOpacity: cache.logoBgOpacity ?? 10,
    logoBgRadius:  cache.logoBgRadius  ?? 16,
  };
}

export function saveLogoDisplaySettings(s: {
  logoWidth?: number; logoHeight?: number; logoRotation?: number;
  logoOffsetX?: number; logoOffsetY?: number;
  logoBgEnabled?: boolean; logoBgColor?: string;
  logoBgOpacity?: number; logoBgRadius?: number;
}): void {
  persist(s);
}

/* ── Global UI settings (all client appearance / behaviour) ───────────────
   Stored as a JSON blob so any device that opens the app gets the latest
   admin-configured look without needing a localStorage entry.            */
export function getUiSettings(): Record<string, unknown> {
  try {
    return cache.uiSettings ? JSON.parse(cache.uiSettings) : {};
  } catch {
    return {};
  }
}

export function saveUiSettings(patch: Record<string, unknown>): void {
  const current = getUiSettings();
  const merged = { ...current, ...patch };
  persist({ uiSettings: JSON.stringify(merged) });
}

/** workStartTime stored as "HH:MM" UTC, default "09:00" */
export function getWorkStartTime(): string {
  return cache.workStartTime ?? "09:00";
}

export function saveWorkStartTime(time: string): void {
  persist({ workStartTime: time });
}

/** Grace period in minutes after work start before marking late, default 15 */
export function getLateGraceMinutes(): number {
  return cache.lateGraceMinutes ?? 15;
}

export function saveLateGraceMinutes(minutes: number): void {
  persist({ lateGraceMinutes: minutes });
}

/** Returns the late threshold in total minutes from midnight UTC */
export function getLateThresholdMinutes(): number {
  const [hh, mm] = getWorkStartTime().split(":").map(Number);
  return hh * 60 + mm + getLateGraceMinutes();
}

/** Break duration in minutes deducted from paid hours per day, default 0 */
export function getBreakMinutes(): number {
  return cache.breakMinutes ?? 0;
}

export function saveBreakMinutes(minutes: number): void {
  persist({ breakMinutes: minutes });
}

/** App timezone (IANA), default Europe/Stockholm */
export function getAppTimezone(): string {
  return cache.appTimezone ?? "Europe/Stockholm";
}

export function saveAppTimezone(tz: string): void {
  persist({ appTimezone: tz });
}

// ── SMTP / Email settings ─────────────────────────────────────────────────

export function getSmtpConfig(): { host?: string; port?: number; user?: string; pass?: string; from?: string } {
  return {
    host: cache.smtpHost || process.env.SMTP_HOST,
    port: cache.smtpPort || parseInt(process.env.SMTP_PORT ?? "587"),
    user: cache.smtpUser || process.env.SMTP_USER,
    pass: cache.smtpPass || process.env.SMTP_PASS,
    from: cache.smtpFrom || cache.smtpUser || process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

export function saveSmtpConfig(cfg: { host?: string; port?: number; user?: string; pass?: string; from?: string }): void {
  persist({
    smtpHost: cfg.host,
    smtpPort: cfg.port,
    smtpUser: cfg.user,
    smtpPass: cfg.pass,
    smtpFrom: cfg.from || cfg.user,
  });
}

export function clearSmtpConfig(): void {
  persist({ smtpHost: undefined, smtpPort: undefined, smtpUser: undefined, smtpPass: undefined, smtpFrom: undefined });
}

export function isSmtpConfigured(): boolean {
  const { host, user, pass } = getSmtpConfig();
  return !!(host && user && pass);
}

// ── Resend API (HTTP-based email, preferred over SMTP on restricted hosts) ──

export function getResendConfig(): { apiKey?: string; from?: string } {
  return {
    apiKey: cache.resendApiKey || process.env.RESEND_API_KEY,
    from: cache.resendFrom || process.env.RESEND_FROM || "onboarding@resend.dev",
  };
}

export function saveResendConfig(cfg: { apiKey?: string; from?: string }): void {
  persist({ resendApiKey: cfg.apiKey, resendFrom: cfg.from });
}

export function clearResendConfig(): void {
  persist({ resendApiKey: undefined, resendFrom: undefined });
}

export function isResendConfigured(): boolean {
  return !!getResendConfig().apiKey;
}

// ── Brevo (Sendinblue) API — HTTP, no domain verification needed ─────────────

export function getBrevoConfig(): { apiKey?: string; from?: string } {
  return {
    apiKey: cache.brevoApiKey || process.env.BREVO_API_KEY,
    from: cache.brevoFrom || process.env.BREVO_FROM,
  };
}

export function saveBrevoConfig(cfg: { apiKey?: string; from?: string }): void {
  persist({ brevoApiKey: cfg.apiKey, brevoFrom: cfg.from });
}

export function clearBrevoConfig(): void {
  persist({ brevoApiKey: undefined, brevoFrom: undefined });
}

export function isBrevoConfigured(): boolean {
  return !!getBrevoConfig().apiKey;
}

// ── Cloudinary — image/file storage ──────────────────────────────────────────

export function getCloudinaryConfig(): { cloudName?: string; apiKey?: string; apiSecret?: string } {
  return {
    cloudName:  cache.cloudinaryCloudName  || process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
    apiKey:     cache.cloudinaryApiKey     || process.env.CLOUDINARY_API_KEY    || process.env.API_KEY,
    apiSecret:  cache.cloudinaryApiSecret  || process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET,
  };
}

export function saveCloudinaryConfig(cfg: { cloudName?: string; apiKey?: string; apiSecret?: string }): void {
  persist({ cloudinaryCloudName: cfg.cloudName, cloudinaryApiKey: cfg.apiKey, cloudinaryApiSecret: cfg.apiSecret });
}

export function clearCloudinaryConfig(): void {
  persist({ cloudinaryCloudName: undefined, cloudinaryApiKey: undefined, cloudinaryApiSecret: undefined });
}

export function isCloudinaryConfigured(): boolean {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  return !!(cloudName && apiKey && apiSecret);
}

// ── VAPID — Web Push notifications ────────────────────────────────────────────

export function getVapidConfig(): { publicKey?: string; privateKey?: string; email?: string } {
  return {
    publicKey:  cache.vapidPublicKey  || process.env.VAPID_PUBLIC_KEY,
    privateKey: cache.vapidPrivateKey || process.env.VAPID_PRIVATE_KEY,
    email:      cache.vapidEmail      || process.env.VAPID_EMAIL || "mailto:admin@attendx.app",
  };
}

export function saveVapidConfig(cfg: { publicKey?: string; privateKey?: string; email?: string }): void {
  persist({ vapidPublicKey: cfg.publicKey, vapidPrivateKey: cfg.privateKey, vapidEmail: cfg.email });
}

export function clearVapidConfig(): void {
  persist({ vapidPublicKey: undefined, vapidPrivateKey: undefined, vapidEmail: undefined });
}

export function isVapidConfigured(): boolean {
  const { publicKey, privateKey } = getVapidConfig();
  return !!(publicKey && privateKey);
}

// ── Manager API Keys access ───────────────────────────────────────────────────

export function getManagerApiAccess(): boolean {
  return cache.managerApiAccess ?? false;
}

export function saveManagerApiAccess(allowed: boolean): void {
  persist({ managerApiAccess: allowed });
}

// ── GPS Attendance Settings ───────────────────────────────────────────────────

export function getGpsEnabled(): boolean {
  return cache.gpsEnabled ?? true;
}

export function saveGpsEnabled(enabled: boolean): void {
  persist({ gpsEnabled: enabled });
}

export function getGpsRadius(): number {
  return cache.gpsRadius ?? 200;
}

export function saveGpsRadius(metres: number): void {
  persist({ gpsRadius: metres });
}
