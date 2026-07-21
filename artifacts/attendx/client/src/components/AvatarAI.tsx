/**
 * AvatarAI — أفاتار ذكاء اصطناعي يتحدث مع المستخدم
 * SVG متحرك مع تعبيرات وجه وتزامن شفوي
 * يدعم 6 أنماط: human | robot | cat | alien | panda | fox
 */
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { AvatarStyle } from "@/hooks/use-settings";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy";

interface AvatarAIProps {
  state: AvatarState;
  size?: number;
  name?: string;
  message?: string;
  avatarStyle?: AvatarStyle;
}

/* ── Mouth shapes (path d) ── */
const MOUTH: Record<AvatarState, string[]> = {
  idle:      ["M 38 62 Q 50 68 62 62"],
  happy:     ["M 36 60 Q 50 76 64 60"],
  listening: ["M 38 62 Q 50 66 62 62"],
  thinking:  ["M 42 62 Q 50 60 58 62"],
  speaking:  [
    "M 38 60 Q 50 72 62 60",
    "M 38 64 Q 50 56 62 64",
    "M 38 61 Q 50 70 62 61",
    "M 38 63 Q 50 58 62 63",
  ],
};

function useMouthPath(state: AvatarState) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (state !== "speaking") { setIdx(0); return; }
    const shapes = MOUTH.speaking;
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % shapes.length; setIdx(i); }, 120);
    return () => clearInterval(t);
  }, [state]);
  const paths = MOUTH[state];
  return paths[idx % paths.length];
}

function useBlinkState() {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    function schedule() {
      const delay = 2000 + Math.random() * 4000;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); schedule(); }, 150);
      }, delay);
    }
    const t = schedule();
    return () => clearTimeout(t);
  }, []);
  return blink;
}

const STATE_COLORS: Record<AvatarState, { skin: string; outline: string; bg: string; glow: string }> = {
  idle:      { skin: "#FDDCB5", outline: "#E8A87C", bg: "#6366f1", glow: "#6366f144" },
  happy:     { skin: "#FDDCB5", outline: "#E8A87C", bg: "#22c55e", glow: "#22c55e44" },
  listening: { skin: "#FDDCB5", outline: "#E8A87C", bg: "#ef4444", glow: "#ef444444" },
  thinking:  { skin: "#FDDCB5", outline: "#E8A87C", bg: "#8b5cf6", glow: "#8b5cf644" },
  speaking:  { skin: "#FDDCB5", outline: "#E8A87C", bg: "#0ea5e9", glow: "#0ea5e944" },
};

function SoundBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[0.6, 1, 0.75, 0.9, 0.5].map((h, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-current"
          animate={active ? { scaleY: [h, 1, h * 0.5, 1, h] } : { scaleY: 0.3 }}
          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
          style={{ height: "100%", transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}

/* ── Human avatar SVG (original) ── */
function HumanFace({ colors, state, blink, mouthPath }: { colors: typeof STATE_COLORS["idle"]; state: AvatarState; blink: boolean; mouthPath: string }) {
  const eyeScaleY = blink ? 0.05 : 1;
  return (
    <>
      <rect x="43" y="74" width="14" height="18" rx="6" fill={colors.skin} />
      <rect x="35" y="86" width="30" height="10" rx="8" fill={colors.bg} opacity="0.8" />
      <ellipse cx="50" cy="48" rx="30" ry="33" fill={colors.skin} stroke={colors.outline} strokeWidth="1.5" />
      <ellipse cx="50" cy="20" rx="30" ry="14" fill={colors.bg} />
      <rect x="20" y="18" width="60" height="8" rx="4" fill={colors.bg} />
      <path d="M28 22 Q26 10 30 6" stroke={colors.bg} strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M50 16 Q50 6 52 4" stroke={colors.bg} strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M72 22 Q74 10 70 6" stroke={colors.bg} strokeWidth="5" strokeLinecap="round" fill="none"/>
      <ellipse cx="20" cy="50" rx="5" ry="7" fill={colors.skin} stroke={colors.outline} strokeWidth="1"/>
      <ellipse cx="80" cy="50" rx="5" ry="7" fill={colors.skin} stroke={colors.outline} strokeWidth="1"/>
      <motion.g animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "35px 47px" }}>
        <ellipse cx="35" cy="47" rx="7" ry="8" fill="white" />
        <ellipse cx="36" cy="47" rx="4.5" ry="5.5" fill={state === "thinking" ? "#8b5cf6" : colors.bg} />
        <ellipse cx="36" cy="47" rx="2.5" ry="3" fill="#1a1a2e" />
        <circle cx="37.5" cy="45.5" r="1.2" fill="white" />
      </motion.g>
      <motion.g animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "65px 47px" }}>
        <ellipse cx="65" cy="47" rx="7" ry="8" fill="white" />
        <ellipse cx="64" cy="47" rx="4.5" ry="5.5" fill={state === "thinking" ? "#8b5cf6" : colors.bg} />
        <ellipse cx="64" cy="47" rx="2.5" ry="3" fill="#1a1a2e" />
        <circle cx="65.5" cy="45.5" r="1.2" fill="white" />
      </motion.g>
      <motion.path d="M28 39 Q35 36 42 38" stroke={colors.outline} strokeWidth="2" strokeLinecap="round" fill="none"
        animate={{ d: state === "thinking" ? "M28 38 Q35 35 42 37" : state === "happy" ? "M28 38 Q35 34 42 38" : "M28 39 Q35 36 42 38" }} />
      <motion.path d="M58 38 Q65 36 72 39" stroke={colors.outline} strokeWidth="2" strokeLinecap="round" fill="none"
        animate={{ d: state === "thinking" ? "M58 37 Q65 35 72 38" : state === "happy" ? "M58 38 Q65 34 72 38" : "M58 38 Q65 36 72 39" }} />
      <path d="M47 56 Q50 60 53 56" stroke={colors.outline} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6"/>
      <motion.path d={mouthPath} stroke={state === "happy" ? "#ef4444" : colors.outline} strokeWidth="2.5" strokeLinecap="round"
        fill={state === "speaking" || state === "happy" ? "#ef4444" : "none"} fillOpacity="0.6" />
      {(state === "happy" || state === "speaking") && (
        <>
          <ellipse cx="28" cy="60" rx="7" ry="4" fill="#ff9a9e" opacity="0.4" />
          <ellipse cx="72" cy="60" rx="7" ry="4" fill="#ff9a9e" opacity="0.4" />
        </>
      )}
      {state === "thinking" && (
        <g>
          {[0,1,2].map(i => (
            <motion.circle key={i} cx={42 + i * 8} cy={80} r={2.5} fill={colors.bg}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </g>
      )}
    </>
  );
}

/* ── Robot avatar SVG ── */
function RobotFace({ colors, state, blink }: { colors: typeof STATE_COLORS["idle"]; state: AvatarState; blink: boolean }) {
  const eyeScaleY = blink ? 0.05 : 1;
  return (
    <>
      {/* Antenna */}
      <line x1="50" y1="8" x2="50" y2="20" stroke={colors.bg} strokeWidth="3" strokeLinecap="round"/>
      <circle cx="50" cy="6" r="4" fill={state === "thinking" ? "#f59e0b" : colors.bg} />
      {/* Head */}
      <rect x="18" y="20" width="64" height="62" rx="10" fill="#c0c0c0" stroke="#9ca3af" strokeWidth="1.5"/>
      {/* Ears/vents */}
      <rect x="10" y="36" width="8" height="20" rx="3" fill="#9ca3af"/>
      <rect x="82" y="36" width="8" height="20" rx="3" fill="#9ca3af"/>
      {/* Eyes — LED style */}
      <motion.rect x="26" y="34" width="18" height="12" rx="3" fill={state === "thinking" ? "#f59e0b" : state === "listening" ? "#ef4444" : colors.bg}
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "35px 40px" }}/>
      <motion.rect x="56" y="34" width="18" height="12" rx="3" fill={state === "thinking" ? "#f59e0b" : state === "listening" ? "#ef4444" : colors.bg}
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "65px 40px" }}/>
      {/* Reflection */}
      <rect x="28" y="36" width="6" height="4" rx="1" fill="white" opacity="0.5"/>
      <rect x="58" y="36" width="6" height="4" rx="1" fill="white" opacity="0.5"/>
      {/* Nose bolt */}
      <circle cx="50" cy="54" r="3" fill="#9ca3af" stroke="#6b7280" strokeWidth="1"/>
      {/* Mouth — speaker grill */}
      <rect x="30" y="62" width="40" height="10" rx="5" fill="#6b7280"/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={34 + i * 9} y="64" width="5" height="6" rx="1" fill={state === "speaking" ? colors.bg : "#9ca3af"}
          style={{ opacity: state === "speaking" ? undefined : 0.6 }}/>
      ))}
      {/* Panel lines */}
      <line x1="20" y1="28" x2="80" y2="28" stroke="#9ca3af" strokeWidth="1" opacity="0.5"/>
      {state === "thinking" && (
        <g>
          {[0,1,2].map(i => (
            <motion.circle key={i} cx={40 + i * 10} cy={85} r={2.5} fill={colors.bg}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </g>
      )}
    </>
  );
}

/* ── Cat avatar SVG ── */
function CatFace({ colors, state, blink, mouthPath }: { colors: typeof STATE_COLORS["idle"]; state: AvatarState; blink: boolean; mouthPath: string }) {
  const eyeScaleY = blink ? 0.05 : 1;
  return (
    <>
      {/* Ears */}
      <polygon points="22,28 10,6 34,20" fill={colors.bg}/>
      <polygon points="25,26 16,10 33,20" fill="#ff9eb5"/>
      <polygon points="78,28 90,6 66,20" fill={colors.bg}/>
      <polygon points="75,26 84,10 67,20" fill="#ff9eb5"/>
      {/* Head */}
      <ellipse cx="50" cy="54" rx="34" ry="32" fill="#fff8f0" stroke={colors.outline} strokeWidth="1.5"/>
      {/* Eyes */}
      <motion.ellipse cx="35" cy="48" rx="8" ry={state === "thinking" ? 2 : 9} fill={colors.bg}
        animate={{ ry: blink ? 0.5 : state === "thinking" ? 2 : 9 }}/>
      <motion.ellipse cx="65" cy="48" rx="8" ry={state === "thinking" ? 2 : 9} fill={colors.bg}
        animate={{ ry: blink ? 0.5 : state === "thinking" ? 2 : 9 }}/>
      <circle cx="36" cy="46" r="2.5" fill="white" opacity="0.7"/>
      <circle cx="66" cy="46" r="2.5" fill="white" opacity="0.7"/>
      {/* Nose */}
      <polygon points="50,58 46,63 54,63" fill="#ff9eb5"/>
      {/* Mouth */}
      <path d="M46 63 Q42 68 38 65" stroke={colors.outline} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M54 63 Q58 68 62 65" stroke={colors.outline} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      {/* Whiskers */}
      <line x1="20" y1="58" x2="44" y2="61" stroke={colors.outline} strokeWidth="1.2" opacity="0.6"/>
      <line x1="20" y1="63" x2="44" y2="63" stroke={colors.outline} strokeWidth="1.2" opacity="0.6"/>
      <line x1="56" y1="61" x2="80" y2="58" stroke={colors.outline} strokeWidth="1.2" opacity="0.6"/>
      <line x1="56" y1="63" x2="80" y2="63" stroke={colors.outline} strokeWidth="1.2" opacity="0.6"/>
      {/* Cheeks */}
      <ellipse cx="28" cy="62" rx="8" ry="5" fill="#ff9eb5" opacity="0.35"/>
      <ellipse cx="72" cy="62" rx="8" ry="5" fill="#ff9eb5" opacity="0.35"/>
      {state === "thinking" && (
        <g>
          {[0,1,2].map(i => (
            <motion.circle key={i} cx={40 + i * 10} cy={88} r={2.5} fill={colors.bg}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </g>
      )}
    </>
  );
}

/* ── Alien avatar SVG ── */
function AlienFace({ colors, state, blink }: { colors: typeof STATE_COLORS["idle"]; state: AvatarState; blink: boolean }) {
  const eyeScaleY = blink ? 0.05 : 1;
  return (
    <>
      {/* Elongated head */}
      <ellipse cx="50" cy="50" rx="28" ry="40" fill="#b8f5b8" stroke="#6ee76e" strokeWidth="1.5"/>
      {/* Huge almond eyes */}
      <motion.ellipse cx="35" cy="44" rx="10" ry="12" fill={colors.bg}
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "35px 44px" }}/>
      <motion.ellipse cx="65" cy="44" rx="10" ry="12" fill={colors.bg}
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "65px 44px" }}/>
      {/* Pupils */}
      <circle cx="35" cy="46" r="5" fill="#0a0a1a"/>
      <circle cx="65" cy="46" r="5" fill="#0a0a1a"/>
      <circle cx="37" cy="43" r="2" fill="white" opacity="0.8"/>
      <circle cx="67" cy="43" r="2" fill="white" opacity="0.8"/>
      {/* Nostril dots */}
      <circle cx="47" cy="62" r="2" fill="#6ee76e" opacity="0.7"/>
      <circle cx="53" cy="62" r="2" fill="#6ee76e" opacity="0.7"/>
      {/* Thin mouth */}
      {state === "speaking" ? (
        <ellipse cx="50" cy="72" rx="8" ry="4" fill="#0a0a1a" opacity="0.8"/>
      ) : (
        <path d={state === "happy" ? "M42 70 Q50 76 58 70" : "M43 70 Q50 72 57 70"}
          stroke="#0a0a1a" strokeWidth="2" strokeLinecap="round" fill="none"/>
      )}
      {/* Antenna bumps */}
      <ellipse cx="35" cy="12" rx="4" ry="3" fill={colors.bg} opacity="0.7"/>
      <ellipse cx="65" cy="12" rx="4" ry="3" fill={colors.bg} opacity="0.7"/>
      {state === "thinking" && (
        <g>
          {[0,1,2].map(i => (
            <motion.circle key={i} cx={40 + i * 10} cy={92} r={2} fill={colors.bg}
              animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </g>
      )}
    </>
  );
}

/* ── Panda avatar SVG ── */
function PandaFace({ colors, state, blink }: { colors: typeof STATE_COLORS["idle"]; state: AvatarState; blink: boolean }) {
  const eyeScaleY = blink ? 0.05 : 1;
  return (
    <>
      {/* Ears */}
      <circle cx="24" cy="20" r="14" fill="#1a1a2e"/>
      <circle cx="76" cy="20" r="14" fill="#1a1a2e"/>
      {/* Head */}
      <circle cx="50" cy="54" r="36" fill="white" stroke="#e5e7eb" strokeWidth="1.5"/>
      {/* Eye patches */}
      <ellipse cx="34" cy="46" rx="12" ry="11" fill="#1a1a2e"/>
      <ellipse cx="66" cy="46" rx="12" ry="11" fill="#1a1a2e"/>
      {/* Eyes */}
      <motion.ellipse cx="34" cy="47" rx="7" ry="7.5" fill="white"
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "34px 47px" }}/>
      <motion.ellipse cx="66" cy="47" rx="7" ry="7.5" fill="white"
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "66px 47px" }}/>
      <circle cx="35" cy="47" r="4" fill={state === "thinking" ? "#8b5cf6" : colors.bg}/>
      <circle cx="67" cy="47" r="4" fill={state === "thinking" ? "#8b5cf6" : colors.bg}/>
      <circle cx="36" cy="45" r="1.5" fill="white"/>
      <circle cx="68" cy="45" r="1.5" fill="white"/>
      {/* Nose */}
      <ellipse cx="50" cy="60" rx="5" ry="3.5" fill="#1a1a2e"/>
      {/* Mouth */}
      <path d={state === "happy" || state === "speaking" ? "M44 64 Q50 72 56 64" : "M45 65 Q50 67 55 65"}
        stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {(state === "happy" || state === "speaking") && (
        <>
          <ellipse cx="30" cy="66" rx="7" ry="4" fill="#ff9a9e" opacity="0.5"/>
          <ellipse cx="70" cy="66" rx="7" ry="4" fill="#ff9a9e" opacity="0.5"/>
        </>
      )}
      {state === "thinking" && (
        <g>
          {[0,1,2].map(i => (
            <motion.circle key={i} cx={40 + i * 10} cy={90} r={2.5} fill={colors.bg}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </g>
      )}
    </>
  );
}

/* ── Fox avatar SVG ── */
function FoxFace({ colors, state, blink, mouthPath }: { colors: typeof STATE_COLORS["idle"]; state: AvatarState; blink: boolean; mouthPath: string }) {
  const eyeScaleY = blink ? 0.05 : 1;
  return (
    <>
      {/* Pointed ears */}
      <polygon points="24,30 10,4 38,22" fill="#f97316"/>
      <polygon points="27,28 16,8 37,22" fill="#fed7aa"/>
      <polygon points="76,30 90,4 62,22" fill="#f97316"/>
      <polygon points="73,28 84,8 63,22" fill="#fed7aa"/>
      {/* Head — orange */}
      <ellipse cx="50" cy="52" rx="32" ry="34" fill="#f97316" stroke="#ea580c" strokeWidth="1.5"/>
      {/* White inner face */}
      <ellipse cx="50" cy="58" rx="20" ry="24" fill="#fff7ed"/>
      {/* Eyes */}
      <motion.ellipse cx="36" cy="46" rx="7" ry="8" fill="white"
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "36px 46px" }}/>
      <motion.ellipse cx="64" cy="46" rx="7" ry="8" fill="white"
        animate={{ scaleY: eyeScaleY }} style={{ transformOrigin: "64px 46px" }}/>
      <circle cx="37" cy="47" r="4.5" fill={state === "thinking" ? "#8b5cf6" : "#1a1a2e"}/>
      <circle cx="65" cy="47" r="4.5" fill={state === "thinking" ? "#8b5cf6" : "#1a1a2e"}/>
      <circle cx="38" cy="45" r="1.5" fill="white"/>
      <circle cx="66" cy="45" r="1.5" fill="white"/>
      {/* Snout */}
      <ellipse cx="50" cy="63" rx="8" ry="6" fill="#fff7ed" stroke="#fbbf24" strokeWidth="1"/>
      <ellipse cx="50" cy="60" rx="4" ry="3" fill="#1a1a2e"/>
      {/* Mouth */}
      <path d={state === "happy" || state === "speaking" ? "M44 65 Q50 72 56 65" : "M45 66 Q50 68 55 66"}
        stroke="#1a1a2e" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* Whiskers */}
      <line x1="18" y1="60" x2="40" y2="62" stroke="#ea580c" strokeWidth="1" opacity="0.5"/>
      <line x1="60" y1="62" x2="82" y2="60" stroke="#ea580c" strokeWidth="1" opacity="0.5"/>
      {(state === "happy" || state === "speaking") && (
        <>
          <ellipse cx="28" cy="66" rx="7" ry="4" fill="#ff9a9e" opacity="0.35"/>
          <ellipse cx="72" cy="66" rx="7" ry="4" fill="#ff9a9e" opacity="0.35"/>
        </>
      )}
      {state === "thinking" && (
        <g>
          {[0,1,2].map(i => (
            <motion.circle key={i} cx={40 + i * 10} cy={88} r={2.5} fill={colors.bg}
              animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </g>
      )}
    </>
  );
}

export default function AvatarAI({ state, size = 180, name = "Aria", message, avatarStyle = "human" }: AvatarAIProps) {
  const mouthPath = useMouthPath(state);
  const blink     = useBlinkState();
  const colors    = STATE_COLORS[state];

  const headRotate = state === "thinking" ? [0, -5, 5, -5, 0] : state === "happy" ? [0, 3, -3, 0] : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Animated ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(from 0deg, ${colors.bg}, ${colors.glow} 50%, ${colors.bg})` }}
          animate={{ rotate: state !== "idle" ? 360 : 0 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-1 rounded-full bg-card" />

        <motion.div
          className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center"
          style={{ background: `radial-gradient(circle at 35% 35%, ${colors.bg}33, ${colors.bg}99)` }}
          animate={{ rotate: headRotate }}
          transition={{ duration: 1.5, repeat: state === "thinking" ? Infinity : 0 }}
        >
          <svg viewBox="0 0 100 100" width={size - 20} height={size - 20}>
            {avatarStyle === "human"  && <HumanFace  colors={colors} state={state} blink={blink} mouthPath={mouthPath} />}
            {avatarStyle === "robot"  && <RobotFace  colors={colors} state={state} blink={blink} />}
            {avatarStyle === "cat"    && <CatFace    colors={colors} state={state} blink={blink} mouthPath={mouthPath} />}
            {avatarStyle === "alien"  && <AlienFace  colors={colors} state={state} blink={blink} />}
            {avatarStyle === "panda"  && <PandaFace  colors={colors} state={state} blink={blink} />}
            {avatarStyle === "fox"    && <FoxFace    colors={colors} state={state} blink={blink} mouthPath={mouthPath} />}
          </svg>
        </motion.div>

        <motion.div
          className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-card"
          style={{ background: colors.bg }}
          animate={state === "speaking" || state === "listening" ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="font-bold text-sm">{name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SoundBars active={state === "speaking"} />
          <span>
            {state === "idle"      && "جاهز"}
            {state === "listening" && "يستمع..."}
            {state === "thinking"  && "يفكر..."}
            {state === "speaking"  && "يتحدث..."}
            {state === "happy"     && "😊"}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            className="max-w-xs px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg"
            style={{ background: colors.bg + "22", border: `1px solid ${colors.bg}44` }}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
