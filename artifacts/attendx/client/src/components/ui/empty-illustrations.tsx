/**
 * Beautiful SVG empty-state illustrations for AttendX.
 * Each illustration is self-contained — no external deps.
 */

import { cn } from "@/lib/utils";

/* ── shared wrapper ────────────────────────────────────────────── */
interface IllustrationProps {
  className?: string;
}

/* ── 1. No employees ─────────────────────────────────────────── */
export function NoEmployeesIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      {/* Background circle */}
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* People silhouettes */}
      <circle cx="80" cy="62" r="14" className="fill-primary/20" />
      <path d="M56 100c0-13.3 10.7-24 24-24s24 10.7 24 24" className="fill-primary/20" />
      <circle cx="120" cy="62" r="14" className="fill-primary/10" />
      <path d="M96 100c0-13.3 10.7-24 24-24s24 10.7 24 24" className="fill-primary/10" />
      {/* Plus icon */}
      <circle cx="130" cy="46" r="10" className="fill-primary" />
      <path d="M130 41v10M125 46h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Dots */}
      <circle cx="40" cy="130" r="3" className="fill-primary/20" />
      <circle cx="160" cy="120" r="5" className="fill-primary/10" />
      <circle cx="170" cy="50" r="4" className="fill-primary/15" />
    </svg>
  );
}

/* ── 2. No attendance records ─────────────────────────────────── */
export function NoAttendanceIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Clock face */}
      <circle cx="100" cy="78" r="32" className="fill-card stroke-primary/30" strokeWidth="2" />
      <circle cx="100" cy="78" r="3" className="fill-primary" />
      {/* Clock hands */}
      <line x1="100" y1="78" x2="100" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary" />
      <line x1="100" y1="78" x2="116" y2="88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-foreground" />
      {/* Tick marks */}
      <line x1="100" y1="48" x2="100" y2="52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
      <line x1="100" y1="104" x2="100" y2="108" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
      <line x1="70" y1="78" x2="74" y2="78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
      <line x1="126" y1="78" x2="130" y2="78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/40" />
      {/* Floating dots */}
      <circle cx="50" cy="46" r="4" className="fill-primary/15" />
      <circle cx="155" cy="60" r="6" className="fill-primary/10" />
      <circle cx="42" cy="110" r="3" className="fill-primary/20" />
    </svg>
  );
}

/* ── 3. No messages ───────────────────────────────────────────── */
export function NoMessagesIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Message bubble */}
      <rect x="52" y="46" width="96" height="64" rx="12" className="fill-card stroke-primary/30" strokeWidth="2" />
      {/* Lines inside */}
      <line x1="68" y1="66" x2="132" y2="66" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/30" />
      <line x1="68" y1="78" x2="120" y2="78" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/20" />
      <line x1="68" y1="90" x2="108" y2="90" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/20" />
      {/* Bubble tail */}
      <path d="M68 110l-12 14 24-6" className="fill-card stroke-primary/30" strokeWidth="2" />
      {/* Dots decoration */}
      <circle cx="160" cy="44" r="5" className="fill-primary/15" />
      <circle cx="40" cy="56" r="3" className="fill-primary/20" />
      <circle cx="155" cy="120" r="4" className="fill-primary/10" />
    </svg>
  );
}

/* ── 4. No leave requests ─────────────────────────────────────── */
export function NoLeaveIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Calendar */}
      <rect x="56" y="44" width="88" height="80" rx="8" className="fill-card stroke-primary/30" strokeWidth="2" />
      {/* Header bar */}
      <rect x="56" y="44" width="88" height="22" rx="8" className="fill-primary/20" />
      {/* Calendar dots */}
      <rect x="56" y="56" width="88" height="10" className="fill-primary/20" />
      <circle cx="74" cy="46" r="4" className="fill-primary" />
      <circle cx="126" cy="46" r="4" className="fill-primary" />
      {/* Grid days */}
      <rect x="66" y="78" width="10" height="10" rx="2" className="fill-primary/20" />
      <rect x="82" y="78" width="10" height="10" rx="2" className="fill-primary/10" />
      <rect x="98" y="78" width="10" height="10" rx="2" className="fill-primary/20" />
      <rect x="114" y="78" width="10" height="10" rx="2" className="fill-primary/10" />
      <rect x="66" y="94" width="10" height="10" rx="2" className="fill-primary/10" />
      <rect x="82" y="94" width="10" height="10" rx="2" className="fill-primary/20" />
      {/* Checkmark on one day */}
      <rect x="98" y="94" width="10" height="10" rx="2" className="fill-emerald-500/30" />
      <path d="M100 99l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="160" cy="44" r="5" className="fill-primary/10" />
      <circle cx="40" cy="120" r="4" className="fill-primary/15" />
    </svg>
  );
}

/* ── 5. No reports / data ─────────────────────────────────────── */
export function NoReportsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Document */}
      <rect x="62" y="36" width="72" height="88" rx="8" className="fill-card stroke-primary/30" strokeWidth="2" />
      {/* Header line */}
      <line x1="74" y1="54" x2="122" y2="54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/40" />
      {/* Bar chart lines */}
      <rect x="74" y="80" width="8" height="28" rx="2" className="fill-primary/20" />
      <rect x="88" y="68" width="8" height="40" rx="2" className="fill-primary/35" />
      <rect x="102" y="74" width="8" height="34" rx="2" className="fill-primary/25" />
      <rect x="116" y="62" width="8" height="46" rx="2" className="fill-primary/40" />
      {/* Magnifier */}
      <circle cx="136" cy="44" r="12" className="fill-primary/10 stroke-primary/40" strokeWidth="1.5" />
      <line x1="145" y1="53" x2="154" y2="62" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/50" />
      <circle cx="40" cy="106" r="4" className="fill-primary/15" />
      <circle cx="170" cy="100" r="3" className="fill-primary/10" />
    </svg>
  );
}

/* ── 6. No announcements ──────────────────────────────────────── */
export function NoAnnouncementsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Megaphone */}
      <path d="M60 68h20l30-18v56l-30-18H60V68z" className="fill-primary/20 stroke-primary/40" strokeWidth="2" strokeLinejoin="round" />
      <rect x="46" y="68" width="14" height="22" rx="4" className="fill-primary/15 stroke-primary/40" strokeWidth="2" />
      {/* Sound waves */}
      <path d="M118 66c5 4 8 9 8 14s-3 10-8 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-primary/40" fill="none" />
      <path d="M126 58c9 7 14 17 14 22s-5 15-14 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-primary/25" fill="none" />
      {/* Sparkles */}
      <circle cx="155" cy="42" r="3" className="fill-primary/20" />
      <circle cx="46" cy="42" r="5" className="fill-primary/15" />
      <circle cx="48" cy="118" r="3" className="fill-primary/10" />
    </svg>
  );
}

/* ── 7. Generic / search empty ────────────────────────────────── */
export function NoResultsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Big magnifier */}
      <circle cx="94" cy="74" r="28" className="fill-card stroke-primary/30" strokeWidth="2.5" />
      <line x1="114" y1="96" x2="132" y2="116" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-primary/40" />
      {/* X inside */}
      <line x1="84" y1="64" x2="104" y2="84" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-rose-400/60" />
      <line x1="104" y1="64" x2="84" y2="84" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-rose-400/60" />
      <circle cx="50" cy="48" r="4" className="fill-primary/15" />
      <circle cx="158" cy="56" r="5" className="fill-primary/10" />
      <circle cx="44" cy="118" r="3" className="fill-primary/20" />
    </svg>
  );
}

/* ── 8. No payroll records ────────────────────────────────────── */
export function NoPayrollIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("w-40 h-32", className)} aria-hidden="true">
      <circle cx="100" cy="80" r="60" className="fill-primary/5" />
      {/* Banknote */}
      <rect x="44" y="56" width="112" height="64" rx="10" className="fill-card stroke-primary/30" strokeWidth="2" />
      <circle cx="100" cy="88" r="18" className="fill-primary/10 stroke-primary/25" strokeWidth="1.5" />
      {/* Dollar sign */}
      <text x="95" y="93" fontSize="16" fontWeight="bold" className="fill-primary/50" fill="currentColor" style={{ fill: "hsl(var(--primary) / 0.5)" }}>$</text>
      {/* Dots on banknote */}
      <circle cx="58" cy="72" r="4" className="fill-primary/15" />
      <circle cx="58" cy="104" r="4" className="fill-primary/15" />
      <circle cx="142" cy="72" r="4" className="fill-primary/15" />
      <circle cx="142" cy="104" r="4" className="fill-primary/15" />
      <circle cx="38" cy="44" r="4" className="fill-primary/10" />
      <circle cx="166" cy="124" r="5" className="fill-primary/10" />
    </svg>
  );
}
