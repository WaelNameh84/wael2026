/**
 * use-keyboard-avoid.ts
 * لما لوحة المفاتيح تفتح، يتحرك الحقل المحدد لفوق تلقائياً
 * يعمل عبر visualViewport API (iOS Safari + Android Chrome)
 */
import { useEffect } from "react";

export function useKeyboardAvoid() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let rafId: number;

    function handleResize() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = document.activeElement as HTMLElement | null;
        if (!focused) return;

        const tag = focused.tagName.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && focused.contentEditable !== "true") return;

        const rect = focused.getBoundingClientRect();
        const viewBottom = (vv?.height ?? window.innerHeight);
        const gap = 16; // مسافة فوق لوحة المفاتيح

        if (rect.bottom > viewBottom - gap) {
          const scrollBy = rect.bottom - (viewBottom - gap);
          window.scrollBy({ top: scrollBy, behavior: "smooth" });
        }
      });
    }

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
      cancelAnimationFrame(rafId);
    };
  }, []);
}
