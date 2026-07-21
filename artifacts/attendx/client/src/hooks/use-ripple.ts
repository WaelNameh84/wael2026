/**
 * useRipple — hook لإضافة تأثير موجة عند ضغط أي زر
 * استخدم: const rippleRef = useRipple(); ثم ضع ref={rippleRef} على العنصر
 */
import { useCallback, useRef } from "react";

export function useRipple<T extends HTMLElement = HTMLButtonElement>() {
  const ref = useRef<T>(null);

  const trigger = useCallback((e: React.MouseEvent<T>) => {
    const el = ref.current;
    if (!el) return;

    // Position the ripple relative to where was clicked
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Inject a span ripple element
    const ripple = document.createElement("span");
    const size   = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `
      position:absolute;
      border-radius:50%;
      background:currentColor;
      opacity:0.18;
      pointer-events:none;
      width:${size}px;
      height:${size}px;
      left:${x - size / 2}px;
      top:${y - size / 2}px;
      transform:scale(0);
      animation:ripple-expand 0.55s ease-out forwards;
    `;
    // Ensure the button has relative positioning for the absolute child
    const pos = getComputedStyle(el).position;
    if (pos === "static") el.style.position = "relative";
    el.style.overflow = "hidden";
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, []);

  return { ref, onMouseDown: trigger };
}
