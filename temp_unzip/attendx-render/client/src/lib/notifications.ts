const STORAGE_KEY = "setting_daily_reminders";

export function getDailyRemindersEnabled(): boolean {
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === null) return false;
  return val === "true";
}

export function setDailyRemindersEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

/* ── Permission ─────────────────────────────────────────────── */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/* ── Show a notification ────────────────────────────────────── */

async function showNotification(title: string, body: string, icon = "/icon-192.svg") {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // Prefer SW-backed notification (works in Chrome)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, icon, badge: icon, silent: false });
      return;
    } catch {
      // fall through to legacy
    }
  }

  // Legacy fallback
  try {
    new Notification(title, { body, icon, silent: false } as NotificationOptions);
  } catch {
    // browser doesn't support
  }
}

/* ── Scheduling ─────────────────────────────────────────────── */

const activeTimers: ReturnType<typeof setTimeout>[] = [];

function clearAllTimers() {
  activeTimers.forEach(id => clearTimeout(id));
  activeTimers.splice(0, activeTimers.length);
}

function msUntilNext(targetHour: number, targetMinute = 0): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function scheduleRepeating(hour: number, minute: number, title: string, body: string) {
  const delay = msUntilNext(hour, minute);
  const id = setTimeout(() => {
    showNotification(title, body);
    scheduleRepeating(hour, minute, title, body);
  }, delay);
  activeTimers.push(id);
}

/* ── Public API ─────────────────────────────────────────────── */

export function scheduleDailyReminders(lang: "en" | "ar" | "sv" = "en") {
  clearAllTimers();

  const messages: Record<string, { morning: { title: string; body: string }; evening: { title: string; body: string } }> = {
    en: {
      morning: { title: "Good Morning! ☀️", body: "Don't forget to check in for today's attendance." },
      evening: { title: "End of Day 🌙",   body: "Remember to check out before you leave." },
    },
    ar: {
      morning: { title: "صباح الخير! ☀️",  body: "لا تنسَ تسجيل حضورك لهذا اليوم." },
      evening: { title: "نهاية الدوام 🌙", body: "تذكّر تسجيل انصرافك قبل المغادرة." },
    },
    sv: {
      morning: { title: "God morgon! ☀️",  body: "Glöm inte att stämpla in för dagens närvaro." },
      evening: { title: "Slut på dagen 🌙", body: "Kom ihåg att stämpla ut innan du går." },
    },
  };

  const m = messages[lang] ?? messages.en;

  scheduleRepeating(7,  0, m.morning.title, m.morning.body);
  scheduleRepeating(16, 0, m.evening.title, m.evening.body);
}

export function cancelDailyReminders() {
  clearAllTimers();
}

/* ── Test notification (for UI) ─────────────────────────────── */

export async function sendTestNotification(lang: "en" | "ar" | "sv" = "en") {
  const titles: Record<string, string> = {
    en: "✅ Notifications are working!",
    ar: "✅ الإشعارات تعمل بنجاح!",
    sv: "✅ Notiser fungerar!",
  };
  const bodies: Record<string, string> = {
    en: "You will receive daily attendance reminders.",
    ar: "ستتلقى تذكيرات الحضور اليومية.",
    sv: "Du kommer att få dagliga närvaro-påminnelser.",
  };
  await showNotification(titles[lang] ?? titles.en, bodies[lang] ?? bodies.en);
}

/* ── Boot: call this once on app start ──────────────────────── */

export function bootNotifications(lang: "en" | "ar" | "sv" = "en") {
  if (!getDailyRemindersEnabled()) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  scheduleDailyReminders(lang);
}
