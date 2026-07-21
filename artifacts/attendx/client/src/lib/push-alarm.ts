/**
 * push-alarm.ts
 * Shared utility for registering / refreshing the push subscription on the
 * server.  Called from BOTH Layout (on every app open) and Settings (on alarm
 * toggle / save).  This guarantees the server always has a valid subscription
 * even after Render redeploys wipe the old JSON-file subscriptions.
 */

import { authFetch } from "@/lib/api-url";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export interface PushAlarmSettings {
  enabled:   boolean;
  startTime: string;
  endTime:   string;
}

function loadAlarmSettings(): PushAlarmSettings | null {
  try {
    const raw = localStorage.getItem("setting_shift_alarms");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.enabled) return null;
    return {
      enabled:   true,
      startTime: s.startTime ?? "09:00",
      endTime:   s.endTime   ?? "17:00",
    };
  } catch { return null; }
}

/**
 * Silently sync the push subscription to the server.
 *
 * - If alarm is disabled → do nothing.
 * - If SW / PushManager not available → do nothing.
 * - If notification permission not granted → request it (only if we have a
 *   user gesture context — caller should pass `askPermission = true` when
 *   calling from a user interaction, `false` for background syncs).
 * - POSTs the subscription to /api/push/subscribe so the server always has
 *   fresh endpoint/keys even after redeploys.
 *
 * Returns true on success, false on any failure (never throws).
 */
export async function syncPushSubscription(
  overrideSettings?: PushAlarmSettings,
  askPermission = false,
): Promise<boolean> {
  try {
    const settings = overrideSettings ?? loadAlarmSettings();
    if (!settings) return false;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

    // Check / request notification permission
    let permission = typeof Notification !== "undefined" ? Notification.permission : "denied";
    if (permission === "denied") return false;
    if (permission === "default") {
      if (!askPermission) return false; // don't request without a gesture
      permission = await Notification.requestPermission();
      if (permission !== "granted") return false;
    }

    // Fetch VAPID public key
    const vapidRes = await authFetch("/api/push/vapid-key");
    if (!vapidRes.ok) return false;
    const { publicKey } = await vapidRes.json().catch(() => ({}));
    if (!publicKey) return false;

    // Get or create browser push subscription
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    // POST subscription to server (upserts — safe to call repeatedly)
    const res = await authFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        subscription:    sub.toJSON(),
        enabled:         settings.enabled,
        startTime:       settings.startTime,
        endTime:         settings.endTime,
        timezoneOffset:  new Date().getTimezoneOffset(),
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
