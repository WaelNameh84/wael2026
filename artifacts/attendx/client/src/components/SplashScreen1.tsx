/**
 * SplashScreen Style 1 — نسخ حرفي من HTML المُرسَل
 * glass card · energy orb · logo3d · particles · CSS load loop
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

/* 120 particles — deterministic (نفس عشوائية HTML) */
const PARTICLES = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  left:  Number(((i * 1.6180339 * 100) % 100).toFixed(2)),
  delay: Number(((i * 0.0833)   % 10  ).toFixed(2)),
  dur:   Number((5 + (i * 0.042) % 10 ).toFixed(2)),
}));

const SHOWN_KEY = "pulse_splash_v1";

export default function SplashScreen1() {
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
  const logoSrc  = splashLogoUrl || appLogo;
  const logoW    = splashLogoWidth  || 150;
  const logoH    = splashLogoHeight || 150;
  const offsetX  = splashLogoOffsetX || 0;
  const offsetY  = splashLogoOffsetY || 0;
  const bgPad    = splashLogoBgSize !== undefined ? splashLogoBgSize : 15;
  const appName = splashAppName  || welcomeTitle || "Pulse";
  const creator = welcomeMessage || "W@N";
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
    const id = "splash-s1-v2-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s1v2-lightMove {
        from { transform: translate(-250px,-150px); }
        to   { transform: translate(250px,150px); }
      }
      @keyframes s1v2-fly {
        from { transform: translateY(100vh) translateZ(-500px) scale(.2); opacity:0; }
        30%  { opacity: 1; }
        to   { transform: translateY(-20vh) translateZ(500px) scale(2); opacity:0; }
      }
      @keyframes s1v2-cardMove {
        50% { transform: translateY(-25px) rotateX(8deg) rotateY(-8deg); }
      }
      @keyframes s1v2-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes s1v2-logo3d {
        0%   { transform: rotateY(0deg); }
        50%  { transform: rotateY(180deg) scale(1.08); }
        100% { transform: rotateY(360deg); }
      }
      @keyframes s1v2-show {
        from { opacity:0; transform: translateY(40px) scale(.8); }
        to   { opacity:1; transform: translateY(0) scale(1); }
      }
      @keyframes s1v2-load {
        from { width: 0; }
        to   { width: 100%; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s1v2"
          style={{
            position:"fixed", inset:0, zIndex:9999, overflow:"hidden",
            margin:0, padding:0, boxSizing:"border-box",
            height:"100vh",
            display:"flex", justifyContent:"center", alignItems:"center",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.cosmic,
            perspective:"1200px",
          }}
          exit={{ opacity:0 }}
          transition={{ duration:0.7 }}
        >
          {/* ضوء الخلفية */}
          <div style={{
            position:"absolute", width:600, height:600, borderRadius:"50%",
            background:"radial-gradient(circle,#00eaffaa,transparent 65%)",
            filter:"blur(40px)",
            animation:"s1v2-lightMove 8s infinite alternate",
            pointerEvents:"none",
          }} />

          {/* الجسيمات */}
          {PARTICLES.map(p => (
            <div key={p.id} style={{
              position:"absolute", left:`${p.left}%`,
              width:5, height:5, background:"#fff", borderRadius:"50%",
              boxShadow:"0 0 20px #00eaff",
              animation:`s1v2-fly ${p.dur}s linear ${p.delay}s infinite`,
              pointerEvents:"none",
            }} />
          ))}

          {/* البطاقة */}
          <motion.div
            style={{
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              transformStyle:"preserve-3d",
              animation:"s1v2-cardMove 6s infinite ease-in-out",
              position:"relative", zIndex:5,
              padding:"28px 24px",
            }}
            initial={{ opacity:0, scale:0.85 }}
            animate={exit ? { opacity:0, scale:0.95 } : { opacity:1, scale:1 }}
            transition={{ duration:0.9, ease:[0.22,1,0.36,1] }}
          >
            {/* دائرة الطاقة */}
            <div style={{
              position:"absolute", width:230, height:230, borderRadius:"50%",
              background:"conic-gradient(#00eaff,#7c3cff,#00eaff)",
              filter:"blur(25px)",
              animation:"s1v2-spin 5s linear infinite",
              pointerEvents:"none",
            }} />

            {/* اللوغو */}
            {showLogo && (
              <div style={{
                position:"relative", zIndex:2,
                transform:`translate(${offsetX}px,${offsetY}px)`,
                borderRadius: splashLogoRadius || 35,
                boxShadow:"0 0 50px #00eaff",
                display:"flex", alignItems:"center", justifyContent:"center",
                width:"fit-content", margin:"0 auto",
                transition:"all .2s",
              }}>
                <img
                  src={logoSrc!}
                  alt="logo"
                  onError={() => setLogoError(true)}
                  style={{
                    width:logoW, height:logoH,
                    objectFit:"contain",
                    display:"block",
                    animation:"s1v2-logo3d 7s infinite linear",
                  }}
                />
              </div>
            )}

            {/* الاسم */}
            <div style={{
              marginTop:25, position:"relative", zIndex:2,
              fontSize:48, fontWeight:900, color:"white", letterSpacing:5,
              textShadow:"0 0 30px #00eaff", textAlign:"center",
              animation:"s1v2-show 2s forwards",
              fontFamily:"Arial,sans-serif",
            }}>{appName}</div>

            {/* المصمم */}
            <div style={{
              marginTop:15, position:"relative", zIndex:2,
              fontSize:20, color:"#c8f5ff", textAlign:"center",
              animation:"s1v2-show 2s forwards",
              animationDelay:"1s", opacity:0,
              fontFamily:"Arial,sans-serif",
            }}>{creator}</div>

            {/* رسالة الترحيب */}
            <div style={{
              marginTop:15, position:"relative", zIndex:2, color:"white",
              textAlign:"center",
              animation:"s1v2-show 2s forwards",
              animationDelay:"2s", opacity:0,
              fontFamily:"Arial,sans-serif",
            }}>Welcome To The Future</div>

            {/* شريط التحميل */}
            <div style={{
              marginTop:30, width:"min(300px,80%)", height:7,
              background:"#ffffff33", borderRadius:20, overflow:"hidden",
              position:"relative", zIndex:2,
            }}>
              <div style={{
                display:"block", height:"100%",
                background:"linear-gradient(90deg,#00eaff,white,#7c3cff)",
                animation:"s1v2-load 3s infinite",
              }} />
            </div>
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
