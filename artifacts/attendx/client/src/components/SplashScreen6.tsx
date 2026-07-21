/**
 * SplashScreen Style 6 — Logo Reveal 3D
 * 1200 particles converge to center · flash burst · logo scale-in · text fade
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
  dark:     "linear-gradient(135deg,#050505,#111111,#090909)",
};

const SHOWN_KEY = "attendx_s6_v1";

export default function SplashScreen6() {
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
  const [exit, setExit]       = useState(false);
  const [logoError, setLogoError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const holdMs  = Math.max(splashDuration * 1000 - 700, 4500);
  const logoSrc = splashLogoUrl || appLogo;
  const logoW   = splashLogoWidth  || 160;
  const logoH   = splashLogoHeight || 160;
  const offsetX = splashLogoOffsetX || 0;
  const offsetY = splashLogoOffsetY || 0;
  const radius  = splashLogoRadius ?? 45;
  const showLogo = !!logoSrc && !logoError;
  const appName  = splashAppName  || welcomeTitle || "AttendX";
  const creator  = welcomeMessage || "Designed by Wael";
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
    const id = "splash-s6-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s6-logoAppear {
        from { opacity:0; transform:scale(.15); }
        to   { opacity:1; transform:scale(1);   }
      }
      @keyframes s6-text {
        from { opacity:0; }
        to   { opacity:1; }
      }
      @keyframes s6-flash {
        0%   { opacity:0;  transform:scale(1);  }
        50%  { opacity:1;  transform:scale(10); }
        100% { opacity:0;  transform:scale(20); }
      }
    `;
    document.head.appendChild(s);
  }, []);

  /* canvas particle animation */
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d")!;

    /* build 1200 particles */
    const particles = Array.from({ length: 1200 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      tx:    canvas.width  / 2 + (Math.random() - 0.5) * 180,
      ty:    canvas.height / 2 + (Math.random() - 0.5) * 180,
      size:  Math.random() * 2 + 1,
      speed: 0.015 + Math.random() * 0.03,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += (p.tx - p.x) * p.speed;
        p.y += (p.ty - p.y) * p.speed;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle    = "#00eaff";
        ctx.shadowBlur   = 20;
        ctx.shadowColor  = "#00ffff";
        ctx.fill();
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s6"
          style={{
            position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden",
            display: "flex", justifyContent: "center", alignItems: "center",
            flexDirection: "column",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.cosmic,
            fontFamily: "Arial,sans-serif",
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* canvas particles */}
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          />

          {/* flash burst */}
          <div style={{
            position: "absolute",
            width: 20, height: 20,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 0 100px 80px cyan",
            animation: "s6-flash 1s forwards",
            animationDelay: "0.5s",
            opacity: 0,
            pointerEvents: "none",
            zIndex: 2,
          }} />

          {/* content */}
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
            {/* logo */}
            {showLogo && (
              <div style={{
                transform: `translate(${offsetX}px,${offsetY}px)`,
                animation: "s6-logoAppear 2s forwards",
                animationDelay: "1s",
                opacity: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "fit-content", margin: "0 auto",
                borderRadius: radius,
                boxShadow: "0 0 80px cyan",
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
                  }}
                />
              </div>
            )}

            {/* app name */}
            <div style={{
              marginTop: 35,
              fontSize: 56,
              letterSpacing: 15,
              color: "white",
              opacity: 0,
              animation: "s6-text 2s forwards",
              animationDelay: "2s",
              textShadow: "0 0 40px cyan",
              fontWeight: 700,
            }}>{appName}</div>

            {/* creator */}
            <div style={{
              marginTop: 15,
              color: "#aef8ff",
              fontSize: 18,
              opacity: 0,
              animation: "s6-text 2s forwards",
              animationDelay: "3s",
            }}>{creator}</div>

            {/* tagline */}
            {tagline && (
              <div style={{
                marginTop: 10,
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                opacity: 0,
                animation: "s6-text 2s forwards",
                animationDelay: "4s",
              }}>{tagline}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
