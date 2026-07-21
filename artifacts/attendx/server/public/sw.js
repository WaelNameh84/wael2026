// __BUILD_TIME__ is replaced at runtime by the Express server (see app.ts).
// Every server restart produces a new value, which forces the browser to
// install a fresh Service Worker and clears all stale caches on every deploy.
const CACHE_NAME = "attendx-__BUILD_TIME__";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Take over immediately — don't wait for old SW's clients to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete every cache that doesn't match the current build.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));

      // Claim all open clients so this SW controls them immediately.
      await self.clients.claim();

      // Tell every open client that a new version is ready so it reloads
      // without waiting for the next poll cycle.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls — always network-only; never cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Navigation (HTML) — network-first so the latest index.html is always served.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((r) => r || fetch(request))
      )
    );
    return;
  }

  // Never cache app icon variants — they must always be fresh.
  if (url.pathname.startsWith("/app-icons/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Everything else — network-first, cache as fallback.
  event.respondWith(
    fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type === "opaque") {
        return response;
      }
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    }).catch(() => caches.match(request))
  );
});

/* ─── Web Push ─────────────────────────────────────────────── */

self.addEventListener("push", (event) => {
  let data = { title: "AttendX", body: "إشعار جديد", icon: "/icon-192.svg", tag: "alarm" };
  try { if (event.data) data = { ...data, ...JSON.parse(event.data.text()) }; } catch { /* ignore */ }

  const isAlarm   = data.tag?.startsWith("alarm-") || data.tag === "alarm";
  const alarmType = data.tag?.replace("alarm-", "") ?? "start";

  event.waitUntil(
    Promise.all([
      // 1. Show the visual notification on the lock screen
      self.registration.showNotification(data.title, {
        body:    data.body,
        icon:    data.icon ?? "/icon-192.svg",
        badge:   "/icon-192.svg",
        tag:     data.tag ?? "alarm",
        renotify: true,
        sound:   "default",
        vibrate: [400, 100, 400, 100, 400, 100, 400, 100, 400],
        requireInteraction: true,
        data: { alarm: isAlarm, tag: data.tag, alarmType },
      }),
      // 2. Wake up / notify any open windows, or auto-open the app if closed
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(async (clients) => {
          if (clients.length > 0) {
            // App is already open — send PLAY_ALARM immediately
            clients.forEach((c) =>
              c.postMessage({ type: "PLAY_ALARM", label: data.title, body: data.body, alarmType })
            );
          } else if (isAlarm && self.clients.openWindow) {
            // Screen is locked / app is closed — open the app so the alarm modal appears
            const win = await self.clients.openWindow(`/?alarm=1&alarmType=${alarmType}`);
            // Belt-and-suspenders: also postMessage after a short delay
            if (win) {
              setTimeout(() =>
                win.postMessage({ type: "PLAY_ALARM", label: data.title, body: data.body, alarmType }),
              1500);
            }
          }
        }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const isAlarm = event.notification.data?.alarm;
  const alarmType = event.notification.data?.tag?.replace("alarm-", "") ?? "start";
  const label = event.notification.title ?? "🔔 تنبيه الدوام";
  const body  = event.notification.body  ?? "حان وقت دوامك";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        // If a window is already open, focus it and send alarm data
        if (clientList.length > 0) {
          const client = clientList[0];
          await client.focus();
          if (isAlarm) {
            client.postMessage({ type: "PLAY_ALARM", label, body, alarmType });
          }
          return;
        }
        // Otherwise open the app — URL params trigger the alarm modal on load
        if (self.clients.openWindow) {
          const params = isAlarm
            ? `?alarm=1&alarmType=${alarmType}`
            : "";
          const win = await self.clients.openWindow(`/${params}`);
          // Belt-and-suspenders: also postMessage in case URL params are stripped
          if (win && isAlarm) {
            setTimeout(() => win.postMessage({ type: "PLAY_ALARM", label, body, alarmType }), 1000);
          }
        }
      })
  );
});
