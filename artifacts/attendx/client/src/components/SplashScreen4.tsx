/**
 * SplashScreen Style 4 — نسخ حرفي (Premium 3D Logo Intro)
 * light · 2 rings · beam · 200 particles · camera box · logo Y-flip
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

const PARTICLES = Array.from({ length: 200 }, (_, i) => ({
  id: i,
  left:  Number(((i * 1.6180339 * 100) % 100).toFixed(2)),
  delay: Number(((i * 0.04)   % 8   ).toFixed(2)),
  dur:   Number((4  + (i * 0.05) % 10 ).toFixed(2)),
}));

const SHOWN_KEY = "attendx_s4_v1";

export default function SplashScreen4() {
  const { welcomeTitle, welcomeMessage, splashTagline, splashDuration,
          splashLogoUrl, splashLogoWidth, splashLogoHeight, splashLogoRadius,
          splashLogoOffsetX, splashLogoOffsetY, splashLogoBgSize, splashAppName,
          splashBgGradient } = useSettings();
  const { appLogo } = useAppConfig();

  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem(SHOWN_KEY); } catch { return false; }
  });
  const [exit, setExit] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const holdMs   = Math.max(splashDuration * 1000 - 700, 3500);
  const logoSrc  = splashLogoUrl || appLogo;
  const logoW    = splashLogoWidth  || 190;
  const logoH    = splashLogoHeight || 190;
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

  useEffect(() => {
    const id = "splash-s4-v1-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s4-light {
        to { transform: scale(1.5) translate(100px,-50px); }
      }
      @keyframes s4-rotate {
        to { transform: rotate(360deg); }
      }
      @keyframes s4-camera {
        to { transform: scale(1.08) translateY(-20px); }
      }
      @keyframes s4-logo {
        50% { transform: rotateY(180deg) translateY(-20px); }
      }
      @keyframes s4-show {
        from { opacity:0; transform: translateY(40px); }
        to   { opacity:1; transform: translateY(0); }
      }
      @keyframes s4-fly {
        from { transform: translateY(100vh) scale(.2); opacity:0; }
        50%  { opacity:1; }
        to   { transform: translateY(-20vh) scale(2); opacity:0; }
      }
      @keyframes s4-beam {
        0%   { transform: translateX(-1000px); }
        100% { transform: translateX(1000px); }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s4v1"
          style={{
            position:"fixed", inset:0, zIndex:9999, overflow:"hidden",
            height:"100vh",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.cosmic,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"Arial", color:"white",
            margin:0, padding:0, boxSizing:"border-box",
          }}
          exit={{ opacity:0 }}
          transition={{ duration:0.7 }}
        >
          {/* ضوء الخلفية */}
          <div style={{
            position:"absolute", width:600, height:600, borderRadius:"50%",
            background:"radial-gradient(circle,#00eaff66,transparent 60%)",
            filter:"blur(60px)",
            animation:"s4-light 7s infinite alternate",
            pointerEvents:"none",
          }} />

          {/* حلقة 1 */}
          <div style={{
            position:"absolute", width:350, height:350, borderRadius:"50%",
            border:"2px solid #00ffff55",
            animation:"s4-rotate 8s linear infinite",
            pointerEvents:"none",
          }} />

          {/* حلقة 2 */}
          <div style={{
            position:"absolute", width:520, height:520, borderRadius:"50%",
            border:"2px solid #8b5cf655",
            animation:"s4-rotate 15s linear infinite reverse",
            pointerEvents:"none",
          }} />

          {/* شعاع سينمائي */}
          <div style={{
            position:"absolute", width:900, height:3,
            background:"white", boxShadow:"0 0 50px cyan",
            animation:"s4-beam 5s infinite",
            pointerEvents:"none",
          }} />

          {/* الجزيئات */}
          {PARTICLES.map(p => (
            <div key={p.id} style={{
              position:"absolute", left:`${p.left}%`,
              width:4, height:4, background:"#00ffff", borderRadius:"50%",
              boxShadow:"0 0 20px cyan",
              animation:`s4-fly ${p.dur}s linear ${p.delay}s infinite`,
              pointerEvents:"none",
            }} />
          ))}

          {/* الصندوق الرئيسي */}
          <motion.div
            style={{
              zIndex:5, textAlign:"center",
              animation:"s4-camera 6s infinite alternate",
            }}
            initial={{ opacity:0 }}
            animate={exit ? { opacity:0 } : { opacity:1 }}
            transition={{ duration:0.8 }}
          >
            {/* اللوغو */}
            {showLogo && (
              <div style={{
                transform:`translate(${offsetX}px,${offsetY}px)`,
                borderRadius: splashLogoRadius || 50,
                boxShadow:"0 0 50px #00ffff, 0 0 120px #00ffff",
                display:"flex", alignItems:"center", justifyContent:"center",
                width:"fit-content", margin:"0 auto",
                transition:"all .2s",
                animation:"s4-logo 7s infinite",
              }}>
                <img src={logoSrc!} alt="logo" onError={() => setLogoError(true)}
                  style={{ width:logoW, height:logoH, objectFit:"contain", display:"block" }}
                />
              </div>
            )}

            {/* h1 */}
            <div style={{
              marginTop:35,
              fontSize:"clamp(2.5rem,10vw,4.7rem)",
              fontWeight:900, letterSpacing:18,
              textShadow:"0 0 25px cyan, 0 0 70px cyan",
              animation:"s4-show 2s forwards",
              fontFamily:"Arial",
            }}>{appName}</div>

            {/* h2 */}
            <div style={{
              marginTop:15, fontSize:24, letterSpacing:5,
              color:"#bdf7ff",
              animation:"s4-show 3s forwards",
              fontFamily:"Arial",
            }}>{subtitle}</div>
          </motion.div>

          {tagline && (
            <div style={{
              position:"absolute", bottom:20, left:0, right:0, textAlign:"center",
              fontSize:"0.42rem", letterSpacing:"0.3em",
              color:"rgba(255,255,255,0.18)", textTransform:"uppercase",
              fontFamily:"Arial",
            }}>{tagline}</div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
