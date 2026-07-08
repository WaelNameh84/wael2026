import { Router } from "express";
import webpush from "web-push";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { requireAuth } from "./auth.js";

const router = Router();

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const EMAIL       = process.env.VAPID_EMAIL       ?? "mailto:admin@attendx.app";

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails(EMAIL, PUBLIC_KEY, PRIVATE_KEY);
}

/* ─── Persistent subscription store ────────────────────────── */

const STORE_PATH = path.resolve(process.cwd(), "push-subscriptions.json");

type AlarmEntry = {
  subscription: webpush.PushSubscription;
  userId: number;
  enabled: boolean;
  startTime: string;
  endTime:   string;
};

function readStore(): AlarmEntry[] {
  try {
    if (existsSync(STORE_PATH)) return JSON.parse(readFileSync(STORE_PATH, "utf-8"));
  } catch { /* ignore */ }
  return [];
}

function writeStore(entries: AlarmEntry[]) {
  try { writeFileSync(STORE_PATH, JSON.stringify(entries, null, 2)); } catch { /* ignore */ }
}

/* ─── Routes ─────────────────────────────────────────────────── */

router.get("/vapid-key", (_req, res) => {
  return res.json({ publicKey: PUBLIC_KEY });
});

router.post("/subscribe", requireAuth, (req: any, res) => {
  const { subscription, enabled, startTime, endTime } = req.body as {
    subscription: webpush.PushSubscription;
    enabled:   boolean;
    startTime: string;
    endTime:   string;
  };
  if (!subscription?.endpoint) return res.status(400).json({ error: "Invalid subscription" });

  const entries = readStore().filter(e => e.userId !== req.userId);
  entries.push({ subscription, userId: req.userId, enabled, startTime, endTime });
  writeStore(entries);
  return res.json({ ok: true });
});

router.delete("/unsubscribe", requireAuth, (req: any, res) => {
  const entries = readStore().filter(e => e.userId !== req.userId);
  writeStore(entries);
  return res.json({ ok: true });
});

/* ─── Alarm scheduler (runs every 30 s) ─────────────────────── */

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

const firedToday = new Set<string>();

setInterval(() => {
  const current = nowHHMM();
  const todayKey = new Date().toISOString().slice(0, 10);
  const entries  = readStore();

  for (const entry of entries) {
    if (!entry.enabled) continue;

    const tryFire = (type: "start" | "end", time: string) => {
      if (current !== time) return;
      const key = `${entry.userId}-${todayKey}-${type}`;
      if (firedToday.has(key)) return;
      firedToday.add(key);

      const isStart = type === "start";
      const payload = JSON.stringify({
        title: isStart ? "🕐 بدء الدوام" : "🕔 انتهاء الدوام",
        body:  isStart ? `حان وقت بدء دوامك (${time})` : `انتهى وقت دوامك (${time})`,
        icon:  "/icon-192.svg",
        tag:   `alarm-${type}`,
      });

      webpush.sendNotification(entry.subscription, payload).catch((err: any) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          const fresh = readStore().filter(e => e.userId !== entry.userId);
          writeStore(fresh);
        }
      });
    };

    tryFire("start", entry.startTime);
    tryFire("end",   entry.endTime);
  }

  if (current === "00:01") firedToday.clear();
}, 30_000);

export default router;
