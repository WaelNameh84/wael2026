import { Router } from "express";
import webpush from "web-push";
import path from "path";
import { requireAuth } from "./auth.js";
import { db, attendanceTable } from "../../../db/src/index.js";
import { and, eq, sql } from "drizzle-orm";
import { getVapidConfig, saveVapidConfig } from "../lib/gemini-config.js";
import pg from "pg";

const router = Router();

let vapidConfigured = false;
let PUBLIC_KEY = "";

/**
 * Call after initConfigCache() so DB-stored VAPID keys are available.
 * If no VAPID keys are configured, auto-generates a pair and persists them.
 */
export async function initVapid(): Promise<void> {
  let cfg = getVapidConfig();
  let pub  = (cfg.publicKey  ?? "").trim();
  let priv = (cfg.privateKey ?? "").trim();
  const mail = cfg.email ?? "mailto:admin@attendx.app";

  // Auto-generate VAPID keys if none are configured
  if (!pub || !priv) {
    try {
      const generated = webpush.generateVAPIDKeys();
      pub  = generated.publicKey;
      priv = generated.privateKey;
      saveVapidConfig({ publicKey: pub, privateKey: priv, email: mail });
      console.log("✅ VAPID keys auto-generated and saved.");
    } catch (err: any) {
      console.error("Failed to auto-generate VAPID keys:", err.message);
      return;
    }
  }

  try {
    webpush.setVapidDetails(mail, pub, priv);
    PUBLIC_KEY = pub;
    vapidConfigured = true;
  } catch (err: any) {
    console.error("Invalid VAPID keys — push notifications disabled:", err.message);
  }
}

/* ─── DB-backed subscription store ─────────────────────────── */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

type AlarmEntry = {
  subscription: webpush.PushSubscription;
  userId: number;
  enabled: boolean;
  startTime: string;
  endTime:   string;
  timezoneOffset: number;
};

async function readStore(): Promise<AlarmEntry[]> {
  try {
    const res = await pool.query(`
      SELECT user_id, endpoint, p256dh, auth, enabled, start_time, end_time, timezone_offset
      FROM push_subscriptions
    `);
    return res.rows.map((r: any) => ({
      userId: r.user_id,
      subscription: { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
      enabled: r.enabled,
      startTime: r.start_time,
      endTime: r.end_time,
      timezoneOffset: r.timezone_offset ?? 0,
    }));
  } catch (err: any) {
    // Table may not exist yet on first boot before migration runs
    if (err.code !== "42P01") console.error("push readStore error:", err.message);
    return [];
  }
}

async function upsertEntry(entry: AlarmEntry): Promise<void> {
  const { userId, subscription, enabled, startTime, endTime, timezoneOffset } = entry;
  await pool.query(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, enabled, start_time, end_time, timezone_offset)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id) DO UPDATE SET
      endpoint = EXCLUDED.endpoint,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      enabled = EXCLUDED.enabled,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      timezone_offset = EXCLUDED.timezone_offset
  `, [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
      enabled, startTime, endTime, timezoneOffset]);
}

async function deleteEntry(userId: number): Promise<void> {
  await pool.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [userId]);
}

async function deleteByEndpoint(endpoint: string): Promise<void> {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

/* ─── Routes ─────────────────────────────────────────────────── */

router.get("/vapid-key", (_req, res) => {
  return res.json({ publicKey: vapidConfigured ? PUBLIC_KEY : "" });
});

router.post("/subscribe", requireAuth, async (req: any, res) => {
  const { subscription, enabled, startTime, endTime, timezoneOffset } = req.body as {
    subscription: webpush.PushSubscription;
    enabled:   boolean;
    startTime: string;
    endTime:   string;
    timezoneOffset?: number;
  };
  if (!subscription?.endpoint) return res.status(400).json({ error: "Invalid subscription" });

  const tzOffset = typeof timezoneOffset === "number" ? timezoneOffset : 0;

  await upsertEntry({
    userId: req.userId,
    subscription,
    enabled,
    startTime,
    endTime,
    timezoneOffset: tzOffset,
  });
  return res.json({ ok: true });
});

router.delete("/unsubscribe", requireAuth, async (req: any, res) => {
  await deleteEntry(req.userId);
  return res.json({ ok: true });
});

/** Returns whether the current user has a valid server-side subscription */
router.get("/status", requireAuth, async (req: any, res) => {
  try {
    const rows = await pool.query(
      `SELECT endpoint, enabled, start_time, end_time, timezone_offset, created_at
       FROM push_subscriptions WHERE user_id = $1 LIMIT 1`,
      [req.userId]
    );
    if (!rows.rows.length) return res.json({ subscribed: false });
    const r = rows.rows[0];
    return res.json({
      subscribed: true,
      enabled: r.enabled,
      startTime: r.start_time,
      endTime: r.end_time,
      timezoneOffset: r.timezone_offset,
      createdAt: r.created_at,
      vapidConfigured,
    });
  } catch (err: any) {
    return res.status(500).json({ subscribed: false, error: err.message });
  }
});

/** Immediately sends a test push to the current user's device — for debugging */
router.post("/test", requireAuth, async (req: any, res) => {
  if (!vapidConfigured) return res.status(503).json({ error: "VAPID not configured" });

  const rows = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 LIMIT 1`,
    [req.userId]
  ).catch(() => ({ rows: [] as any[] }));

  if (!rows.rows.length) {
    return res.status(404).json({ error: "No subscription found — enable the alarm first" });
  }

  const { endpoint, p256dh, auth } = rows.rows[0];
  const sub: webpush.PushSubscription = { endpoint, keys: { p256dh, auth } };

  const payload = JSON.stringify({
    title: "✅ اختبار المنبّه | Alarm Test",
    body:  "إذا سمعت صوتاً فالمنبّه يعمل بشكل صحيح 🔔\nIf you hear a sound, the alarm is working!",
    icon:  "/icon-192.svg",
    tag:   "alarm-test",
    requireInteraction: true,
    sound: "default",
    vibrate: [300, 100, 300, 100, 300],
  });

  try {
    await webpush.sendNotification(sub, payload);
    return res.json({ ok: true });
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await deleteByEndpoint(endpoint);
      return res.status(410).json({ error: "Subscription expired — please re-enable the alarm" });
    }
    return res.status(500).json({ error: err.message });
  }
});

/* ─── Alarm scheduler (runs every 30 s) ─────────────────────── */

function userLocalTime(timezoneOffset: number): { hhmm: string; dateKey: string } {
  const utcMs = Date.now();
  // timezoneOffset from JS: negative for UTC+ zones (e.g. UTC+3 → -180)
  const localMs = utcMs - timezoneOffset * 60_000;
  const d = new Date(localMs);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return { hhmm: `${hh}:${mm}`, dateKey: `${yyyy}-${mo}-${dd}` };
}

const firedToday = new Set<string>();

async function checkReminderAsync(entry: AlarmEntry, current: string, todayKey: string): Promise<void> {
  const { hhmm: startHHMM } = userLocalTime(entry.timezoneOffset);
  const [sh, sm] = entry.startTime.split(":").map(Number);
  const [ch, cm] = current.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const currentMinutes = ch * 60 + cm;
  if (currentMinutes !== startMinutes + 30) return;

  const key = `${entry.userId}-${todayKey}-checkin-reminder`;
  if (firedToday.has(key)) return;

  try {
    const rows = await pool.query(
      `SELECT id FROM attendance WHERE user_id = $1 AND date = $2 AND check_in IS NOT NULL LIMIT 1`,
      [entry.userId, todayKey]
    );
    if (rows.rowCount && rows.rowCount > 0) return; // already checked in
  } catch { return; }

  firedToday.add(key);

  if (!vapidConfigured) return;

  const payload = JSON.stringify({
    title: "⚠️ لم تسجّل حضورك بعد | Check-in Reminder",
    body:  `مضت 30 دقيقة من بدء دوامك (${entry.startTime}). يرجى تسجيل الحضور الآن 🕐\n30 min since shift start — please check in now.`,
    icon:  "/icon-192.svg",
    tag:   "checkin-reminder",
    requireInteraction: true,
  });

  webpush.sendNotification(entry.subscription, payload).catch(async (err: any) => {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await deleteByEndpoint(entry.subscription.endpoint);
    }
  });
}

let schedulerTick = 0;

setInterval(async () => {
  schedulerTick++;
  const entries = await readStore();

  // Log every 2nd tick (every ~1 min) so Render logs show the scheduler is alive
  if (schedulerTick % 2 === 0) {
    const utcNow = new Date().toISOString().substring(11, 16);
    console.log(`[push-alarm] tick=${schedulerTick} subs=${entries.length} utc=${utcNow} vapid=${vapidConfigured}`);
  }

  for (const entry of entries) {
    if (!entry.enabled) continue;

    const tzOffset = typeof entry.timezoneOffset === "number" ? entry.timezoneOffset : 0;
    const { hhmm: current, dateKey: todayKey } = userLocalTime(tzOffset);

    const tryFire = (type: "start" | "end", time: string) => {
      // Allow a 2-minute window: fires if current time is within [time, time+1min]
      // This handles Render slow-starts and scheduler jitter
      const [th, tm] = time.split(":").map(Number);
      const [ch, cm] = current.split(":").map(Number);
      const alarmMin = th * 60 + tm;
      const nowMin   = ch * 60 + cm;
      if (nowMin !== alarmMin && nowMin !== alarmMin + 1) return;
      const key = `${entry.userId}-${todayKey}-${type}`;
      if (firedToday.has(key)) return;
      firedToday.add(key);

      if (!vapidConfigured) {
        console.warn(`[push-alarm] ⚠️ VAPID not configured — cannot send push to user ${entry.userId}`);
        return;
      }

      const isStart = type === "start";
      const payload = JSON.stringify({
        title: isStart ? "🕐 بدء الدوام" : "🕔 انتهاء الدوام",
        body:  isStart ? `حان وقت بدء دوامك (${time})` : `انتهى وقت دوامك (${time})`,
        icon:  "/icon-192.svg",
        tag:   `alarm-${type}`,
        requireInteraction: true,
        sound: "default",
        vibrate: [300, 100, 300, 100, 300],
      });

      console.log(`[push-alarm] 🔔 Firing ${type} alarm for user ${entry.userId} at ${time} (local ${current})`);

      webpush.sendNotification(entry.subscription, payload)
        .then(() => console.log(`[push-alarm] ✅ Push sent to user ${entry.userId}`))
        .catch(async (err: any) => {
          console.error(`[push-alarm] ❌ Push failed for user ${entry.userId}: status=${err.statusCode} ${err.message}`);
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`[push-alarm] 🗑 Removing stale subscription for user ${entry.userId}`);
            await deleteByEndpoint(entry.subscription.endpoint);
          }
        });
    };

    tryFire("start", entry.startTime);
    tryFire("end",   entry.endTime);

    checkReminderAsync(entry, current, todayKey).catch(() => {});
  }

  // Clear fired-today set at server midnight (UTC)
  const utcHHMM = `${String(new Date().getUTCHours()).padStart(2,"0")}:${String(new Date().getUTCMinutes()).padStart(2,"0")}`;
  if (utcHHMM === "00:01") { firedToday.clear(); console.log("[push-alarm] 🔄 firedToday cleared for new day"); }
}, 30_000);

export default router;
