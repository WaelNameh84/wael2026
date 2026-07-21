/**
 * SplashScreen Style 2 — نسخ حرفي من HTML المُرسَل (Premium Intro)
 * core pulse · energy rings · shine sweep · floating logo · dots
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/use-settings";
import { useAppConfig } from "@/contexts/AppConfigContext";

const SPLASH_BG: Record<string, string> = {
  cosmic:   "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
  ocean:    "linear-gradient(135deg,#0a2342,#1a4a8a,#0d2137)",
  forest:   "linear-gradient(135deg,#0a2e1a,#1a5c34,#0a1e12)",
  midnight: "linear-gradient(135deg,#0a0a0a,#1a1a2e,#16213e)",
  rose:     "linear-gradient(135deg,#1a0a0e,#3d1020,#2a0f1f)",
  amber:    "linear-gradient(135deg,#1a0f00,#3d2500,#1a0f00)",
  dark:     "linear-gradient(135deg,#050505,#111111,#090909)",
};

/* 120 dots — deterministic */
const DOTS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  left:  Number(((i * 1.6180339 * 100) % 100).toFixed(2)),
  delay: Number(((i * 0.0833)   % 10  ).toFixed(2)),
  dur:   Number((5 + (i * 0.042) % 10 ).toFixed(2)),
}));

const SHOWN_KEY = "attendx_s2_v2";

export default function SplashScreen2() {
  const {
    welcomeTitle, welcomeMessage, splashTagline, splashDuration,
    splashLogoUrl, splashLogoWidth, splashLogoHeight, splashLogoRadius,
    splashLogoOffsetX, splashLogoOffsetY, splashLogoBgSize, splashAppName,
    splashBgGradient,
  } = useSettings();
  const { appLogo } = useAppConfig();

  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SHOWN_KEY); } catch { return false; }
  });
  const [exit, setExit] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const holdMs  = Math.max(splashDuration * 1000 - 700, 3500);
  const logoSrc = splashLogoUrl || appLogo;
  const logoW   = splashLogoWidth  || 170;
  const logoH   = splashLogoHeight || 170;
  const offsetX = splashLogoOffsetX || 0;
  const offsetY = splashLogoOffsetY || 0;
  const bgPad   = splashLogoBgSize !== undefined ? splashLogoBgSize : 20;
  const appName = splashAppName  || welcomeTitle || "AttendX";
  const subtitle= welcomeMessage || "Designed by Wael";
  const tagline = splashTagline  || "";
  const showLogo = !!logoSrc && !logoError;

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setExit(true), holdMs);
    const t2 = setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch {}
    }, holdMs + 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, holdMs]);

  /* inject keyframes exactly as in the HTML */
  useEffect(() => {
    const id = "splash-s2-v2-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s2v2-pulse {
        50% { transform: scale(1.3); opacity: .5; }
      }
      @keyframes s2v2-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes s2v2-move {
        from { transform: translateY(100vh); }
        to   { transform: translateY(-100vh); }
      }
      @keyframes s2v2-logoMove {
        50% { transform: translateY(-25px) rotateY(180deg); }
      }
      @keyframes s2v2-show {
        from { opacity: 0; transform: scale(.5); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes s2v2-shine {
        0%   { transform: translateX(-800px); opacity: 0; }
        50%  { opacity: 1; }
        100% { transform: translateX(800px); opacity: 0; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s2v2"
          style={{
            position:"fixed", inset:0, zIndex:9999, overflow:"hidden",
            height:"100vh",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.cosmic,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"Arial,sans-serif", color:"white",
            margin:0, padding:0, boxSizing:"border-box",
          }}
          exit={{ opacity:0 }}
          transition={{ duration:0.7 }}
        >
          {/* ضوء مركزي */}
          <div style={{
            position:"absolute", width:500, height:500, borderRadius:"50%",
            background:"radial-gradient(circle,#00eaff55,transparent 65%)",
            filter:"blur(40px)",
            animation:"s2v2-pulse 5s infinite",
            pointerEvents:"none",
          }} />

          {/* حلقة 1 */}
          <div style={{
            position:"absolute", width:350, height:350, borderRadius:"50%",
            border:"2px solid #00eaff55",
            animation:"s2v2-spin 8s linear infinite",
            pointerEvents:"none",
          }} />

          {/* حلقة 2 */}
          <div style={{
            position:"absolute", width:500, height:500, borderRadius:"50%",
            border:"2px solid #8b5cf655",
            animation:"s2v2-spin 15s linear infinite",
            pointerEvents:"none",
          }} />

          {/* ضوء يمر */}
          <div style={{
            position:"absolute", width:600, height:2,
            background:"white", boxShadow:"0 0 30px white",
            animation:"s2v2-shine 4s infinite",
            pointerEvents:"none",
          }} />

          {/* جزيئات */}
          {DOTS.map(d => (
            <div key={d.id} style={{
              position:"absolute", left:`${d.left}%`,
              width:4, height:4, background:"white", borderRadius:"50%",
              boxShadow:"0 0 20px #00ffff",
              animation:`s2v2-move ${d.dur}s infinite linear`,
              animationDelay:`${d.delay}s`,
              pointerEvents:"none",
            }} />
          ))}

          {/* المحتوى */}
          <motion.div
            style={{
              zIndex:5, display:"flex", alignItems:"center", flexDirection:"column",
            }}
            initial={{ opacity:0 }}
            animate={exit ? { opacity:0 } : { opacity:1 }}
            transition={{ duration:0.8 }}
          >
            {/* اللوغو */}
            {showLogo && (
              <div style={{
                transform:`translate(${offsetX}px,${offsetY}px)`,
                borderRadius: splashLogoRadius || 45,
                boxShadow:"0 0 40px #00ffff, 0 0 100px #00ffff",
                display:"flex", alignItems:"center", justifyContent:"center",
                width:"fit-content", margin:"0 auto",
                transition:"all .2s",
                animation:"s2v2-logoMove 5s infinite ease-in-out",
              }}>
                <img
                  src={logoSrc!}
                  alt="logo"
                  onError={() => setLogoError(true)}
                  style={{ width:logoW, height:logoH, objectFit:"contain", display:"block" }}
                />
              </div>
            )}

            {/* الاسم h1 */}
            <div style={{
              marginTop:35,
              fontSize:"clamp(2.5rem,10vw,4rem)",
              letterSpacing:12, fontWeight:900,
              textShadow:"0 0 25px #00ffff",
              animation:"s2v2-show 2s",
              textAlign:"center",
              fontFamily:"Arial,sans-serif",
            }}>{appName}</div>

            {/* المصمم h2 */}
            <div style={{
              marginTop:15,
              fontSize:22, color:"#b8efff", letterSpacing:3,
              animation:"s2v2-show 4s",
              textAlign:"center",
              fontFamily:"Arial,sans-serif",
            }}>{subtitle}</div>
          </motion.div>

          {/* tagline */}
          {tagline && (
            <div style={{
              position:"absolute", bottom:20, left:0, right:0, textAlign:"center",
              fontSize:"0.42rem", letterSpacing:"0.3em",
              color:"rgba(255,255,255,0.18)", textTransform:"uppercase",
              fontFamily:"Arial,sans-serif",
            }}>{tagline}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
