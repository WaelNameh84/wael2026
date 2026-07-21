/**
 * AnimatedNumber — عداد رقمي متحرك
 * يعدّ من 0 إلى القيمة المستهدفة مع تأثير spring
 */
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;   // ms
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function useCountUp(target: number, duration = 1200) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number | null>(null);
  const prevTarget = useRef<number>(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const from = prevTarget.current;
    prevTarget.current = target;
    startRef.current = null;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCurrent(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return current;
}

export default function AnimatedNumber({ value, duration = 1200, decimals = 0, prefix = "", suffix = "", className = "" }: AnimatedNumberProps) {
  const current = useCountUp(value, duration);
  const display = decimals > 0 ? current.toFixed(decimals) : current.toLocaleString();
  return (
    <span className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
