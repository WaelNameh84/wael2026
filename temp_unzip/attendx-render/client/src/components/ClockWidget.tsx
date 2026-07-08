import { useEffect, useState } from "react";
import { useSettings, ClockFormat, ClockLocale, ClockStyle, ClockSize } from "@/hooks/use-settings";

/* ── Helpers ─────────────────────────────────────────────────── */
function getLocaleCode(l: ClockLocale) {
  if (l === "ar") return "ar-SA";
  if (l === "sv") return "sv-SE";
  return "en-GB";
}
function formatTime(d: Date, fmt: ClockFormat, loc: ClockLocale) {
  return d.toLocaleTimeString(getLocaleCode(loc), {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: fmt === "12h",
  });
}
function formatDate(d: Date, loc: ClockLocale) {
  return d.toLocaleDateString(getLocaleCode(loc), {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const sizeMap: Record<ClockSize, { time: string; date: string; face: number; pad: string }> = {
  small:  { time: "text-2xl",  date: "text-[10px]", face: 100, pad: "p-3" },
  medium: { time: "text-4xl",  date: "text-xs",     face: 150, pad: "p-4" },
  large:  { time: "text-6xl",  date: "text-sm",     face: 200, pad: "p-5" },
};

/* ── 1. Digital — LED dots ──────────────────────────────────── */
function DigitalClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.pad}`}>
      <div className={`font-mono font-bold tabular-nums tracking-[0.12em] text-primary ${s.time}`}
        style={{ fontVariantNumeric: "tabular-nums" }}>
        {time}
      </div>
      <div className={`text-muted-foreground tracking-wide ${s.date}`}>{date}</div>
    </div>
  );
}

/* ── 2. Boxed — each group in a glass card ─────────────────── */
function BoxedClock({ now, fmt, loc, size }: { now: Date; fmt: ClockFormat; loc: ClockLocale; size: ClockSize }) {
  const s = sizeMap[size];
  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(now.getHours() % (fmt === "12h" ? 12 : 24) || (fmt === "12h" ? 12 : 0));
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const ampm = fmt === "12h" ? (now.getHours() >= 12 ? "PM" : "AM") : null;
  const parts = [hh, mm, ss];

  const boxSize = size === "small" ? "text-2xl w-14 h-16" : size === "large" ? "text-5xl w-24 h-28" : "text-3xl w-18 h-20";

  return (
    <div className={`flex flex-col items-center gap-2 ${s.pad}`}>
      <div className="flex items-center gap-1.5">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 font-mono font-bold tabular-nums text-primary shadow-inner ${boxSize}`}
              style={{ minWidth: size === "small" ? 52 : size === "large" ? 88 : 68 }}>
              {p}
            </div>
            {i < 2 && (
              <span className={`font-bold text-primary/60 ${size === "large" ? "text-4xl" : size === "small" ? "text-xl" : "text-2xl"} mb-1`}>:</span>
            )}
          </div>
        ))}
        {ampm && (
          <span className="text-xs font-bold text-primary/70 self-end mb-3 ms-1">{ampm}</span>
        )}
      </div>
      <div className={`text-muted-foreground ${s.date}`}>{formatDate(now, loc)}</div>
    </div>
  );
}

/* ── 3. Neon — multi-color glow ─────────────────────────────── */
function NeonClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.pad} rounded-xl bg-gray-950`}>
      <div className={`font-mono font-bold tabular-nums tracking-widest ${s.time}`}
        style={{
          background: "linear-gradient(90deg, #ff00ff, #00f5ff, #ff00ff)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "neonShift 3s linear infinite",
          filter: "drop-shadow(0 0 8px #ff00ff88) drop-shadow(0 0 16px #00f5ff44)",
        }}>
        {time}
      </div>
      <div className="text-cyan-400/60 tracking-widest uppercase" style={{ textShadow: "0 0 8px #00f5ff55", fontSize: size === "large" ? 12 : 10 }}>
        {date}
      </div>
      <style>{`@keyframes neonShift { to { background-position: 200% center; } }`}</style>
    </div>
  );
}

/* ── 4. Retro — green terminal ──────────────────────────────── */
function RetroClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1 ${s.pad} rounded-xl`}
      style={{ background: "#0a0f0a", border: "1px solid #00ff4133" }}>
      <div className={`font-mono font-bold tabular-nums tracking-widest ${s.time}`}
        style={{ color: "#00ff41", textShadow: "0 0 10px #00ff41, 0 0 20px #00ff4166", fontFamily: "'Courier New', monospace" }}>
        {time}
      </div>
      <div className="font-mono uppercase tracking-[0.2em]"
        style={{ color: "#00ff4188", fontSize: size === "large" ? 11 : 9, textShadow: "0 0 6px #00ff4144" }}>
        {date}
      </div>
      <div className="font-mono" style={{ color: "#00ff4133", fontSize: 8, letterSpacing: "0.3em" }}>
        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
      </div>
    </div>
  );
}

/* ── 5. Gradient — rainbow shimmer ──────────────────────────── */
function GradientClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.pad}`}>
      <div
        className={`font-bold tabular-nums tracking-widest ${s.time}`}
        style={{
          background: "linear-gradient(135deg, #f97316, #ec4899, #8b5cf6, #06b6d4, #10b981)",
          backgroundSize: "300% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "gradShift 5s ease infinite",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {time}
      </div>
      <div className={`text-muted-foreground ${s.date}`}>{date}</div>
      <style>{`@keyframes gradShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
    </div>
  );
}

/* ── 6. Glass — frosted card ────────────────────────────────── */
function GlassClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.pad} rounded-2xl relative overflow-hidden`}
      style={{
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)",
      }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%)" }} />
      <div className={`font-mono font-bold tabular-nums tracking-widest text-foreground relative z-10 ${s.time}`}>
        {time}
      </div>
      <div className={`text-muted-foreground relative z-10 ${s.date}`}>{date}</div>
    </div>
  );
}

/* ── 7. Flip ────────────────────────────────────────────────── */
function FlipCard({ value }: { value: string }) {
  const [cur, setCur] = useState(value);
  const [prev, setPrev] = useState(value);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (value !== cur) {
      setPrev(cur);
      setFlipping(true);
      const t = setTimeout(() => { setCur(value); setFlipping(false); }, 280);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className="relative" style={{ perspective: "300px" }}>
      <div className="w-[2.1ch] h-[1.3em] rounded-md overflow-hidden font-mono font-bold tabular-nums text-center
        bg-zinc-800 border border-zinc-600 shadow-lg flex items-center justify-center text-amber-300 select-none"
        style={{ transformStyle: "preserve-3d" }}>
        <span>{cur}</span>
        {flipping && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-amber-300 rounded-md"
            style={{ animation: "flipAnim 0.28s ease-in-out", transformOrigin: "50% 100%", backfaceVisibility: "hidden" }}>
            {prev}
          </div>
        )}
      </div>
      <style>{`@keyframes flipAnim { 0%{transform:rotateX(0)} 50%{transform:rotateX(-90deg)} 100%{transform:rotateX(0)} }`}</style>
    </div>
  );
}

function FlipClock({ now, size }: { now: Date; size: ClockSize }) {
  const s = sizeMap[size];
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <div className={`flex flex-col items-center gap-2 ${s.pad} rounded-xl bg-zinc-900`}>
      <div className={`flex items-center gap-1 ${s.time}`}>
        <FlipCard value={p(now.getHours())} />
        <span className="text-amber-500 font-bold mb-0.5">:</span>
        <FlipCard value={p(now.getMinutes())} />
        <span className="text-amber-500 font-bold mb-0.5">:</span>
        <FlipCard value={p(now.getSeconds())} />
      </div>
    </div>
  );
}

/* ── 8. Analog ──────────────────────────────────────────────── */
function AnalogClock({ now, size }: { now: Date; size: ClockSize }) {
  const dim = sizeMap[size].face;
  const cx = dim / 2;
  const r = cx - 8;
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const ang = (v: number, max: number) => ((v / max) * 360 - 90) * (Math.PI / 180);
  const pt = (a: number, len: number) => ({ x: cx + len * Math.cos(a), y: cx + len * Math.sin(a) });
  const secA = ang(s, 60), minA = ang(m, 60), hrA = ang(h, 12);

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="select-none">
      <defs>
        <radialGradient id="faceGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="hsl(var(--card))" />
          <stop offset="100%" stopColor="hsl(var(--muted))" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cx} r={r + 6} fill="hsl(var(--primary))" opacity="0.15" />
      <circle cx={cx} cy={cx} r={r} fill="url(#faceGrad)" stroke="hsl(var(--border))" strokeWidth="1.5" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
        const isMaj = i % 5 === 0;
        const inner = r - (isMaj ? 13 : 7);
        return <line key={i}
          x1={cx + inner * Math.cos(a)} y1={cx + inner * Math.sin(a)}
          x2={cx + r * Math.cos(a)}     y2={cx + r * Math.sin(a)}
          stroke={isMaj ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
          strokeWidth={isMaj ? 2 : 0.8} strokeOpacity={isMaj ? 0.85 : 0.35} />;
      })}
      {[3,6,9,12].map(n => {
        const a = ((n / 12) * 360 - 90) * (Math.PI / 180);
        return <text key={n} x={cx + (r - 22) * Math.cos(a)} y={cx + (r - 22) * Math.sin(a)}
          textAnchor="middle" dominantBaseline="central"
          fontSize={dim < 130 ? 8 : 10} fontWeight="600" fill="hsl(var(--foreground))" opacity="0.75">{n}</text>;
      })}
      <line x1={cx} y1={cx} x2={pt(hrA, r * 0.52).x}  y2={pt(hrA, r * 0.52).y}
        stroke="hsl(var(--foreground))" strokeWidth={dim < 130 ? 3.5 : 5} strokeLinecap="round" />
      <line x1={cx} y1={cx} x2={pt(minA, r * 0.72).x} y2={pt(minA, r * 0.72).y}
        stroke="hsl(var(--foreground))" strokeWidth={dim < 130 ? 2.5 : 3.5} strokeLinecap="round" />
      <line
        x1={cx - 12 * Math.cos(secA)} y1={cx - 12 * Math.sin(secA)}
        x2={pt(secA, r * 0.85).x}     y2={pt(secA, r * 0.85).y}
        stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={cx} cy={cx} r={5}  fill="hsl(var(--primary))" />
      <circle cx={cx} cy={cx} r={2.5} fill="hsl(var(--card))" />
    </svg>
  );
}

/* ── 9. Minimal ─────────────────────────────────────────────── */
function MinimalClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1 ${s.pad}`}>
      <div className={`font-extralight tabular-nums tracking-[0.2em] text-foreground ${s.time}`}>
        {time}
      </div>
      <div className={`text-muted-foreground/50 font-light tracking-widest uppercase ${s.date}`}>{date}</div>
    </div>
  );
}

/* ── 10. Neon Tube ──────────────────────────────────────────── */
function NeonTubeClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  const chars = time.split("");
  const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff"];
  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.pad} rounded-xl`}
      style={{ background: "#0d0d0d", border: "1px solid #ffffff11" }}>
      <div className={`flex items-center font-mono font-bold tabular-nums tracking-widest ${s.time}`}>
        {chars.map((c, i) => {
          const col = c.match(/[0-9]/) ? colors[Math.floor(i / 2) % colors.length] : "#ffffff44";
          return (
            <span key={i} style={{
              color: col,
              textShadow: c.match(/[0-9]/) ? `0 0 8px ${col}, 0 0 20px ${col}88, 0 0 40px ${col}44` : "none",
              transition: "color 0.3s",
            }}>{c}</span>
          );
        })}
      </div>
      <div style={{ color: "#ffffff33", fontSize: size === "large" ? 11 : 9, letterSpacing: "0.2em" }}>{date}</div>
    </div>
  );
}

/* ── 11. Aurora ─────────────────────────────────────────────── */
function AuroraClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1.5 ${s.pad} rounded-2xl relative overflow-hidden`}
      style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 30% 50%, rgba(120,40,200,0.35) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(0,200,255,0.25) 0%, transparent 60%)",
        animation: "auroraMove 8s ease-in-out infinite alternate",
      }} />
      <style>{`@keyframes auroraMove { 0%{transform:translateX(-5%) scaleY(1)} 100%{transform:translateX(5%) scaleY(1.1)} }`}</style>
      <div className={`font-mono font-bold tabular-nums tracking-widest relative z-10 ${s.time}`}
        style={{
          background: "linear-gradient(90deg, #a78bfa, #38bdf8, #34d399, #a78bfa)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "gradShift 5s ease infinite",
          filter: "drop-shadow(0 0 12px #a78bfa88)",
        }}>
        {time}
      </div>
      <div className="relative z-10" style={{ color: "#94a3b8", fontSize: size === "large" ? 11 : 9, letterSpacing: "0.15em" }}>{date}</div>
    </div>
  );
}

/* ── 12. Matrix ─────────────────────────────────────────────── */
function MatrixClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1 ${s.pad} rounded-xl relative overflow-hidden`}
      style={{ background: "#000", border: "1px solid #00ff4122" }}>
      <div className={`font-mono font-bold tabular-nums tracking-[0.15em] ${s.time}`}
        style={{
          color: "#00ff41",
          textShadow: "0 0 6px #00ff41, 0 0 12px #00ff4188, 0 0 24px #00ff4144",
          fontFamily: "'Courier New', monospace",
        }}>
        {time}
      </div>
      <div style={{ color: "#00ff4166", fontSize: size === "large" ? 10 : 8, letterSpacing: "0.25em", fontFamily: "monospace" }}>
        {date}
      </div>
      <div style={{ color: "#00ff4122", fontSize: 7, letterSpacing: "0.2em", fontFamily: "monospace" }}>
        01001000 01000101 01001100
      </div>
    </div>
  );
}

/* ── 13. Neon Ring ───────────────────────────────────────────── */
function NeonRingClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  const ringSize = size === "small" ? 110 : size === "large" ? 200 : 150;
  return (
    <div className={`flex flex-col items-center gap-1 ${s.pad} rounded-2xl`}
      style={{ background: "#0a0a0f" }}>
      <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
        <svg className="absolute inset-0" width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
          <circle cx={ringSize/2} cy={ringSize/2} r={ringSize/2-4} fill="none"
            stroke="url(#neonRingGrad)" strokeWidth="3" strokeDasharray="8 4"
            style={{ animation: "neonSpin 10s linear infinite", transformOrigin: "center" }} />
          <defs>
            <linearGradient id="neonRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff00ff" />
              <stop offset="50%" stopColor="#00f5ff" />
              <stop offset="100%" stopColor="#ff00ff" />
            </linearGradient>
          </defs>
        </svg>
        <style>{`@keyframes neonSpin { to { stroke-dashoffset: -100; } }`}</style>
        <div className={`font-mono font-bold tabular-nums tracking-wider text-center ${s.time}`}
          style={{
            color: "#f0f0ff",
            textShadow: "0 0 10px #a78bfa, 0 0 20px #a78bfa88",
            fontSize: size === "large" ? 36 : size === "small" ? 22 : 28,
          }}>
          {time}
        </div>
      </div>
      <div style={{ color: "#a78bfa88", fontSize: size === "large" ? 10 : 8, letterSpacing: "0.2em" }}>{date}</div>
    </div>
  );
}

/* ── 14. Wave ───────────────────────────────────────────────── */
function WaveClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sizeMap[size];
  return (
    <div className={`flex flex-col items-center gap-1 ${s.pad} rounded-2xl relative overflow-hidden`}
      style={{ background: "linear-gradient(180deg, #0ea5e9 0%, #0369a1 100%)" }}>
      <div className={`font-bold tabular-nums tracking-widest text-white relative z-10 ${s.time}`}
        style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)", fontVariantNumeric: "tabular-nums" }}>
        {time}
      </div>
      <div style={{ color: "rgba(255,255,255,0.75)", fontSize: size === "large" ? 11 : 9, letterSpacing: "0.1em", position: "relative", zIndex: 1 }}>{date}</div>
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden" style={{ height: "35%" }}>
        <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,30 Q50,5 100,30 T200,30 T300,30 T400,30 L400,60 L0,60 Z" fill="rgba(255,255,255,0.15)"
            style={{ animation: "waveAnim 3s ease-in-out infinite" }} />
          <path d="M0,40 Q60,18 120,40 T240,40 T360,40 T480,40 L480,60 L0,60 Z" fill="rgba(255,255,255,0.1)"
            style={{ animation: "waveAnim 5s ease-in-out infinite reverse" }} />
        </svg>
      </div>
      <style>{`@keyframes waveAnim { 0%,100%{d:path("M0,30 Q50,5 100,30 T200,30 T300,30 T400,30 L400,60 L0,60 Z")} 50%{d:path("M0,20 Q50,45 100,20 T200,20 T300,20 T400,20 L400,60 L0,60 Z")} }`}</style>
    </div>
  );
}

/* ── 15. Calendar ───────────────────────────────────────────── */
function CalendarClock({ now, fmt, loc, size }: { now: Date; fmt: ClockFormat; loc: ClockLocale; size: ClockSize }) {
  const s = sizeMap[size];
  const dayNames = { en: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], ar: ["أحد","اثن","ثلا","أرب","خمس","جمع","سبت"], sv: ["Sön","Mån","Tis","Ons","Tor","Fre","Lör"] };
  const monthNames = { en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], ar: ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"], sv: ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"] };
  const time = formatTime(now, fmt, loc);
  const day = dayNames[loc][now.getDay()];
  const month = monthNames[loc][now.getMonth()];
  return (
    <div className={`flex items-center gap-3 ${s.pad} rounded-2xl bg-card border border-border shadow`}>
      <div className="flex flex-col items-center rounded-xl overflow-hidden" style={{ minWidth: size === "large" ? 72 : size === "small" ? 48 : 60 }}>
        <div className="w-full flex items-center justify-center py-1 text-[10px] font-bold tracking-widest uppercase bg-primary text-primary-foreground">
          {month}
        </div>
        <div className={`flex items-center justify-center font-extrabold text-foreground ${size === "large" ? "text-5xl py-2" : size === "small" ? "text-3xl py-1" : "text-4xl py-1.5"}`}
          style={{ minWidth: size === "large" ? 72 : size === "small" ? 48 : 60 }}>
          {now.getDate()}
        </div>
        <div className="w-full flex items-center justify-center py-0.5 text-[9px] font-semibold uppercase bg-muted text-muted-foreground tracking-wider">
          {day}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className={`font-mono font-bold tabular-nums text-primary ${size === "large" ? "text-3xl" : size === "small" ? "text-xl" : "text-2xl"}`}>
          {time}
        </div>
        <div className="text-[10px] text-muted-foreground">{now.getFullYear()}</div>
      </div>
    </div>
  );
}

/* ── Main Export ─────────────────────────────────────────────── */
export default function ClockWidget({ className = "" }: { className?: string }) {
  const { clockFormat, clockLocale, clockStyle, clockSize } = useSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatTime(now, clockFormat, clockLocale);
  const date = formatDate(now, clockLocale);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {clockStyle === "digital"   && <DigitalClock  time={time} date={date} size={clockSize} />}
      {clockStyle === "boxed"     && <BoxedClock    now={now} fmt={clockFormat} loc={clockLocale} size={clockSize} />}
      {clockStyle === "neon"      && <NeonClock     time={time} date={date} size={clockSize} />}
      {clockStyle === "retro"     && <RetroClock    time={time} date={date} size={clockSize} />}
      {clockStyle === "gradient"  && <GradientClock time={time} date={date} size={clockSize} />}
      {clockStyle === "glass"     && <GlassClock    time={time} date={date} size={clockSize} />}
      {clockStyle === "flip"      && <FlipClock     now={now} size={clockSize} />}
      {clockStyle === "analog"    && (
        <div className="flex flex-col items-center gap-1.5 p-2">
          <AnalogClock now={now} size={clockSize} />
          <span className={`text-muted-foreground ${sizeMap[clockSize].date}`}>{date}</span>
        </div>
      )}
      {clockStyle === "minimal"   && <MinimalClock   time={time} date={date} size={clockSize} />}
      {clockStyle === "neontube"  && <NeonTubeClock  time={time} date={date} size={clockSize} />}
      {clockStyle === "aurora"    && <AuroraClock    time={time} date={date} size={clockSize} />}
      {clockStyle === "matrix"    && <MatrixClock    time={time} date={date} size={clockSize} />}
      {clockStyle === "neonring"  && <NeonRingClock  time={time} date={date} size={clockSize} />}
      {clockStyle === "wave"      && <WaveClock      time={time} date={date} size={clockSize} />}
      {clockStyle === "calendar"  && <CalendarClock  now={now} fmt={clockFormat} loc={clockLocale} size={clockSize} />}
    </div>
  );
}
