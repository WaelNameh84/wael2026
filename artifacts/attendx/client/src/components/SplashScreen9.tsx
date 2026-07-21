/**
 * SplashScreen Style 9 — Water Drop Reveal
 * قطرة ماء تسقط · موجة دائرية · ضوء سيان متحرك · لوغو ينبثق · نص يظهر
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/use-settings";
import { useAppConfig } from "@/contexts/AppConfigContext";

const SPLASH_BG: Record<string, string> = {
  cosmic:   "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
  ocean:    "linear-gradient(#07121f,#000)",
  forest:   "linear-gradient(135deg,#0a2e1a,#1a5c34,#0a1e12)",
  midnight: "linear-gradient(135deg,#0a0a0a,#1a1a2e,#16213e)",
  rose:     "linear-gradient(135deg,#1a0a0e,#3d1020,#2a0f1f)",
  amber:    "linear-gradient(135deg,#1a0f00,#3d2500,#1a0f00)",
  dark:     "linear-gradient(#050505,#000)",
};

const SHOWN_KEY = "attendx_s9_v1";

export default function SplashScreen9() {
  const {
    welcomeTitle, welcomeMessage, splashTagline, splashDuration,
    splashLogoUrl, splashLogoWidth, splashLogoHeight, splashLogoRadius,
    splashLogoOffsetX, splashLogoOffsetY, splashAppName,
    splashBgGradient,
  } = useSettings();
  const { appLogo } = useAppConfig();

  const [visible, setVisible]     = useState(() => {
    try { return !sessionStorage.getItem(SHOWN_KEY); } catch { return false; }
  });
  const [exit, setExit]           = useState(false);
  const [logoError, setLogoError] = useState(false);

  const holdMs  = Math.max(splashDuration * 1000 - 700, 6000);
  const logoSrc = splashLogoUrl || appLogo;
  const logoW   = splashLogoWidth  || 150;
  const logoH   = splashLogoHeight || 150;
  const offsetX = splashLogoOffsetX || 0;
  const offsetY = splashLogoOffsetY || 0;
  const radius  = splashLogoRadius ?? 30;
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
    const id = "splash-s9-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s9-move {
        to { transform: translate(120px, -80px); }
      }
      @keyframes s9-fall {
        0%   { transform: translateY(-200px); }
        80%  { transform: translateY(350px); opacity:1; }
        100% { transform: translateY(300px) scale(1.2); opacity:0; }
      }
      @keyframes s9-wave {
        to { width:500px; height:150px; opacity:0; }
      }
      @keyframes s9-logo {
        0%,50% { opacity:0; transform: scale(.2); }
        100%   { opacity:1; transform: scale(1);  }
      }
      @keyframes s9-text6 {
        to { opacity:1; }
      }
      @keyframes s9-text7 {
        to { opacity:1; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s9"
          style={{
            position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
            display: "flex", justifyContent: "center", alignItems: "center",
            flexDirection: "column",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.ocean,
            fontFamily: "Arial, sans-serif",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* ── ضوء خلفي متحرك ── */}
          <div style={{
            position: "absolute",
            width: 500, height: 500,
            background: "radial-gradient(circle,#00ffff55,transparent)",
            filter: "blur(70px)",
            animation: "s9-move 6s infinite alternate",
            pointerEvents: "none",
          }} />

          {/* ── قطرة الماء ── */}
          <div style={{
            position: "absolute",
            top: -250,
            width: 180, height: 220,
            background: "linear-gradient(135deg,rgba(255,255,255,.5),rgba(0,255,255,.15))",
            borderRadius: "50% 50% 55% 55%",
            boxShadow: "0 0 50px cyan, inset 0 0 40px white",
            backdropFilter: "blur(10px)",
            animation: "s9-fall 3s forwards",
            pointerEvents: "none",
          }} />

          {/* ── موجة الماء ── */}
          <div style={{
            position: "absolute",
            width: 20, height: 20,
            border: "3px solid cyan",
            borderRadius: "50%",
            animation: "s9-wave 3s forwards",
            pointerEvents: "none",
          }} />

          {/* ── لوغو ── */}
          {showLogo && (
            <img
              src={logoSrc!}
              alt="logo"
              onError={() => setLogoError(true)}
              style={{
                position: "absolute",
                width: logoW, height: logoH,
                objectFit: "contain",
                borderRadius: radius,
                boxShadow: "0 0 60px cyan",
                opacity: 0,
                animation: "s9-logo 5s forwards",
                transform: `translate(${offsetX}px,${offsetY}px)`,
                zIndex: 5,
              }}
            />
          )}

          {/* ── اسم التطبيق ── */}
          <motion.div
            style={{
              position: "absolute",
              top: "72%",
              color: "white",
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: 15,
              opacity: 0,
              animation: "s9-text6 6s forwards",
              zIndex: 5,
              textAlign: "center",
              width: "100%",
            }}
            animate={exit ? { opacity: 0 } : {}}
          >{appName}</motion.div>

          {/* ── creator ── */}
          {creator && (
            <div style={{
              position: "absolute",
              top: "82%",
              color: "#8ffaff",
              letterSpacing: 5,
              fontSize: 17,
              opacity: 0,
              animation: "s9-text7 7s forwards",
              zIndex: 5,
              textAlign: "center",
              width: "100%",
            }}>{creator}</div>
          )}

          {/* ── tagline ── */}
          {tagline && (
            <div style={{
              position: "absolute",
              top: "89%",
              color: "rgba(143,250,255,0.5)",
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              opacity: 0,
              animation: "s9-text7 8s forwards",
              zIndex: 5,
              textAlign: "center",
              width: "100%",
            }}>{tagline}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
