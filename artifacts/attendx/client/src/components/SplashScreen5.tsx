/**
 * SplashScreen Style 5 — نسخ حرفي (Premium 3D Intro)
 * space/stars · core glow · 2 orbits · beam · camera-Z scene · logo 360° Y
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

const STARS = Array.from({ length: 180 }, (_, i) => ({
  id: i,
  left:  Number(((i * 1.6180339 * 100) % 100).toFixed(2)),
  delay: Number(((i * 0.0555)  % 10  ).toFixed(2)),
  dur:   Number((5  + (i * 0.067) % 12 ).toFixed(2)),
}));

const SHOWN_KEY = "attendx_s5_v1";

export default function SplashScreen5() {
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
  const logoW    = splashLogoWidth  || 180;
  const logoH    = splashLogoHeight || 180;
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
    const id = "splash-s5-v1-css";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes s5-starMove {
        from { transform: translateY(100vh) scale(.5); opacity:0; }
        50%  { opacity:1; }
        to   { transform: translateY(-20vh) scale(2); opacity:0; }
      }
      @keyframes s5-coreMove {
        to { transform: scale(1.3) rotate(180deg); }
      }
      @keyframes s5-orbit {
        to { transform: rotate(360deg); }
      }
      @keyframes s5-camera {
        from { transform: translateZ(-80px); }
        to   { transform: translateZ(80px); }
      }
      @keyframes s5-logo {
        0%   { transform: rotateY(0deg)   translateY(0); }
        50%  { transform: rotateY(180deg) translateY(-25px); }
        100% { transform: rotateY(360deg) translateY(0); }
      }
      @keyframes s5-appear {
        from { opacity:0; transform: scale(.5) translateY(50px); }
        to   { opacity:1; transform: scale(1) translateY(0); }
      }
      @keyframes s5-beam {
        0%   { transform: translateX(-900px); opacity:0; }
        50%  { opacity:1; }
        100% { transform: translateX(900px); opacity:0; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="s5v1"
          style={{
            position:"fixed", inset:0, zIndex:9999, overflow:"hidden",
            height:"100vh",
            background: SPLASH_BG[splashBgGradient] || SPLASH_BG.cosmic,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"Arial",
            perspective:"1200px",
            margin:0, padding:0, boxSizing:"border-box",
          }}
          exit={{ opacity:0 }}
          transition={{ duration:0.7 }}
        >
          {/* المجرة */}
          <div style={{
            position:"absolute", inset:0,
            background:"radial-gradient(circle,transparent 20%,#000 80%)",
            pointerEvents:"none",
          }} />

          {/* النجوم */}
          {STARS.map(s => (
            <div key={s.id} style={{
              position:"absolute", left:`${s.left}%`,
              width:3, height:3, background:"white", borderRadius:"50%",
              boxShadow:"0 0 15px white",
              animation:`s5-starMove ${s.dur}s linear ${s.delay}s infinite`,
              pointerEvents:"none",
            }} />
          ))}

          {/* الكرة الضوئية */}
          <div style={{
            position:"absolute", width:450, height:450, borderRadius:"50%",
            background:"radial-gradient(circle,#00ffffaa,transparent 60%)",
            filter:"blur(40px)",
            animation:"s5-coreMove 6s infinite alternate",
            pointerEvents:"none",
          }} />

          {/* مدار 1 */}
          <div style={{
            position:"absolute", width:330, height:330, borderRadius:"50%",
            border:"1px solid #00ffff66",
            animation:"s5-orbit 10s linear infinite",
            pointerEvents:"none",
          }} />

          {/* مدار 2 */}
          <div style={{
            position:"absolute", width:500, height:500, borderRadius:"50%",
            border:"1px solid #8b5cf666",
            animation:"s5-orbit 18s linear infinite",
            pointerEvents:"none",
          }} />

          {/* شعاع */}
          <div style={{
            position:"absolute", width:800, height:2,
            background:"white", boxShadow:"0 0 40px cyan",
            animation:"s5-beam 5s infinite",
            pointerEvents:"none",
          }} />

          {/* المشهد الرئيسي */}
          <motion.div
            style={{
              zIndex:5, textAlign:"center",
              animation:"s5-camera 8s infinite alternate",
              color:"white",
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
                animation:"s5-logo 6s infinite",
              }}>
                <img src={logoSrc!} alt="logo" onError={() => setLogoError(true)}
                  style={{ width:logoW, height:logoH, objectFit:"contain", display:"block" }}
                />
              </div>
            )}

            {/* العنوان */}
            <div style={{
              marginTop:35,
              fontSize:"clamp(2.5rem,10vw,4.4rem)",
              fontWeight:900, letterSpacing:15, color:"white",
              textShadow:"0 0 20px #00ffff, 0 0 60px #00ffff",
              animation:"s5-appear 2s",
              fontFamily:"Arial",
            }}>{appName}</div>

            {/* المصمم */}
            <div style={{
              marginTop:15, fontSize:24, color:"#baf7ff",
              letterSpacing:5,
              animation:"s5-appear 4s",
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
