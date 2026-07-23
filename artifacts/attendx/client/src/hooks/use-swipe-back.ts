import { useEffect } from "react";

/**
 * iOS-style edge swipe to go back.
 * LTR: swipe right starting from left 30px edge.
 * RTL: swipe left starting from right 30px edge.
 */
export function useSwipeBack() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let edgeSwipe = false;

    function onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement | null;
      // Never treat an intentional control interaction as a back gesture.
      // This is especially important for close buttons placed near the RTL
      // screen edge: the global listener must not compete with the button.
      if (
        target?.closest(
          "button, a, input, textarea, select, label, [role='button'], [data-no-swipe-back]"
        )
      ) {
        edgeSwipe = false;
        return;
      }

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const isRTL = document.documentElement.dir === "rtl";
      if (isRTL) {
        edgeSwipe = startX > window.innerWidth - 30;
      } else {
        edgeSwipe = startX < 30;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!edgeSwipe) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          "button, a, input, textarea, select, label, [role='button'], [data-no-swipe-back]"
        )
      ) {
        edgeSwipe = false;
        return;
      }
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      const isRTL = document.documentElement.dir === "rtl";

      const isBackSwipe = isRTL ? dx < -70 : dx > 70;
      if (isBackSwipe && dy < 80) {
        window.history.back();
      }
      edgeSwipe = false;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
}
