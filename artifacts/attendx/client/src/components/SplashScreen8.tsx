/**
 * SplashScreen Style 8 — Luxury Intro
 * ستارة حمراء تنفتح · كشاف ضوء يتأرجح · منصة ذهبية · لوغو يصعد · غبار ذهبي
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
  dark:     "#050505",
};

/* 80 ذرة غبار ذهبي — حسابية */
const DUST = Array.from({ length: 80 }, (_, i) => ({
  id:    i,
  left:  ((i * 137.508) % 100),
  delay: (i * 0.1) % 8,
}));

const SHOWN_KEY = "attendx_s8_v1";

export default function SplashScreen8() {
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
  const [exit, setExit]           = useState(false);
  const [logoError, setLogoError] = useState(false);

  const holdMs  = Math.max(splashDuration * 1000 - 700, 6000);
  const logoSrc = splashLogoUrl || appLogo;
  const logoW   = splashLogoWidth  || 150;
  const logoH   = splashLogoHeight || 150;
  const offsetX = splashLogoOffsetX || 0;
  const offsetY = splashLogoOffsetY || 0;
  const radius  = splashLogoRadius ?? 25;
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
    const id = "splash-s8-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s8-light {
        to   { transform: translateX(200px); }
      }
      @keyframes s8-curtain-left {
        to   { transform: translateX(-100%); }
      }
      @keyframes s8-curtain-right {
        to   { transform: translateX(100%); }
      }
      @keyframes s8-show {
        0%   { opacity:0; transform: scale(.2) translateY(80px); }
        100% { opacity:1; transform: scale(1)  translateY(0);    }
      }
      @keyframes s8-text {
        from { opacity:0; }
        to   { opacity:1; }
      }
      @keyframes s8-dust {
        from { transform: translateY(100vh); opacity:0; }
        to   { transform: translateY(-20vh); opacity:1; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  const bg = splashBgGradient === "dark" ? "#050505" : (SPLASH_BG[splashBgGradient] || "#050505");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s8"
          style={{
            position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
            display: "flex", justifyContent: "center", alignItems: "center",
            flexDirection: "column",
            background: bg,
            fontFamily: "Arial, sans-serif",
            color: "white",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* ── غبار ذهبي ── */}
          {DUST.map(d => (
            <div
              key={d.id}
              style={{
                position: "absolute",
                width: 4, height: 4,
                borderRadius: "50%",
                background: "gold",
                boxShadow: "0 0 15px gold",
                left: `${d.left}%`,
                animation: `s8-dust 8s ${d.delay}s infinite`,
                pointerEvents: "none",
              }}
            />
          ))}

          {/* ── كشاف الضوء ── */}
          <div style={{
            position: "absolute",
            top: -200,
            width: 500, height: 600,
            background: "linear-gradient(180deg, rgba(255,255,255,.25), transparent)",
            clipPath: "polygon(45% 0,55% 0,90% 100%,10% 100%)",
            animation: "s8-light 5s infinite alternate",
            pointerEvents: "none",
          }} />

          {/* ── الستارة اليسرى ── */}
          <div style={{
            position: "absolute", top: 0, left: 0,
            width: "50%", height: "100%",
            background: "linear-gradient(90deg,#400000,#900000,#300000)",
            animation: "s8-curtain-left 4s forwards",
            zIndex: 10,
          }} />
          {/* ── الستارة اليمنى ── */}
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: "50%", height: "100%",
            background: "linear-gradient(90deg,#300000,#900000,#400000)",
            animation: "s8-curtain-right 4s forwards",
            zIndex: 10,
          }} />

          {/* ── مسرح (gradient أسفل) ── */}
          <div style={{
            position: "absolute", bottom: 0,
            width: "100%", height: 180,
            background: "linear-gradient(transparent,#111)",
            pointerEvents: "none",
          }} />

          {/* ── منصة ذهبية ── */}
          <div style={{
            position: "absolute", bottom: 130,
            width: 280, height: 35,
            borderRadius: "50%",
            background: "linear-gradient(#d4af37,#5b4300)",
            boxShadow: "0 0 50px gold",
          }} />

          {/* ── المحتوى ── */}
          <motion.div
            style={{
              position: "relative", zIndex: 5,
              textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center",
              marginBottom: 60,
            }}
            initial={{ opacity: 0 }}
            animate={exit ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* لوغو */}
            {showLogo && (
              <div style={{ transform: `translate(${offsetX}px,${offsetY}px)` }}>
                <img
                  src={logoSrc!}
                  alt="logo"
                  onError={() => setLogoError(true)}
                  style={{
                    width: logoW, height: logoH,
                    objectFit: "contain",
                    display: "block",
                    borderRadius: radius,
                    boxShadow: "0 0 50px gold",
                    opacity: 0,
                    animation: "s8-show 5s forwards",
                  }}
                />
              </div>
            )}
          </motion.div>

          {/* ── اسم التطبيق (أسفل) ── */}
          <div style={{
            position: "absolute", bottom: 45,
            fontSize: 52,
            letterSpacing: 15,
            fontWeight: 900,
            color: "white",
            textShadow: "0 0 30px gold",
            animation: "s8-text 5s forwards",
            zIndex: 5,
          }}>{appName}</div>

          {/* ── creator ── */}
          {creator && (
            <div style={{
              position: "absolute", bottom: 10,
              letterSpacing: 5,
              color: "#ffd86b",
              fontSize: 17,
              animation: "s8-text 5s forwards",
              animationDelay: "1s",
              opacity: 0,
              zIndex: 5,
            }}>{creator}</div>
          )}

          {/* ── tagline ── */}
          {tagline && (
            <div style={{
              position: "absolute", bottom: -14,
              color: "rgba(255,220,100,0.55)",
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              animation: "s8-text 5s forwards",
              animationDelay: "2s",
              opacity: 0,
              zIndex: 5,
            }}>{tagline}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
