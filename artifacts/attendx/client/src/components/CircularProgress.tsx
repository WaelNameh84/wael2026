/**
 * CircularProgress — مؤشر دائري تفاعلي متحرك
 * SVG-based مع تأثير stroke-dashoffset
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface CircularProgressProps {
  value: number;          // 0-100
  size?: number;          // px
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  children?: React.ReactNode;
  animated?: boolean;
  glowColor?: string;
}

export default function CircularProgress({
  value,
  size = 120,
  strokeWidth = 10,
  color = "hsl(var(--primary))",
  trackColor = "hsl(var(--border))",
  label,
  sublabel,
  children,
  animated = true,
  glowColor,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) { setDisplayValue(value); return; }
    startRef.current = null;
    const from = displayValue;
    const duration = 1400;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
      setDisplayValue(from + (value - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const offset = circumference - (displayValue / 100) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
          {/* Glow filter */}
          {glowColor && (
            <defs>
              <filter id={`glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
          )}

          {/* Track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.05s linear", filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
          />
        </svg>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          {children ?? (
            <>
              <span className="text-2xl font-bold tabular-nums leading-none">
                {Math.round(displayValue)}%
              </span>
              {sublabel && <span className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</span>}
            </>
          )}
        </div>
      </div>
      {label && <p className="text-xs text-muted-foreground font-medium text-center">{label}</p>}
    </div>
  );
}

/* ── Multi-ring compact variant ── */
export function AttendanceSummaryRings({
  present, late, absent, total, isArabic,
}: { present: number; late: number; absent: number; total: number; isArabic: boolean }) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const rings = [
    { label: isArabic ? "حاضر" : "Present",  value: pct(present), color: "#22c55e", glow: "#22c55e88" },
    { label: isArabic ? "متأخر" : "Late",    value: pct(late),    color: "#f97316", glow: "#f9731688" },
    { label: isArabic ? "غائب" : "Absent",   value: pct(absent),  color: "#ef4444", glow: "#ef444488" },
  ];

  return (
    <div className="flex items-center justify-around gap-4 flex-wrap">
      {rings.map(r => (
        <CircularProgress
          key={r.label}
          value={r.value}
          size={90}
          strokeWidth={8}
          color={r.color}
          glowColor={r.glow}
          label={r.label}
          sublabel={`${r.value}%`}
        >
          <motion.span
            className="text-lg font-bold tabular-nums"
            style={{ color: r.color }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            {r.value}%
          </motion.span>
        </CircularProgress>
      ))}
    </div>
  );
}
