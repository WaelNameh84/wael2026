/**
 * WelcomeBanner — Dashboard hero banner with 4 selectable styles:
 *   gradient  → time-of-day coloured gradient (original)
 *   glass     → frosted glassmorphism card
 *   card      → dark elegant card
 *   minimal   → clean light card with accent strip
 */
import { useMemo } from "react";
import { format } from "date-fns";
import { Radio, LogOut, Sparkles, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import ClockWidget from "@/components/ClockWidget";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-url";
import type { WelcomeShape, WelcomeStyle } from "@/hooks/use-settings";

interface Session { checkIn: string; checkOut?: string | null }
interface TodayAtt { status?: string | null }

interface WelcomeBannerProps {
  now: Date;
  name: string;
  t: (key: string, vars?: Record<string, string>) => string;
  todayAtt?: TodayAtt | null;
  currentlyCheckedIn: boolean;
  sessions: Session[];
  isArabic: boolean;
  enabled?: boolean;
  welcomeMessage?: string;
  onEditMessage?: () => void;
  welcomeShape?: WelcomeShape;
  welcomeImage?: string;
  welcomeTitle?: string;
  welcomeStyle?: WelcomeStyle;
}

/* ── Time-slot config ─────────────────────────────────────────────── */
interface TimeSlot {
  gradient: string; gradientAlt: string; glowColor: string;
  orb1Color: string; orb2Color: string; patternColor: string;
  greetingKey: "good_morning" | "good_afternoon" | "good_evening";
  icon: string; label: string; labelAr: string; scanColor: string;
  accent: string; // for glass/card/minimal accent strip
}

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 5 && hour < 12) return {
    gradient: "linear-gradient(135deg,#f59e0b 0%,#f97316 50%,#ef4444 100%)",
    gradientAlt: "linear-gradient(225deg,#fbbf24 0%,#f97316 60%,#dc2626 100%)",
    glowColor: "rgba(251,146,60,0.35)", orb1Color: "#fde68a", orb2Color: "#fed7aa",
    patternColor: "rgba(255,255,255,0.14)", scanColor: "rgba(255,255,255,0.06)",
    greetingKey: "good_morning", icon: "☀️", label: "Good morning", labelAr: "صباح الخير",
    accent: "#f97316",
  };
  if (hour >= 12 && hour < 17) return {
    gradient: "linear-gradient(135deg,#0284c7 0%,#0ea5e9 50%,#06b6d4 100%)",
    gradientAlt: "linear-gradient(225deg,#0369a1 0%,#0ea5e9 60%,#22d3ee 100%)",
    glowColor: "rgba(14,165,233,0.35)", orb1Color: "#bae6fd", orb2Color: "#a5f3fc",
    patternColor: "rgba(255,255,255,0.12)", scanColor: "rgba(255,255,255,0.05)",
    greetingKey: "good_afternoon", icon: "🌤️", label: "Good afternoon", labelAr: "مساء النور",
    accent: "#0ea5e9",
  };
  if (hour >= 17 && hour < 21) return {
    gradient: "linear-gradient(135deg,#7c3aed 0%,#db2777 50%,#f97316 100%)",
    gradientAlt: "linear-gradient(225deg,#6d28d9 0%,#ec4899 60%,#f97316 100%)",
    glowColor: "rgba(219,39,119,0.35)", orb1Color: "#ddd6fe", orb2Color: "#fbcfe8",
    patternColor: "rgba(255,255,255,0.12)", scanColor: "rgba(255,255,255,0.06)",
    greetingKey: "good_evening", icon: "🌅", label: "Good evening", labelAr: "مساء الخير",
    accent: "#db2777",
  };
  return {
    gradient: "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 100%)",
    gradientAlt: "linear-gradient(225deg,#1e1b4b 0%,#4338ca 60%,#6d28d9 100%)",
    glowColor: "rgba(99,102,241,0.40)", orb1Color: "#c7d2fe", orb2Color: "#ddd6fe",
    patternColor: "rgba(255,255,255,0.10)", scanColor: "rgba(255,255,255,0.04)",
    greetingKey: "good_evening", icon: "🌙", label: "Good night", labelAr: "تصبح على خير",
    accent: "#6366f1",
  };
}

function statusStyle(status: string | null | undefined) {
  if (status === "present") return { border: "border-emerald-400/40", bg: "bg-emerald-500/30", text: "text-emerald-100" };
  if (status === "late")    return { border: "border-amber-400/40",   bg: "bg-amber-500/30",   text: "text-amber-100"   };
  if (status === "absent")  return { border: "border-red-400/40",     bg: "bg-red-500/30",     text: "text-red-100"     };
  return { border: "border-white/20", bg: "bg-white/20", text: "text-white" };
}

/* ── 3-D CSS Shapes ───────────────────────────────────────────────── */
function Shape3D({ shape }: { shape: WelcomeShape }) {
  if (shape === "none") return null;
  if (shape === "sphere") return (
    <motion.div className="absolute top-3 end-36 pointer-events-none"
      animate={{ y: [0,-8,0], rotateY: [0,360] }}
      transition={{ y: { duration:3,repeat:Infinity,ease:"easeInOut" }, rotateY: { duration:6,repeat:Infinity,ease:"linear" } }}
      style={{ width:56, height:56 }}>
      <div style={{ width:56, height:56, borderRadius:"50%",
        background:"radial-gradient(circle at 35% 35%,rgba(255,255,255,.7) 0%,rgba(255,255,255,.15) 40%,rgba(255,255,255,.05) 70%,transparent 100%)",
        boxShadow:"0 0 20px rgba(255,255,255,.3),inset -8px -8px 16px rgba(0,0,0,.2),inset 4px 4px 12px rgba(255,255,255,.4)",
        border:"1px solid rgba(255,255,255,.3)" }} />
    </motion.div>
  );
  if (shape === "cube") return (
    <motion.div className="absolute top-4 end-36 pointer-events-none" style={{ perspective:200, width:48, height:48 }}
      animate={{ y:[0,-6,0] }} transition={{ duration:3,repeat:Infinity,ease:"easeInOut" }}>
      <motion.div style={{ width:48, height:48, transformStyle:"preserve-3d", position:"relative" }}
        animate={{ rotateX:[10,25,10], rotateY:[0,360] }}
        transition={{ rotateX:{duration:4,repeat:Infinity,ease:"easeInOut"}, rotateY:{duration:5,repeat:Infinity,ease:"linear"} }}>
        {[
          { t:"translateZ(24px)", o:.25 }, { t:"translateZ(-24px) rotateY(180deg)", o:.10 },
          { t:"rotateY(-90deg) translateZ(24px)", o:.15 }, { t:"rotateY(90deg) translateZ(24px)", o:.20 },
          { t:"rotateX(90deg) translateZ(24px)", o:.35 }, { t:"rotateX(-90deg) translateZ(24px)", o:.08 },
        ].map(({t,o},i) => (
          <div key={i} style={{ position:"absolute", width:48, height:48,
            background:`rgba(255,255,255,${o})`, border:"1px solid rgba(255,255,255,.3)", transform:t }} />
        ))}
      </motion.div>
    </motion.div>
  );
  if (shape === "ring") return (
    <motion.div className="absolute top-4 end-36 pointer-events-none"
      animate={{ y:[0,-6,0], rotateX:[60,80,60] }}
      transition={{ y:{duration:3,repeat:Infinity,ease:"easeInOut"}, rotateX:{duration:4,repeat:Infinity,ease:"easeInOut"} }}
      style={{ width:56, height:56, perspective:200 }}>
      <motion.div animate={{ rotate:360 }} transition={{ duration:4,repeat:Infinity,ease:"linear" }}
        style={{ width:56, height:56, borderRadius:"50%", border:"8px solid rgba(255,255,255,.5)",
          boxShadow:"0 0 16px rgba(255,255,255,.4),inset 0 0 8px rgba(255,255,255,.2)", transform:"rotateX(70deg)" }} />
    </motion.div>
  );
  if (shape === "diamond") return (
    <motion.div className="absolute top-3 end-36 pointer-events-none"
      animate={{ y:[0,-8,0], rotate:[0,180,360] }}
      transition={{ y:{duration:3,repeat:Infinity,ease:"easeInOut"}, rotate:{duration:6,repeat:Infinity,ease:"linear"} }}
      style={{ width:48, height:48 }}>
      <div style={{ width:48, height:48,
        background:"linear-gradient(135deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.4) 100%)",
        clipPath:"polygon(50% 0%,100% 40%,50% 100%,0% 40%)",
        boxShadow:"0 0 20px rgba(255,255,255,.4)", filter:"drop-shadow(0 0 8px rgba(255,255,255,.5))" }} />
    </motion.div>
  );
  if (shape === "pyramid") return (
    <motion.div className="absolute top-3 end-36 pointer-events-none"
      animate={{ y:[0,-8,0], rotateY:[0,360] }}
      transition={{ y:{duration:3,repeat:Infinity,ease:"easeInOut"}, rotateY:{duration:5,repeat:Infinity,ease:"linear"} }}
      style={{ width:48, height:48, perspective:150 }}>
      <motion.div style={{ transformStyle:"preserve-3d", position:"relative", width:48, height:48 }}>
        <div style={{ position:"absolute", width:0, height:0,
          borderLeft:"24px solid transparent", borderRight:"24px solid transparent",
          borderBottom:"48px solid rgba(255,255,255,.35)", filter:"drop-shadow(0 0 8px rgba(255,255,255,.3))" }} />
        <div style={{ position:"absolute", left:8, top:8, width:0, height:0,
          borderLeft:"8px solid transparent", borderRight:"8px solid transparent",
          borderBottom:"16px solid rgba(255,255,255,.5)" }} />
      </motion.div>
    </motion.div>
  );
  return null;
}

/* ── Shared inner content (works across all styles) ──────────────── */
function BannerContent({
  slot, name, t, isArabic, welcomeTitle, welcomeMessage, displayIcon, isImageUrl,
  todayAtt, currentlyCheckedIn, sessions, onEditMessage, sts, textClass, subTextClass,
}: {
  slot: TimeSlot; name: string; t: (k:string, v?:Record<string,string>)=>string;
  isArabic: boolean; welcomeTitle?: string; welcomeMessage?: string;
  displayIcon: string; isImageUrl: boolean;
  todayAtt?: TodayAtt | null; currentlyCheckedIn: boolean; sessions: Session[];
  onEditMessage?: () => void;
  sts: { border: string; bg: string; text: string };
  textClass: string; subTextClass: string;
}) {
  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-1">
          {isImageUrl ? (
            <img src={apiUrl(displayIcon)} alt="" className="w-7 h-7 rounded-lg object-cover shadow" />
          ) : (
            <span className="text-2xl" role="img">{displayIcon}</span>
          )}
          <p className={cn("text-sm font-medium", subTextClass)}>
            {isArabic ? slot.labelAr : slot.label}
          </p>
          <Sparkles className={cn("w-3.5 h-3.5", subTextClass)} />
        </div>

        <h1 className={cn("text-2xl font-bold", textClass)}>
          {welcomeTitle || t("welcome_greeting", { name: name ?? "" })}
        </h1>

        <div className="flex items-center gap-1.5 mt-0.5">
          {welcomeMessage ? (
            <p className={cn("text-sm font-medium", subTextClass)}>{welcomeMessage}</p>
          ) : (
            <p className={cn("text-sm", subTextClass)}>
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          )}
          {onEditMessage && (
            <button onClick={onEditMessage}
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0">
              <Pencil className={cn("w-3.5 h-3.5", subTextClass)} />
            </button>
          )}
        </div>

        {welcomeMessage && (
          <p className={cn("text-xs mt-0.5", subTextClass, "opacity-60")}>
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        )}

        {todayAtt && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {currentlyCheckedIn ? (
              <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border", sts.bg, sts.border, sts.text)}>
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                {t("currently_checked_in")}
              </div>
            ) : (
              <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border", "bg-black/10 dark:bg-white/10 border-black/10 dark:border-white/10", textClass)}>
                <LogOut className="w-3.5 h-3.5" />
                {t("session_ended")}
              </div>
            )}
            {sessions.length > 1 && (
              <span className={cn("text-xs flex items-center gap-1", subTextClass)}>
                {sessions.length} {t("sessions_today")}
              </span>
            )}
            {todayAtt.status && (
              <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", sts.bg, sts.border, sts.text)}>
                {t(todayAtt.status) || todayAtt.status.replace("_"," ")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={cn("rounded-2xl shadow-inner flex-shrink-0 border",
        "bg-black/10 dark:bg-white/10 border-black/10 dark:border-white/10")}>
        <ClockWidget />
      </div>
    </>
  );
}

/* ── Main export ──────────────────────────────────────────────────── */
export default function WelcomeBanner({
  now, name, t, todayAtt, currentlyCheckedIn, sessions, isArabic, enabled = true,
  welcomeMessage, onEditMessage,
  welcomeShape = "none", welcomeImage = "", welcomeTitle = "",
  welcomeStyle = "gradient",
}: WelcomeBannerProps) {
  const slot = useMemo(() => getTimeSlot(now.getHours()), [now]);
  const sts  = statusStyle(todayAtt?.status);

  if (!enabled) return null;

  const displayIcon = welcomeImage || slot.icon;
  const isImageUrl  = displayIcon.startsWith("http") || displayIcon.startsWith("/") || displayIcon.startsWith("data:");

  /* ── GRADIENT style (original) ──────────────────────────────────── */
  if (welcomeStyle === "gradient") {
    return (
      <div className="relative overflow-hidden rounded-2xl text-white shadow-2xl"
        style={{ background: slot.gradient }}>
        <div className="absolute inset-0 opacity-50" style={{ background: slot.gradientAlt,
          animation: "aurora-drift 12s ease-in-out infinite alternate" }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage:`radial-gradient(circle,${slot.patternColor} 1px,transparent 1px)`, backgroundSize:"32px 32px" }} />
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex:1 }}>
          <div style={{ position:"absolute", top:0, left:"-100%", width:"40%", height:"100%",
            background:`linear-gradient(90deg,transparent,${slot.scanColor},transparent)`,
            animation:"shimmer-scan 4s ease-in-out infinite" }} />
        </div>
        <div className="absolute -top-16 -end-16 w-72 h-72 rounded-full pointer-events-none"
          style={{ background:`radial-gradient(circle,${slot.glowColor} 0%,transparent 70%)`,
            filter:"blur(28px)", animation:"aurora-drift 16s ease-in-out infinite alternate" }} />
        <div className="absolute -bottom-10 -start-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background:`radial-gradient(circle,${slot.orb2Color}22 0%,transparent 70%)`,
            filter:"blur(18px)", animation:"aurora-drift 20s ease-in-out infinite alternate-reverse" }} />
        {welcomeShape !== "none" && <Shape3D shape={welcomeShape} />}
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4 p-6">
          <BannerContent slot={slot} name={name} t={t} isArabic={isArabic}
            welcomeTitle={welcomeTitle} welcomeMessage={welcomeMessage}
            displayIcon={displayIcon} isImageUrl={isImageUrl}
            todayAtt={todayAtt} currentlyCheckedIn={currentlyCheckedIn} sessions={sessions}
            onEditMessage={onEditMessage} sts={sts}
            textClass="text-white" subTextClass="text-white/80" />
        </div>
      </div>
    );
  }

  /* ── GLASS style ────────────────────────────────────────────────── */
  if (welcomeStyle === "glass") {
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-xl border border-white/20 dark:border-white/10"
        style={{ background: "rgba(255,255,255,0.12)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" }}>
        {/* Accent glow top */}
        <div className="absolute -top-10 -end-10 w-48 h-48 rounded-full pointer-events-none"
          style={{ background:`radial-gradient(circle,${slot.accent}55 0%,transparent 70%)`, filter:"blur(24px)" }} />
        {/* Shimmer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div style={{ position:"absolute", top:0, left:"-100%", width:"50%", height:"100%",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)",
            animation:"shimmer-scan 5s ease-in-out infinite" }} />
        </div>
        {/* Accent strip */}
        <div className="absolute top-0 start-0 end-0 h-0.5 rounded-t-2xl"
          style={{ background:`linear-gradient(90deg,transparent,${slot.accent},transparent)` }} />
        {welcomeShape !== "none" && <Shape3D shape={welcomeShape} />}
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4 p-6">
          <BannerContent slot={slot} name={name} t={t} isArabic={isArabic}
            welcomeTitle={welcomeTitle} welcomeMessage={welcomeMessage}
            displayIcon={displayIcon} isImageUrl={isImageUrl}
            todayAtt={todayAtt} currentlyCheckedIn={currentlyCheckedIn} sessions={sessions}
            onEditMessage={onEditMessage} sts={sts}
            textClass="text-foreground" subTextClass="text-muted-foreground" />
        </div>
      </div>
    );
  }

  /* ── CARD (dark) style ──────────────────────────────────────────── */
  if (welcomeStyle === "card") {
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/5"
        style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)" }}>
        {/* Colour accent orb matching time */}
        <div className="absolute -bottom-12 -end-12 w-56 h-56 rounded-full pointer-events-none"
          style={{ background:`radial-gradient(circle,${slot.accent}30 0%,transparent 70%)`, filter:"blur(32px)" }} />
        {/* Top border accent */}
        <div className="absolute top-0 start-0 end-0 h-px"
          style={{ background:`linear-gradient(90deg,transparent,${slot.accent}80,transparent)` }} />
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ backgroundImage:"radial-gradient(circle,rgba(255,255,255,0.15) 1px,transparent 1px)", backgroundSize:"28px 28px" }} />
        {welcomeShape !== "none" && <Shape3D shape={welcomeShape} />}
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4 p-6">
          <BannerContent slot={slot} name={name} t={t} isArabic={isArabic}
            welcomeTitle={welcomeTitle} welcomeMessage={welcomeMessage}
            displayIcon={displayIcon} isImageUrl={isImageUrl}
            todayAtt={todayAtt} currentlyCheckedIn={currentlyCheckedIn} sessions={sessions}
            onEditMessage={onEditMessage} sts={sts}
            textClass="text-white" subTextClass="text-slate-400" />
        </div>
      </div>
    );
  }

  /* ── MINIMAL style ──────────────────────────────────────────────── */
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-md border border-border bg-card">
      {/* Coloured left accent strip */}
      <div className="absolute top-0 bottom-0 start-0 w-1 rounded-s-2xl"
        style={{ background: slot.gradient }} />
      <div className="relative z-10 flex items-start justify-between flex-wrap gap-4 p-6 ps-8">
        <BannerContent slot={slot} name={name} t={t} isArabic={isArabic}
          welcomeTitle={welcomeTitle} welcomeMessage={welcomeMessage}
          displayIcon={displayIcon} isImageUrl={isImageUrl}
          todayAtt={todayAtt} currentlyCheckedIn={currentlyCheckedIn} sessions={sessions}
          onEditMessage={onEditMessage} sts={sts}
          textClass="text-foreground" subTextClass="text-muted-foreground" />
      </div>
    </div>
  );
}
