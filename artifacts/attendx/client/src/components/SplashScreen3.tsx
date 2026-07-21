/**
 * SplashScreen Style 3 — نسخ حرفي من HTML المُرسَل (Hologram Intro)
 * grid background · energy orb · holo ring · scan line · float logo · particles
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

/* 150 particles — deterministic */
const PARTICLES = Array.from({ length: 150 }, (_, i) => ({
  id: i,
  left:  Number(((i * 1.6180339 * 100) % 100).toFixed(2)),
  delay: Number(((i * 0.0533)   % 8   ).toFixed(2)),
  dur:   Number((4  + (i * 0.053) % 8  ).toFixed(2)),
}));

const SHOWN_KEY = "attendx_s3_v1";

export default function SplashScreen3() {
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

  const holdMs   = Math.max(splashDuration * 1000 - 700, 3500);
  const logoSrc  = splashLogoUrl || appLogo;
  const logoW    = splashLogoWidth  || 170;
  const logoH    = splashLogoHeight || 170;
  const offsetX  = splashLogoOffsetX || 0;
  const offsetY  = splashLogoOffsetY || 0;
  const bgPad    = splashLogoBgSize !== undefined ? splashLogoBgSize : 20;
  const appName  = splashAppName  || welcomeTitle || "AttendX";
  const subtitle = welcomeMessage || "Designed by Wael";
  const tagline  = splashTagline  || "";
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
    const id = "splash-s3-v1-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s3-grid {
        to { transform: translateY(50px); }
      }
      @keyframes s3-pulse {
        50% { transform: scale(1.3); opacity: .4; }
      }
      @keyframes s3-rotate {
        100% { transform: rotateY(360deg) rotateX(60deg); }
      }
      @keyframes s3-float {
        50% { transform: translateY(-25px) rotateY(180deg); }
      }
      @keyframes s3-scan {
        0%   { top: 20px;  opacity: 0; }
        50%  { opacity: 1; }
        100% { top: 280px; opacity: 0; }
      }
      @keyframes s3-text {
        from { opacity: 0; transform: scale(.5); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes s3-particle {
        from { transform: translateY(100vh); }
        to   { transform: translateY(-20vh); }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s3v1"
          style={{
            position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
            height: "100vh",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.cosmic,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Arial", color: "white",
            margin: 0, padding: 0, boxSizing: "border-box",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* خلفية شبكية (body:before equivalent) */}
          <div style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(#00ffff15 1px,transparent 1px)," +
              "linear-gradient(90deg,#00ffff15 1px,transparent 1px)",
            backgroundSize: "50px 50px",
            animation: "s3-grid 8s linear infinite",
            pointerEvents: "none",
          }} />

          {/* طاقة خلفية */}
          <div style={{
            position: "absolute", width: 450, height: 450, borderRadius: "50%",
            background: "radial-gradient(circle,#00ffff55,transparent 65%)",
            filter: "blur(30px)",
            animation: "s3-pulse 3s infinite",
            pointerEvents: "none",
          }} />

          {/* الحلقة الهولوغرامية */}
          <div style={{
            position: "absolute", width: 300, height: 300, borderRadius: "50%",
            border: "2px solid #00ffff",
            boxShadow: "0 0 40px #00ffff",
            animation: "s3-rotate 6s linear infinite",
            pointerEvents: "none",
          }} />

          {/* خط المسح */}
          <div style={{
            position: "absolute", width: 230, height: 3,
            background: "white", boxShadow: "0 0 30px #00ffff",
            left: "50%", transform: "translateX(-50%)",
            animation: "s3-scan 3s infinite",
            pointerEvents: "none",
          }} />

          {/* جزيئات */}
          {PARTICLES.map(p => (
            <div key={p.id} style={{
              position: "absolute", left: `${p.left}%`,
              width: 3, height: 3,
              background: "#00ffff", borderRadius: "50%",
              boxShadow: "0 0 15px #00ffff",
              animation: `s3-particle ${p.dur}s infinite linear`,
              animationDelay: `${p.delay}s`,
              pointerEvents: "none",
            }} />
          ))}

          {/* المحتوى */}
          <motion.div
            style={{
              position: "relative", zIndex: 5, textAlign: "center",
            }}
            initial={{ opacity: 0 }}
            animate={exit ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* اللوغو */}
            {showLogo && (
              <div style={{
                transform:`translate(${offsetX}px,${offsetY}px)`,
                borderRadius: splashLogoRadius || 40,
                boxShadow: "0 0 50px #00ffff",
                display:"flex", alignItems:"center", justifyContent:"center",
                width:"fit-content", margin:"0 auto",
                transition:"all .2s",
                animation: "s3-float 4s infinite",
              }}>
                <img
                  src={logoSrc!}
                  alt="logo"
                  onError={() => setLogoError(true)}
                  style={{ width: logoW, height: logoH, objectFit: "contain", display:"block" }}
                />
              </div>
            )}

            {/* h1 */}
            <div style={{
              marginTop: 35,
              fontSize: "clamp(2.5rem,10vw,4rem)",
              letterSpacing: 12,
              color: "#fff",
              textShadow: "0 0 20px #00ffff, 0 0 50px #00ffff",
              animation: "s3-text 2s",
              fontFamily: "Arial",
              fontWeight: 900,
            }}>{appName}</div>

            {/* h2 */}
            <div style={{
              marginTop: 15,
              fontWeight: "normal",
              color: "#8ffaff",
              letterSpacing: 4,
              fontFamily: "Arial",
            }}>{subtitle}</div>
          </motion.div>

          {/* tagline */}
          {tagline && (
            <div style={{
              position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center",
              fontSize: "0.42rem", letterSpacing: "0.3em",
              color: "rgba(255,255,255,0.18)", textTransform: "uppercase",
              fontFamily: "Arial",
            }}>{tagline}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
