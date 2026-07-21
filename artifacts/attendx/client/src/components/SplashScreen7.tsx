/**
 * SplashScreen Style 7 — Smoke Reveal
 * دخان متحرك · ضوء سيان خلف اللوغو · لوغو يدور 3D · شرارات صاعدة · نص يصعد
 */
import { useEffect, useRef, useState } from "react";
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
  dark:     "#000",
};

/* 120 شرارة — حسابية (نفس عشوائية HTML) */
const SPARKS = Array.from({ length: 120 }, (_, i) => ({
  id:       i,
  left:     ((i * 137.508) % 100),          // توزيع golden-angle
  delay:    (i * 0.05) % 6,
  duration: 4 + (i * 0.037) % 8,
}));

const SHOWN_KEY = "attendx_s7_v1";

export default function SplashScreen7() {
  const {
    welcomeTitle, welcomeMessage, splashTagline, splashDuration,
    splashLogoUrl, splashLogoWidth, splashLogoHeight, splashLogoRadius,
    splashLogoOffsetX, splashLogoOffsetY, splashAppName,
    splashBgGradient,
  } = useSettings();
  const { appLogo } = useAppConfig();

  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SHOWN_KEY); } catch { return false; }
  });
  const [exit, setExit]         = useState(false);
  const [logoError, setLogoError] = useState(false);

  const holdMs  = Math.max(splashDuration * 1000 - 700, 5000);
  const logoSrc = splashLogoUrl || appLogo;
  const logoW   = splashLogoWidth  || 170;
  const logoH   = splashLogoHeight || 170;
  const offsetX = splashLogoOffsetX || 0;
  const offsetY = splashLogoOffsetY || 0;
  const radius  = splashLogoRadius ?? 35;
  const showLogo = !!logoSrc && !logoError;
  const appName  = splashAppName || welcomeTitle   || "AttendX";
  const creator  = welcomeMessage || "";
  const tagline  = splashTagline  || "";

  /* auto-hide */
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setExit(true), holdMs);
    const t2 = setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch {}
    }, holdMs + 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, holdMs]);

  /* inject keyframes */
  useEffect(() => {
    const id = "splash-s7-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s7-smoke {
        0%   { transform: translate(-150px, 50px) scale(1);   }
        100% { transform: translate(150px, -80px) scale(1.5); }
      }
      @keyframes s7-pulse {
        50%  { transform: scale(1.5); opacity: .5; }
      }
      @keyframes s7-appear {
        0%   { opacity: 0; transform: scale(.2) rotateY(180deg); }
        60%  { opacity: 1; }
        100% { opacity: 1; transform: scale(1) rotateY(360deg); }
      }
      @keyframes s7-text {
        from { opacity: 0; transform: translateY(50px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes s7-spark {
        from { transform: translateY(100vh) scale(.2); opacity: 0; }
        50%  { opacity: 1; }
        to   { transform: translateY(-20vh) scale(2);  opacity: 0; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s7"
          style={{
            position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
            display: "flex", justifyContent: "center", alignItems: "center",
            flexDirection: "column",
            background: splashBgGradient === "dark" ? "#000" : (SPLASH_BG[splashBgGradient] || "#000"),
            fontFamily: "Arial, sans-serif",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* ── شرارات صاعدة ── */}
          {SPARKS.map(sp => (
            <div
              key={sp.id}
              style={{
                position: "absolute",
                width: 4, height: 4,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 0 20px cyan",
                left: `${sp.left}%`,
                animation: `s7-spark ${sp.duration}s ${sp.delay}s infinite`,
                pointerEvents: "none",
              }}
            />
          ))}

          {/* ── دخان ── */}
          <div style={{
            position: "absolute",
            width: 600, height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(80,80,80,.35), transparent 65%)",
            filter: "blur(50px)",
            animation: "s7-smoke 8s infinite alternate",
            pointerEvents: "none",
          }} />

          {/* ── ضوء سيان ── */}
          <div style={{
            position: "absolute",
            width: 300, height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, #00ffff88, transparent 65%)",
            filter: "blur(40px)",
            animation: "s7-pulse 4s infinite",
            pointerEvents: "none",
          }} />

          {/* ── المحتوى ── */}
          <motion.div
            style={{
              position: "relative", zIndex: 5,
              textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}
            initial={{ opacity: 0 }}
            animate={exit ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* لوغو */}
            {showLogo && (
              <div style={{
                transform: `translate(${offsetX}px, ${offsetY}px)`,
                animation: "s7-appear 3s forwards",
                opacity: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "fit-content", margin: "0 auto",
              }}>
                <img
                  src={logoSrc!}
                  alt="logo"
                  onError={() => setLogoError(true)}
                  style={{
                    width: logoW, height: logoH,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: radius,
                    boxShadow: "0 0 80px #00ffff",
                  }}
                />
              </div>
            )}

            {/* اسم التطبيق */}
            <div style={{
              marginTop: 30,
              fontSize: 55,
              fontWeight: 900,
              letterSpacing: 15,
              color: "white",
              textShadow: "0 0 30px cyan",
              opacity: 0,
              animation: "s7-text 2s forwards",
              animationDelay: "2s",
            }}>{appName}</div>

            {/* creator */}
            {creator && (
              <div style={{
                marginTop: 12,
                color: "#a5f3fc",
                fontSize: 20,
                letterSpacing: 5,
                opacity: 0,
                animation: "s7-text 2s forwards",
                animationDelay: "3s",
              }}>{creator}</div>
            )}

            {/* tagline */}
            {tagline && (
              <div style={{
                marginTop: 10,
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                opacity: 0,
                animation: "s7-text 2s forwards",
                animationDelay: "4s",
              }}>{tagline}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
