import { useEffect, useRef } from "react";

// How often to poll the server version endpoint as a safety net.
// The primary update path is the SW_UPDATED message from the service worker
// (fired as soon as the new SW activates), so this is just a fallback.
const POLL_INTERVAL = 30 * 1000;

function getVersionUrl(): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  return `${apiBase.replace(/\/+$/, "")}/api/version`;
}

function hardReload() {
  // Clear all query-cache from localStorage so the reloaded page starts fresh.
  try { localStorage.removeItem("attendx_qcache_v1"); } catch { /* ignore */ }
  window.location.reload();
}

export function useAutoUpdate() {
  const knownVersion = useRef<string | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    // ── 1. SW_UPDATED message ──────────────────────────────────────────────
    // When the service worker activates a new build it sends SW_UPDATED to all
    // open clients. React to it immediately — no waiting for the next poll.
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED" && !reloading.current) {
        reloading.current = true;
        hardReload();
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    // ── 2. Proactively trigger SW update check on every focus/visibility ───
    // This makes the browser re-fetch sw.js immediately rather than waiting
    // for its default 24-hour cycle.
    const triggerSwUpdate = () => {
      navigator.serviceWorker?.getRegistration().then((reg) => {
        if (reg) reg.update().catch(() => { /* ignore network errors */ });
      });
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") triggerSwUpdate();
    });
    window.addEventListener("focus", triggerSwUpdate);

    // ── 3. Version polling fallback ────────────────────────────────────────
    // Catches the case where the SW is not registered (e.g. dev mode or
    // browsers that block SW updates) or where the SW_UPDATED message was
    // missed because no tab was open at the time of the deploy.
    async function checkVersion() {
      if (reloading.current) return;
      try {
        const res = await fetch(getVersionUrl(), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const v: string = data.version;
        if (knownVersion.current === null) {
          knownVersion.current = v;
          // Also trigger a SW update check on first load so the browser
          // picks up a new sw.js without waiting for 24 hours.
          triggerSwUpdate();
        } else if (knownVersion.current !== v) {
          reloading.current = true;
          hardReload();
        }
      } catch {
        // Network errors are fine — we'll catch the version on the next poll.
      }
    }

    checkVersion();
    const id = setInterval(checkVersion, POLL_INTERVAL);

    return () => {
      clearInterval(id);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      document.removeEventListener("visibilitychange", triggerSwUpdate);
      window.removeEventListener("focus", triggerSwUpdate);
    };
  }, []);
}
