/**
 * use-swipe-dismiss.ts
 * يضيف سحب يمين/يسار لحذف أو تنفيذ إجراء على بطاقة أو عنصر
 *
 * الاستخدام:
 *   const { wrapperRef } = useSwipeDismiss({
 *     onDismissRight: () => deleteItem(),   // سحب لليمين
 *     onDismissLeft:  () => archiveItem(),  // سحب لليسار
 *   });
 *   <div ref={wrapperRef} className="swipe-dismiss-wrapper"> ... </div>
 */
import { useEffect, useRef } from "react";

interface SwipeDismissOptions {
  threshold?: number;           // px للتفعيل (افتراضي 80)
  onDismissRight?: () => void;  // سحب يمين
  onDismissLeft?:  () => void;  // سحب يسار
}

export function useSwipeDismiss({
  threshold = 80,
  onDismissRight,
  onDismissLeft,
}: SwipeDismissOptions = {}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const inner = el.querySelector<HTMLElement>(".swipe-dismiss-inner");
    const bgRight = el.querySelector<HTMLElement>(".swipe-dismiss-bg.swipe-right");
    const bgLeft  = el.querySelector<HTMLElement>(".swipe-dismiss-bg.swipe-left");

    let startX = 0;
    let startY = 0;
    let dragging = false;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
      if (inner) inner.style.transition = "none";
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);

      // إذا التمرير عمودي أكثر — تجاهل
      if (dy > Math.abs(dx) * 1.5) return;

      if (inner) inner.style.transform = `translateX(${dx}px)`;

      const progress = Math.min(Math.abs(dx) / threshold, 1);
      if (bgRight) bgRight.style.opacity = dx > 0 ? `${progress}` : "0";
      if (bgLeft)  bgLeft.style.opacity  = dx < 0 ? `${progress}` : "0";
    }

    function onTouchEnd(e: TouchEvent) {
      if (!dragging) return;
      dragging = false;

      const dx = e.changedTouches[0].clientX - startX;
      if (inner) {
        inner.style.transition = "";
        inner.style.transform  = "";
      }
      if (bgRight) bgRight.style.opacity = "0";
      if (bgLeft)  bgLeft.style.opacity  = "0";

      if (dx > threshold && onDismissRight) onDismissRight();
      if (dx < -threshold && onDismissLeft)  onDismissLeft();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: true });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [threshold, onDismissRight, onDismissLeft]);

  return { wrapperRef };
}
