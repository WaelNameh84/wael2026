import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Trigger haptic feedback if available */
function haptic(pattern: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch { /* ignore */ }
}

export function usePullToRefresh(ref: React.RefObject<HTMLElement | null>) {
  const qc = useQueryClient();
  const stateRef = useRef({
    startY: 0,
    pulling: false,
    indicator: null as HTMLElement | null,
    triggered: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const THRESHOLD = 80; // px to trigger refresh
    const MAX_PULL  = 120;

    function ensureIndicator() {
      if (stateRef.current.indicator) return stateRef.current.indicator;
      const ind = document.createElement("div");
      ind.className = "ptr-indicator";
      ind.innerHTML = `
        <svg class="ptr-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>`;
      el.prepend(ind);
      stateRef.current.indicator = ind;
      return ind;
    }

    function updateIndicator(dy: number) {
      const ind = ensureIndicator();
      const progress = Math.min(dy / THRESHOLD, 1);
      const height   = Math.min(dy * 0.6, MAX_PULL * 0.6);
      ind.style.height  = `${height}px`;
      ind.style.opacity = `${Math.min(progress * 1.2, 1)}`;

      // Rotate spinner based on pull progress
      const deg = progress * 300;
      const spinner = ind.querySelector(".ptr-spinner") as HTMLElement | null;
      if (spinner) spinner.style.transform = `rotate(${deg}deg)`;

      // Haptic at threshold crossing
      if (progress >= 1 && !stateRef.current.triggered) {
        stateRef.current.triggered = true;
        haptic(10); // light buzz when ready to release
        ind.classList.add("ptr-ready");
      } else if (progress < 1) {
        stateRef.current.triggered = false;
        ind.classList.remove("ptr-ready");
      }
    }

    function removeIndicator() {
      const ind = stateRef.current.indicator;
      if (!ind) return;
      ind.style.transition = "height 200ms ease, opacity 200ms ease";
      ind.style.height = "0";
      ind.style.opacity = "0";
      setTimeout(() => { ind.remove(); }, 210);
      stateRef.current.indicator = null;
      stateRef.current.triggered = false;
    }

    function onTouchStart(e: TouchEvent) {
      if (el.scrollTop === 0) {
        stateRef.current.startY  = e.touches[0].clientY;
        stateRef.current.pulling = true;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!stateRef.current.pulling || el.scrollTop > 0) return;
      const dy = e.touches[0].clientY - stateRef.current.startY;
      if (dy > 6) updateIndicator(dy);
    }

    function onTouchEnd(e: TouchEvent) {
      if (!stateRef.current.pulling) return;
      stateRef.current.pulling = false;
      const dy = e.changedTouches[0].clientY - stateRef.current.startY;

      if (dy >= THRESHOLD && el.scrollTop === 0) {
        // Show loading spinner while refreshing
        const ind = stateRef.current.indicator;
        if (ind) {
          ind.classList.add("ptr-loading");
          ind.classList.remove("ptr-ready");
        }
        haptic([10, 50, 10]); // success double-tap feel

        qc.invalidateQueries().finally(() => {
          removeIndicator();
        });
      } else {
        removeIndicator();
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [ref, qc]);
}
