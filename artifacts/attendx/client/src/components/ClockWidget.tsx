import { useEffect, useRef, useState } from "react";
import { useSettings, ClockFormat, ClockLocale, ClockStyle, ClockSize } from "@/hooks/use-settings";

/* ── Helpers ─────────────────────────────────────────────────── */
function getLocaleCode(l: ClockLocale) {
  if (l === "ar") return "ar-SY";
  if (l === "sv") return "sv-SE";
  return "en-GB";
}
function formatTime(d: Date, fmt: ClockFormat, loc: ClockLocale) {
  return d.toLocaleTimeString(getLocaleCode(loc), {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: fmt === "12h",
  });
}
function formatTimeShort(d: Date, fmt: ClockFormat, loc: ClockLocale) {
  return d.toLocaleTimeString(getLocaleCode(loc), {
    hour: "2-digit", minute: "2-digit", hour12: fmt === "12h",
  });
}
function formatDate(d: Date, loc: ClockLocale) {
  return d.toLocaleDateString(getLocaleCode(loc), {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
function pad(n: number) { return String(n).padStart(2, "0"); }

const sz = {
  small:  { tsize: 26, tsizePx: "26px", dsize: 9,  face: 112, pad: 12, br: 18 },
  medium: { tsize: 38, tsizePx: "38px", dsize: 11, face: 158, pad: 16, br: 24 },
  large:  { tsize: 52, tsizePx: "52px", dsize: 13, face: 208, pad: 20, br: 30 },
};

/* ══════════════════════════════════════════════════════════════
   1. DIGITAL — Apple Watch Ultra OLED face
   ══════════════════════════════════════════════════════════════ */
function DigitalClock({ time, date, size, now }: { time: string; date: string; size: ClockSize; now: Date }) {
  const s = sz[size];
  const secPct = now.getSeconds() / 60;
  const w = size === "small" ? 185 : size === "large" ? 308 : 248;
  return (
    <div style={{
      width: w,
      background: "linear-gradient(175deg,#111 0%,#050505 60%,#080808 100%)",
      borderRadius: s.br,
      padding: `${s.pad + 2}px ${s.pad + 6}px ${s.pad + 4}px`,
      boxShadow: "0 28px 70px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.07), inset 0 1px 0 rgba(255,255,255,.12)",
      position: "relative", overflow: "hidden",
    }}>
      {/* top specular */}
      <div style={{ position:"absolute",top:0,left:"10%",right:"10%",height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)" }}/>
      {/* top ambient glow */}
      <div style={{ position:"absolute",top:-40,left:"15%",right:"15%",height:80,background:"radial-gradient(ellipse,rgba(0,122,255,.14),transparent 70%)",pointerEvents:"none" }}/>
      {/* time */}
      <div style={{
        fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif",
        fontVariantNumeric:"tabular-nums", fontWeight:100, fontSize:s.tsize,
        color:"#fff", letterSpacing:"-0.035em", lineHeight:1.05,
        textShadow:"0 0 50px rgba(80,170,255,.45), 0 2px 8px rgba(0,0,0,.9)",
        position:"relative", zIndex:1, marginBottom:5,
      }}>{time}</div>
      {/* date */}
      <div style={{
        color:"rgba(255,255,255,.35)", fontSize:s.dsize, letterSpacing:"0.05em",
        fontFamily:"-apple-system,sans-serif", fontWeight:400, position:"relative", zIndex:1,
      }}>{date}</div>
      {/* seconds progress bar */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:3,background:"rgba(255,255,255,.05)" }}>
        <div style={{
          width:`${secPct*100}%`, height:"100%",
          background:"linear-gradient(90deg,#007AFF,#5AC8FA,#30D158)",
          borderRadius:"0 2px 2px 0", transition:"width .9s linear",
          boxShadow:"0 0 8px rgba(0,122,255,.6)",
        }}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   2. BOXED — Samsung Galaxy Watch segment cards
   ══════════════════════════════════════════════════════════════ */
function BoxedClock({ now, fmt, loc, size }: { now: Date; fmt: ClockFormat; loc: ClockLocale; size: ClockSize }) {
  const s = sz[size];
  const hh = pad(now.getHours() % (fmt === "12h" ? 12 : 24) || (fmt === "12h" ? 12 : 0));
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const ampm = fmt === "12h" ? (now.getHours() >= 12 ? "PM" : "AM") : null;
  const cardW = size === "small" ? 52 : size === "large" ? 84 : 66;
  const cardH = size === "small" ? 58 : size === "large" ? 94 : 74;
  const colon = size === "small" ? 20 : size === "large" ? 34 : 26;

  const Card = ({ val, label }: { val: string; label: string }) => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
      <div style={{
        width:cardW, height:cardH,
        background:"linear-gradient(160deg,#1a1a2e 0%,#0f0f1a 100%)",
        borderRadius:10,
        border:"1px solid rgba(100,130,255,.2)",
        boxShadow:"0 4px 20px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04), inset 0 1px 0 rgba(255,255,255,.07)",
        display:"flex", alignItems:"center", justifyContent:"center",
        position:"relative", overflow:"hidden",
      }}>
        {/* top specular */}
        <div style={{ position:"absolute",top:0,left:"20%",right:"20%",height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent)" }}/>
        {/* accent glow */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#667eea,#764ba2)" }}/>
        <span style={{
          fontFamily:"'Courier New',monospace", fontVariantNumeric:"tabular-nums",
          fontWeight:700, fontSize:s.tsize, color:"#e8edff",
          textShadow:"0 0 20px rgba(120,150,255,.6), 0 0 40px rgba(100,130,255,.3)",
          letterSpacing:"-0.02em",
        }}>{val}</span>
      </div>
      <span style={{ color:"rgba(255,255,255,.3)", fontSize:7, letterSpacing:"0.15em", fontFamily:"sans-serif" }}>{label}</span>
    </div>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:s.pad }}>
      <div style={{ display:"flex",alignItems:"center",gap:4 }}>
        <Card val={hh} label="HH" />
        <span style={{ fontSize:colon, fontWeight:700, color:"rgba(100,130,255,.7)", marginBottom:18 }}>:</span>
        <Card val={mm} label="MM" />
        <span style={{ fontSize:colon, fontWeight:700, color:"rgba(100,130,255,.7)", marginBottom:18 }}>:</span>
        <Card val={ss} label="SS" />
        {ampm && <div style={{ display:"flex",flexDirection:"column",justifyContent:"flex-end",height:cardH+20,paddingBottom:20 }}>
          <span style={{ fontSize:s.dsize+2, fontWeight:700, color:"#764ba2", fontFamily:"sans-serif" }}>{ampm}</span>
        </div>}
      </div>
      <div style={{ color:"rgba(255,255,255,.25)", fontSize:s.dsize, letterSpacing:"0.04em" }}>
        {formatDate(now, loc)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   3. NEON — Cyberpunk 2077 realistic neon sign
   ══════════════════════════════════════════════════════════════ */
function NeonClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  const chars = time.split("");
  const palette = ["#ff2d78","#ff6b35","#ffee05","#00f5ff","#bf5fff"];
  return (
    <div style={{
      background:"radial-gradient(ellipse at 50% 30%,#0d0020 0%,#000 70%)",
      borderRadius:s.br, padding:`${s.pad+2}px ${s.pad+4}px`,
      boxShadow:"0 0 0 1px rgba(255,255,255,.06), 0 20px 60px rgba(0,0,0,.9)",
      position:"relative", overflow:"hidden",
    }}>
      {/* background neon glow blobs */}
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 50%,rgba(255,45,120,.07),transparent 55%), radial-gradient(ellipse at 70% 50%,rgba(0,245,255,.06),transparent 55%)",pointerEvents:"none" }}/>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontWeight:900,letterSpacing:"0.08em",fontSize:s.tsize,marginBottom:6,position:"relative",zIndex:1 }}>
        {chars.map((c, i) => {
          const isNum = /[0-9]/.test(c);
          const col = isNum ? palette[Math.floor(i / 2) % palette.length] : "rgba(255,255,255,.2)";
          return (
            <span key={i} style={{
              color: col,
              textShadow: isNum
                ? `0 0 6px ${col}, 0 0 14px ${col}bb, 0 0 30px ${col}77, 0 0 60px ${col}33`
                : "none",
              transition:"color .3s",
              filter: isNum ? "brightness(1.2)" : "none",
            }}>{c}</span>
          );
        })}
      </div>
      {/* neon sign bottom bar */}
      <div style={{ width:"60%",margin:"0 auto 6px",height:1,background:"linear-gradient(90deg,transparent,rgba(0,245,255,.4),transparent)" }}/>
      <div style={{ textAlign:"center",color:"rgba(255,255,255,.2)",fontSize:s.dsize,letterSpacing:"0.18em",fontFamily:"monospace",position:"relative",zIndex:1 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   4. RETRO — Authentic 7-segment LED alarm clock display
   ══════════════════════════════════════════════════════════════ */
const SEG_ON  = "rgba(255,160,30,1)";
const SEG_OFF = "rgba(255,160,30,0.07)";
const SEG_MAP: Record<string, boolean[]> = {
  "0":[true,true,true,false,true,true,true],
  "1":[false,true,true,false,false,false,false],
  "2":[true,true,false,true,true,false,true],
  "3":[true,true,true,true,false,false,true],
  "4":[false,true,true,true,false,true,false],
  "5":[true,false,true,true,false,true,true],
  "6":[true,false,true,true,true,true,true],
  "7":[true,true,true,false,false,false,false],
  "8":[true,true,true,true,true,true,true],
  "9":[true,true,true,true,false,true,true],
  " ":[false,false,false,false,false,false,false],
  ":":[false,false,false,false,false,false,false],
};
function SevenSeg({ char, h }: { char: string; h: number }) {
  const segs = SEG_MAP[char] ?? SEG_MAP[" "];
  const w = h * 0.6;
  const sw = Math.max(2, h * 0.09); // segment width
  const gap = sw * 0.15;
  const hw = w - sw * 2 - gap * 2; // horizontal segment width
  const vhalf = (h / 2) - sw * 1.5 - gap * 2;

  if (char === ":") {
    return (
      <svg width={w * 0.5} height={h} viewBox={`0 0 ${w * 0.5} ${h}`}>
        <circle cx={w*0.25} cy={h*0.32} r={sw*0.85} fill={SEG_ON} style={{filter:`drop-shadow(0 0 3px ${SEG_ON})`}}/>
        <circle cx={w*0.25} cy={h*0.68} r={sw*0.85} fill={SEG_ON} style={{filter:`drop-shadow(0 0 3px ${SEG_ON})`}}/>
      </svg>
    );
  }
  if (!SEG_MAP[char]) return <svg width={w} height={h} />;

  // segments: [a=top, b=top-right, c=bot-right, d=bot, e=bot-left, f=top-left, g=mid]
  const segColor = (on: boolean) => on ? SEG_ON : SEG_OFF;
  const glow = (on: boolean) => on ? `drop-shadow(0 0 4px ${SEG_ON}) drop-shadow(0 0 8px rgba(255,160,30,.4))` : "none";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* a — top */}
      <rect x={sw+gap} y={gap} width={hw} height={sw} rx={sw*0.4}
        fill={segColor(segs[0])} style={{filter:glow(segs[0])}}/>
      {/* b — top-right */}
      <rect x={w-sw-gap} y={sw+gap*2} width={sw} height={vhalf} rx={sw*0.4}
        fill={segColor(segs[1])} style={{filter:glow(segs[1])}}/>
      {/* c — bottom-right */}
      <rect x={w-sw-gap} y={h/2+gap} width={sw} height={vhalf} rx={sw*0.4}
        fill={segColor(segs[2])} style={{filter:glow(segs[2])}}/>
      {/* d — bottom */}
      <rect x={sw+gap} y={h-sw-gap} width={hw} height={sw} rx={sw*0.4}
        fill={segColor(segs[3])} style={{filter:glow(segs[3])}}/>
      {/* e — bottom-left */}
      <rect x={gap} y={h/2+gap} width={sw} height={vhalf} rx={sw*0.4}
        fill={segColor(segs[4])} style={{filter:glow(segs[4])}}/>
      {/* f — top-left */}
      <rect x={gap} y={sw+gap*2} width={sw} height={vhalf} rx={sw*0.4}
        fill={segColor(segs[5])} style={{filter:glow(segs[5])}}/>
      {/* g — middle */}
      <rect x={sw+gap} y={h/2-sw/2} width={hw} height={sw} rx={sw*0.4}
        fill={segColor(segs[6])} style={{filter:glow(segs[6])}}/>
    </svg>
  );
}
function RetroClock({ now, fmt, size }: { now: Date; fmt: ClockFormat; size: ClockSize }) {
  const hh = pad(now.getHours() % (fmt === "12h" ? 12 : 24) || (fmt === "12h" ? 12 : 0));
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const h = size === "small" ? 44 : size === "large" ? 74 : 58;
  const digits = `${hh}:${mm}:${ss}`;

  return (
    <div style={{
      background:"linear-gradient(160deg,#0c0902 0%,#060400 100%)",
      borderRadius:sz[size].br, padding:`${sz[size].pad}px ${sz[size].pad+4}px`,
      boxShadow:"0 0 0 2px #1a1100, 0 0 0 4px #0a0800, 0 20px 50px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,200,30,.06)",
      position:"relative", overflow:"hidden",
    }}>
      {/* LCD amber background glow */}
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 50%,rgba(255,140,0,.06),transparent 70%)",pointerEvents:"none" }}/>
      {/* digits */}
      <div style={{ display:"flex",alignItems:"center",gap:2,position:"relative",zIndex:1 }}>
        {digits.split("").map((c, i) => <SevenSeg key={i} char={c} h={h} />)}
      </div>
      {/* brand label */}
      <div style={{ textAlign:"center",marginTop:6,color:"rgba(255,140,0,.35)",fontSize:7,letterSpacing:"0.35em",fontFamily:"sans-serif",fontWeight:700 }}>
        AttendX
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   5. GRADIENT — iOS Dynamic Island Live Activity
   ══════════════════════════════════════════════════════════════ */
function GradientClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{
      borderRadius:s.br, padding:`${s.pad+2}px ${s.pad+8}px`,
      background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)",
      boxShadow:"0 20px 60px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.07)",
      position:"relative", overflow:"hidden",
    }}>
      {/* animated gradient overlay */}
      <div style={{
        position:"absolute",inset:0,
        background:"linear-gradient(120deg,rgba(233,69,96,.15),rgba(255,193,7,.1),rgba(0,229,255,.12),rgba(149,76,233,.15))",
        backgroundSize:"300% 300%",
        animation:"gradLive 8s ease infinite",
        pointerEvents:"none",
      }}/>
      <style>{`@keyframes gradLive{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`}</style>
      {/* gloss top */}
      <div style={{ position:"absolute",top:0,left:"8%",right:"8%",height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)" }}/>
      <div style={{
        fontSize:s.tsize, fontWeight:200,
        fontFamily:"-apple-system,sans-serif", fontVariantNumeric:"tabular-nums",
        letterSpacing:"-0.03em",
        background:"linear-gradient(90deg,#e8f4fd,#fce4ec,#e8eaf6,#e0f7fa)",
        backgroundSize:"300% auto",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        animation:"gradLive 8s ease infinite",
        filter:"drop-shadow(0 2px 8px rgba(0,0,0,.5))",
        position:"relative",zIndex:1, marginBottom:5, lineHeight:1.1,
      }}>{time}</div>
      <div style={{ color:"rgba(255,255,255,.3)",fontSize:s.dsize,letterSpacing:"0.04em",position:"relative",zIndex:1 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   6. GLASS — Ultra-realistic frosted glass panel
   ══════════════════════════════════════════════════════════════ */
function GlassClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{
      borderRadius:s.br, padding:`${s.pad+4}px ${s.pad+8}px`,
      background:"linear-gradient(160deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,.06) 40%,rgba(255,255,255,.1) 100%)",
      backdropFilter:"blur(24px) saturate(200%)",
      WebkitBackdropFilter:"blur(24px) saturate(200%)",
      border:"1px solid rgba(255,255,255,.3)",
      boxShadow:"0 24px 64px rgba(0,0,0,.35), inset 0 2px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(255,255,255,.1), 0 1px 3px rgba(0,0,0,.12)",
      position:"relative",overflow:"hidden",
    }}>
      {/* primary gloss reflection */}
      <div style={{
        position:"absolute",top:0,left:0,right:0,height:"42%",
        background:"linear-gradient(180deg,rgba(255,255,255,.45) 0%,rgba(255,255,255,.08) 60%,transparent 100%)",
        borderRadius:`${s.br}px ${s.br}px 50% 50%`,
        pointerEvents:"none",
      }}/>
      {/* caustic side reflection */}
      <div style={{
        position:"absolute",top:"10%",right:0,width:"15%",height:"70%",
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent)",
        pointerEvents:"none",
      }}/>
      {/* bottom edge */}
      <div style={{ position:"absolute",bottom:0,left:"20%",right:"20%",height:1,background:"rgba(255,255,255,.2)" }}/>

      <div style={{
        fontSize:s.tsize, fontWeight:300, fontFamily:"-apple-system,sans-serif",
        fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em",
        color:"rgba(10,10,20,.9)", lineHeight:1.1,
        textShadow:"0 1px 3px rgba(255,255,255,.8), 0 -1px 0 rgba(0,0,0,.05)",
        position:"relative",zIndex:1, marginBottom:5,
      }}>{time}</div>
      <div style={{ color:"rgba(10,10,40,.5)",fontSize:s.dsize,letterSpacing:"0.04em",position:"relative",zIndex:1 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   7. FLIP — Solari airport departure board
   ══════════════════════════════════════════════════════════════ */
function FlipCard({ value, prev }: { value: string; prev: string }) {
  const [flipping, setFlipping] = useState(false);
  const [display, setDisplay] = useState(value);
  const [prevDisplay, setPrevDisplay] = useState(value);

  useEffect(() => {
    if (value !== display) {
      setPrevDisplay(display);
      setFlipping(true);
      const t = setTimeout(() => { setDisplay(value); setFlipping(false); }, 320);
      return () => clearTimeout(t);
    }
  }, [value]);

  const cardStyle: React.CSSProperties = {
    width: "1.65ch", display:"flex", alignItems:"center", justifyContent:"center",
    fontFamily:"'Courier New',monospace", fontVariantNumeric:"tabular-nums",
    fontWeight:700, color:"#f5e6c8", position:"relative",
  };

  return (
    <div style={{ perspective:600, position:"relative" }}>
      <div style={{
        ...cardStyle,
        height:"1.1em",
        background:"linear-gradient(180deg,#1c1c1c 0%,#141414 49%,#0d0d0d 50%,#1a1a1a 100%)",
        borderRadius:4,
        boxShadow:"0 4px 16px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 .5px rgba(255,255,255,.06)",
        overflow:"hidden",
      }}>
        {/* top half (static) */}
        <div style={{ position:"absolute",top:0,left:0,right:0,height:"50%",display:"flex",alignItems:"flex-end",justifyContent:"center",overflow:"hidden",paddingBottom:1 }}>
          <span style={{ lineHeight:1, fontSize:"inherit" }}>{display}</span>
        </div>
        {/* bottom half */}
        <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"50%",background:"#0d0d0d",display:"flex",alignItems:"flex-start",justifyContent:"center",overflow:"hidden",paddingTop:1 }}>
          <span style={{ lineHeight:1, fontSize:"inherit", marginTop:"-0.55em" }}>{display}</span>
        </div>
        {/* divider */}
        <div style={{ position:"absolute",top:"50%",left:0,right:0,height:1,background:"rgba(0,0,0,.8)",zIndex:5 }}/>

        {/* flip animation */}
        {flipping && (
          <div style={{
            position:"absolute",top:0,left:0,right:0,height:"50%",
            background:"linear-gradient(180deg,#1c1c1c 0%,#141414 100%)",
            display:"flex",alignItems:"flex-end",justifyContent:"center",overflow:"hidden",
            transformOrigin:"50% 100%", animation:"solariFlip .32s ease-in-out",
            paddingBottom:1,
          }}>
            <span style={{ lineHeight:1 }}>{prevDisplay}</span>
          </div>
        )}
      </div>
      <style>{`@keyframes solariFlip{0%{transform:rotateX(0)}50%{transform:rotateX(-90deg)}100%{transform:rotateX(0)}}`}</style>
    </div>
  );
}

function FlipClock({ now, size }: { now: Date; size: ClockSize }) {
  const s = sz[size];
  const hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
  const parts = [[hh[0],hh[1]],[mm[0],mm[1]],[ss[0],ss[1]]];
  const labels = ["HRS","MIN","SEC"];

  return (
    <div style={{
      background:"linear-gradient(160deg,#111 0%,#0a0a0a 100%)",
      borderRadius:s.br, padding:`${s.pad+2}px ${s.pad}px ${s.pad}px`,
      boxShadow:"0 20px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.05)",
      fontSize:s.tsize,
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
        {parts.map((pair, pi) => (
          <div key={pi} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
            <div style={{ display:"flex",gap:2 }}>
              <FlipCard value={pair[0]} prev={pair[0]} />
              <FlipCard value={pair[1]} prev={pair[1]} />
            </div>
            <span style={{ fontSize:7,letterSpacing:"0.25em",color:"rgba(245,230,200,.3)",fontFamily:"sans-serif" }}>{labels[pi]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   8. ANALOG — Premium Swiss watch face (Omega/Rolex inspired)
   ══════════════════════════════════════════════════════════════ */
function AnalogClock({ now, size }: { now: Date; size: ClockSize }) {
  const dim = sz[size].face;
  const cx = dim / 2;
  const outerR = cx - 2;
  const faceR  = outerR - (dim < 130 ? 8 : 11);

  const sec = now.getSeconds() + now.getMilliseconds() / 1000;
  const min = now.getMinutes() + sec / 60;
  const hr  = (now.getHours() % 12) + min / 60;
  const rad = (v: number, mx: number) => (v / mx * 360 - 90) * Math.PI / 180;
  const pt  = (a: number, r: number) => ({ x: cx + r * Math.cos(a), y: cx + r * Math.sin(a) });

  const secA = rad(sec, 60);
  const minA = rad(min, 60);
  const hrA  = rad(hr, 12);

  // Hand path: baton shape with diamond cross-section feel
  const handPath = (angle: number, length: number, baseW: number, tipW: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const perp = { cos: -sin, sin: cos };
    const tip = { x: cx + length * cos, y: cx + length * sin };
    const base = { x: cx - (length * 0.15) * cos, y: cx - (length * 0.15) * sin };
    const bw = baseW / 2, tw = tipW / 2;
    return `M ${base.x + perp.cos*bw} ${base.y + perp.sin*bw}
            L ${tip.x + perp.cos*tw} ${tip.y + perp.sin*tw}
            L ${tip.x - perp.cos*tw} ${tip.y - perp.sin*tw}
            L ${base.x - perp.cos*bw} ${base.y - perp.sin*bw} Z`;
  };

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="select-none">
      <defs>
        <radialGradient id="swissFace" cx="42%" cy="36%" r="65%">
          <stop offset="0%"  stopColor="#fdfcfa"/>
          <stop offset="55%" stopColor="#f0ede5"/>
          <stop offset="100%" stopColor="#ddd8cc"/>
        </radialGradient>
        <radialGradient id="swissGloss" cx="38%" cy="28%" r="50%">
          <stop offset="0%"  stopColor="rgba(255,255,255,.6)"/>
          <stop offset="50%" stopColor="rgba(255,255,255,.15)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
        <radialGradient id="swissBezel" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#e8e0c8"/>
          <stop offset="40%"  stopColor="#c8b878"/>
          <stop offset="70%"  stopColor="#a89050"/>
          <stop offset="100%" stopColor="#d4af37"/>
        </radialGradient>
        <linearGradient id="hrHand" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#888"/>
          <stop offset="40%"  stopColor="#eee"/>
          <stop offset="60%"  stopColor="#eee"/>
          <stop offset="100%" stopColor="#888"/>
        </linearGradient>
        <linearGradient id="minHand" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#888"/>
          <stop offset="42%"  stopColor="#f0f0f0"/>
          <stop offset="58%"  stopColor="#f0f0f0"/>
          <stop offset="100%" stopColor="#888"/>
        </linearGradient>
        <filter id="handShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,.5)"/>
        </filter>
        <filter id="caseShadow">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="rgba(0,0,0,.5)"/>
        </filter>
      </defs>

      {/* outer case shadow */}
      <circle cx={cx} cy={cx} r={outerR} fill="url(#swissBezel)" filter="url(#caseShadow)"/>
      {/* bezel ring — conic gold */}
      <circle cx={cx} cy={cx} r={outerR} fill="none" stroke="url(#swissBezel)" strokeWidth={dim < 130 ? 9 : 13}/>
      {/* bezel inner edge */}
      <circle cx={cx} cy={cx} r={faceR+1} fill="none" stroke="rgba(80,60,20,.4)" strokeWidth=".8"/>
      {/* dial face */}
      <circle cx={cx} cy={cx} r={faceR} fill="url(#swissFace)"/>
      {/* chapter ring outer */}
      <circle cx={cx} cy={cx} r={faceR} fill="none" stroke="rgba(100,80,30,.25)" strokeWidth=".5"/>

      {/* 60 tick marks */}
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
        const isHour = i % 5 === 0;
        const isQtr  = i % 15 === 0;
        const out  = faceR - 1;
        const inn  = isQtr ? faceR - (dim<130?13:18) : isHour ? faceR - (dim<130?9:13) : faceR - (dim<130?4:6);
        return (
          <line key={i}
            x1={cx + out * Math.cos(a)} y1={cx + out * Math.sin(a)}
            x2={cx + inn * Math.cos(a)} y2={cx + inn * Math.sin(a)}
            stroke={isHour ? "#4a3800" : "#8a7040"}
            strokeWidth={isQtr ? (dim<130?2.2:3) : isHour ? (dim<130?1.6:2.2) : (dim<130?.6:.9)}
            strokeOpacity={isHour ? .85 : .4}
          />
        );
      })}

      {/* applied hour indices — gold rectangles at 12,3,6,9 */}
      {[12,3,6,9].map((n, idx) => {
        const a = ((n / 12) * 360 - 90) * Math.PI / 180;
        const dist = faceR - (dim<130?17:24);
        const ix = cx + dist * Math.cos(a), iy = cx + dist * Math.sin(a);
        const rw = dim<130?7:10, rh = dim<130?3.5:5;
        return (
          <g key={n} transform={`translate(${ix},${iy}) rotate(${idx*90})`}>
            <rect x={-rw/2} y={-rh/2} width={rw} height={rh} rx="1"
              fill="#d4af37" style={{ filter:"drop-shadow(0 0 3px rgba(212,175,55,.8))" }}/>
            <rect x={-rw/2+1} y={-rh/2+.5} width={rw-2} height={rh/2-1} rx=".5"
              fill="rgba(255,255,255,.35)"/>
          </g>
        );
      })}

      {/* hour markers 1-2,4-5,7-8,10-11 — slender gold batons */}
      {[1,2,4,5,7,8,10,11].map(n => {
        const a = ((n / 12) * 360 - 90) * Math.PI / 180;
        const out = faceR - (dim<130?6:8), inn = faceR - (dim<130?13:18);
        return (
          <line key={n}
            x1={cx+out*Math.cos(a)} y1={cx+out*Math.sin(a)}
            x2={cx+inn*Math.cos(a)} y2={cx+inn*Math.sin(a)}
            stroke="#c8a020" strokeWidth={dim<130?2:2.8} strokeLinecap="round" opacity=".8"
          />
        );
      })}

      {/* lume dots between hour markers */}
      {Array.from({length:60},(_,i)=>{
        if(i%5!==0) return null;
        const a=(i/60)*2*Math.PI-Math.PI/2;
        const r2=faceR-(dim<130?9:13);
        return null; // subtle — skip to keep clean
      })}

      {/* brand text */}
      <text x={cx} y={cx - faceR*0.3} textAnchor="middle"
        fontSize={dim<130?7:9} fill="#2a1e00" fontFamily="Georgia,serif"
        letterSpacing="2.5" fontWeight="bold" opacity=".6">AttendX</text>
      <text x={cx} y={cx - faceR*0.18} textAnchor="middle"
        fontSize={dim<130?4.5:6} fill="#6a5a20" fontFamily="sans-serif"
        letterSpacing="1.5" opacity=".45">AUTOMATIC</text>

      {/* hour hand */}
      <path d={handPath(hrA, faceR*(dim<130?.5:.52), dim<130?7:9, dim<130?2.5:3.5)}
        fill="url(#hrHand)" filter="url(#handShadow)"/>
      {/* minute hand */}
      <path d={handPath(minA, faceR*(dim<130?.72:.74), dim<130?5:7, dim<130?1.5:2)}
        fill="url(#minHand)" filter="url(#handShadow)"/>
      {/* second hand */}
      <line
        x1={cx - faceR * .18 * Math.cos(secA)} y1={cx - faceR * .18 * Math.sin(secA)}
        x2={cx + faceR * .85 * Math.cos(secA)} y2={cx + faceR * .85 * Math.sin(secA)}
        stroke="#cc1010" strokeWidth={dim<130?1.3:1.8} strokeLinecap="round"
        style={{ filter:"drop-shadow(0 1px 2px rgba(0,0,0,.4))" }}
      />
      {/* second hand counterweight disc */}
      <circle cx={cx - faceR * .12 * Math.cos(secA)} cy={cx - faceR * .12 * Math.sin(secA)}
        r={dim<130?4:5.5} fill="#cc1010" style={{ filter:"drop-shadow(0 1px 3px rgba(0,0,0,.5))" }}/>

      {/* center cap layers */}
      <circle cx={cx} cy={cx} r={dim<130?6.5:8.5} fill="#d4af37"/>
      <circle cx={cx} cy={cx} r={dim<130?4.5:6}   fill="#1a1200"/>
      <circle cx={cx} cy={cx} r={dim<130?2:3}     fill="rgba(255,255,255,.7)"/>

      {/* glass gloss overlay */}
      <circle cx={cx} cy={cx} r={faceR} fill="url(#swissGloss)"/>
      {/* second minor glint */}
      <ellipse cx={cx+faceR*.3} cy={cx-faceR*.35} rx={faceR*.08} ry={faceR*.04}
        fill="rgba(255,255,255,.22)" transform={`rotate(35,${cx+faceR*.3},${cx-faceR*.35})`}/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   9. MINIMAL — Apple Clock app, pure precision
   ══════════════════════════════════════════════════════════════ */
function MinimalClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{ padding:`${s.pad}px ${s.pad+8}px`, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <div style={{
        fontSize:s.tsize, fontWeight:100,
        fontFamily:"-apple-system,'SF Pro Display',sans-serif",
        fontVariantNumeric:"tabular-nums", letterSpacing:"-0.04em",
        color:"var(--foreground)", lineHeight:1,
        textShadow:"0 1px 4px rgba(0,0,0,.08)",
      }}>{time}</div>
      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
        <div style={{ width:24,height:.5,background:"currentColor",opacity:.2 }}/>
        <span style={{ fontSize:s.dsize, color:"var(--muted-foreground)", letterSpacing:"0.12em", fontFamily:"-apple-system,sans-serif", fontWeight:300, textTransform:"uppercase" }}>{date}</span>
        <div style={{ width:24,height:.5,background:"currentColor",opacity:.2 }}/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   10. NEON TUBE — Individual warm neon tube sign letters
   ══════════════════════════════════════════════════════════════ */
function NeonTubeClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  const palette = ["#ff2424","#ff9a00","#ffee05","#00ff87","#00b4ff","#da70d6"];
  const chars = time.split("");
  return (
    <div style={{
      background:"radial-gradient(ellipse at 50% 40%,#08001a 0%,#020008 70%)",
      borderRadius:s.br, padding:`${s.pad+4}px ${s.pad+6}px`,
      boxShadow:"0 0 0 1px rgba(255,255,255,.04), 0 24px 70px rgba(0,0,0,.95)",
      position:"relative",overflow:"hidden",
    }}>
      {/* tube housing — rounded rect inset */}
      <div style={{
        position:"absolute",inset:"8%",borderRadius:s.br-4,
        border:"1px solid rgba(255,255,255,.04)",
        background:"rgba(255,255,255,.02)",
        pointerEvents:"none",
      }}/>
      {/* per-char glow blobs in bg */}
      {chars.map((c, i) => {
        if (!/[0-9]/.test(c)) return null;
        const col = palette[Math.floor(i/2)%palette.length];
        return <div key={i} style={{ position:"absolute",top:"50%",left:`${(i/(chars.length-1))*100}%`,transform:"translate(-50%,-50%)",width:60,height:60,borderRadius:"50%",background:col,opacity:.08,filter:"blur(18px)",pointerEvents:"none" }}/>;
      })}

      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:1,position:"relative",zIndex:1,marginBottom:6 }}>
        {chars.map((c, i) => {
          const isNum = /[0-9]/.test(c);
          const col = isNum ? palette[Math.floor(i/2)%palette.length] : "rgba(255,255,255,.18)";
          return (
            <span key={i} style={{
              fontFamily:"'Courier New',monospace", fontWeight:900,
              fontSize:s.tsize, color:col,
              textShadow: isNum
                ? `0 0 5px #fff8, 0 0 10px ${col}, 0 0 20px ${col}cc, 0 0 40px ${col}77, 0 0 80px ${col}33`
                : "none",
              letterSpacing:"0.04em",
            }}>{c}</span>
          );
        })}
      </div>
      {/* bottom warm strip */}
      <div style={{ width:"50%",margin:"0 auto 4px",height:.5,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)" }}/>
      <div style={{ textAlign:"center",color:"rgba(255,255,255,.18)",fontSize:s.dsize,letterSpacing:"0.2em",fontFamily:"monospace",position:"relative",zIndex:1 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   11. AURORA — Northern lights OLED watch face
   ══════════════════════════════════════════════════════════════ */
function AuroraClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{
      borderRadius:s.br, padding:`${s.pad+4}px ${s.pad+8}px`,
      background:"linear-gradient(180deg,#02001a 0%,#000412 50%,#000008 100%)",
      boxShadow:"0 0 0 1px rgba(255,255,255,.05), 0 24px 70px rgba(0,0,0,.95)",
      position:"relative",overflow:"hidden",
    }}>
      <style>{`
        @keyframes auroraA{0%{transform:translateX(-8%) scaleY(1) rotate(-2deg)}100%{transform:translateX(8%) scaleY(1.15) rotate(2deg)}}
        @keyframes auroraB{0%{transform:translateX(6%) scaleY(.9) rotate(1deg)}100%{transform:translateX(-6%) scaleY(1.1) rotate(-1deg)}}
        @keyframes auroraC{0%{transform:translateX(0) scaleY(1)}50%{transform:translateX(-4%) scaleY(1.05)}100%{transform:translateX(4%) scaleY(.95)}}
      `}</style>
      {/* aurora layer 1 — green */}
      <div style={{ position:"absolute",top:"-20%",left:"-10%",right:"-10%",height:"60%",background:"radial-gradient(ellipse at 50% 100%,rgba(0,255,120,.28) 0%,rgba(0,200,80,.1) 40%,transparent 70%)",animation:"auroraA 9s ease-in-out infinite alternate",pointerEvents:"none" }}/>
      {/* aurora layer 2 — purple/violet */}
      <div style={{ position:"absolute",top:"-10%",left:"-15%",right:"-15%",height:"55%",background:"radial-gradient(ellipse at 40% 100%,rgba(140,0,255,.22) 0%,rgba(100,0,200,.08) 45%,transparent 70%)",animation:"auroraB 12s ease-in-out infinite alternate",pointerEvents:"none" }}/>
      {/* aurora layer 3 — cyan */}
      <div style={{ position:"absolute",top:"5%",left:"-5%",right:"-5%",height:"45%",background:"radial-gradient(ellipse at 65% 100%,rgba(0,220,255,.18) 0%,rgba(0,160,200,.06) 45%,transparent 70%)",animation:"auroraC 15s ease-in-out infinite alternate",pointerEvents:"none" }}/>
      {/* stars */}
      {[...Array(20)].map((_,i)=>(
        <div key={i} style={{ position:"absolute",width:1.5,height:1.5,borderRadius:"50%",background:"rgba(255,255,255,.6)",top:`${5+Math.sin(i*2.3)*25}%`,left:`${(i*7.3)%95}%`,opacity:0.4+Math.sin(i)*0.3 }}/>
      ))}

      <div style={{
        fontSize:s.tsize, fontWeight:200,
        fontFamily:"-apple-system,sans-serif", fontVariantNumeric:"tabular-nums",
        letterSpacing:"-0.03em", lineHeight:1.05, marginBottom:5,
        background:"linear-gradient(90deg,#a0ffc8,#80dfff,#c0a0ff,#80ffcc)",
        backgroundSize:"300% auto",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        animation:"gradLive 10s linear infinite",
        filter:"drop-shadow(0 0 16px rgba(80,255,160,.35))",
        position:"relative",zIndex:2,
      }}>{time}</div>
      <div style={{ color:"rgba(180,220,255,.35)",fontSize:s.dsize,letterSpacing:"0.06em",position:"relative",zIndex:2 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   12. MATRIX — Digital rain cascade
   ══════════════════════════════════════════════════════════════ */
function MatrixClock({ time, date, size, now }: { time: string; date: string; size: ClockSize; now: Date }) {
  const s = sz[size];
  const rain = Array.from({length:12},(_,i)=>({
    chars:Array.from({length:6},(_,j)=>String.fromCharCode(0x30A0+Math.floor((i*7+j*13+now.getSeconds())%96))),
    x:(i*8.5+3)%100, speed:0.6+i*0.08,
  }));
  return (
    <div style={{
      background:"#000", borderRadius:s.br, padding:`${s.pad+2}px ${s.pad+4}px`,
      boxShadow:"0 0 0 1px rgba(0,255,65,.08), 0 24px 60px rgba(0,0,0,.97)",
      position:"relative",overflow:"hidden", minWidth:size==="small"?180:size==="large"?300:240,
    }}>
      {/* matrix rain background */}
      <div style={{ position:"absolute",inset:0,overflow:"hidden",opacity:.35,pointerEvents:"none" }}>
        {rain.map((col,ci)=>(
          <div key={ci} style={{
            position:"absolute",left:`${col.x}%`,top:0,
            display:"flex",flexDirection:"column",gap:1,
            color:"#00ff41",fontSize:6,fontFamily:"monospace",fontWeight:700,
            animation:`matRain ${col.speed+1.5}s linear infinite`,
            animationDelay:`${ci*0.3}s`,
          }}>
            {col.chars.map((c,j)=>(
              <span key={j} style={{ opacity:1-j*0.15, filter:j===0?"brightness(2) drop-shadow(0 0 3px #00ff41)":"none" }}>{c}</span>
            ))}
          </div>
        ))}
        <style>{`@keyframes matRain{0%{transform:translateY(-100%)}100%{transform:translateY(200%)}}`}</style>
      </div>

      {/* foreground time */}
      <div style={{
        fontFamily:"'Courier New',monospace", fontVariantNumeric:"tabular-nums",
        fontWeight:900, fontSize:s.tsize,
        color:"#00ff41",
        textShadow:"0 0 8px #00ff41, 0 0 16px rgba(0,255,65,.6), 0 0 32px rgba(0,255,65,.3)",
        position:"relative",zIndex:2, marginBottom:4, letterSpacing:"0.1em",
      }}>{time}</div>
      <div style={{ color:"rgba(0,255,65,.35)",fontSize:s.dsize,letterSpacing:"0.2em",fontFamily:"monospace",position:"relative",zIndex:2 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   13. NEON RING — Smartwatch circular progress face
   ══════════════════════════════════════════════════════════════ */
function NeonRingClock({ now, fmt, loc, size }: { now: Date; fmt: ClockFormat; loc: ClockLocale; size: ClockSize }) {
  const dim = sz[size].face;
  const cx = dim / 2;
  const R  = cx - 10;
  const strokeW = dim < 130 ? 8 : 11;

  const sec = now.getSeconds();
  const min = now.getMinutes();
  const hr  = now.getHours();
  const secPct  = sec / 60;
  const minPct  = (min + sec/60) / 60;
  const hrPct   = ((hr % 12) + min/60) / 12;

  const arc = (pct: number, r: number) => {
    const circ = 2 * Math.PI * r;
    return { strokeDasharray: `${pct * circ} ${circ}`, strokeDashoffset: 0 };
  };

  const timeStr = formatTimeShort(now, fmt, loc);
  const [hStr, rest] = timeStr.includes(":") ? [timeStr.split(":")[0], timeStr.slice(timeStr.indexOf(":"))] : [timeStr, ""];

  return (
    <div style={{ position:"relative",width:dim,height:dim }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ position:"absolute",inset:0 }}>
        <defs>
          <linearGradient id="secRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff2d78"/>
            <stop offset="100%" stopColor="#ff9a00"/>
          </linearGradient>
          <linearGradient id="minRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00b4ff"/>
            <stop offset="100%" stopColor="#00ffe7"/>
          </linearGradient>
          <linearGradient id="hrRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9b59ff"/>
            <stop offset="100%" stopColor="#da70d6"/>
          </linearGradient>
        </defs>

        {/* dark face */}
        <circle cx={cx} cy={cx} r={cx} fill="#050505"/>

        {/* track rings */}
        {[R, R-(strokeW+4), R-(strokeW+4)*2].map((r2,i)=>(
          <circle key={i} cx={cx} cy={cx} r={r2} fill="none"
            stroke="rgba(255,255,255,.06)" strokeWidth={strokeW}/>
        ))}

        {/* seconds ring */}
        <circle cx={cx} cy={cx} r={R} fill="none"
          stroke="url(#secRing)" strokeWidth={strokeW}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
          {...arc(secPct, R)}
          style={{ filter:`drop-shadow(0 0 ${dim<130?4:6}px rgba(255,45,120,.7))`, transition:"stroke-dasharray .9s linear" }}
        />
        {/* minutes ring */}
        <circle cx={cx} cy={cx} r={R-(strokeW+4)} fill="none"
          stroke="url(#minRing)" strokeWidth={strokeW}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
          {...arc(minPct, R-(strokeW+4))}
          style={{ filter:`drop-shadow(0 0 ${dim<130?4:5}px rgba(0,180,255,.7))` }}
        />
        {/* hours ring */}
        <circle cx={cx} cy={cx} r={R-(strokeW+4)*2} fill="none"
          stroke="url(#hrRing)" strokeWidth={strokeW}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cx})`}
          {...arc(hrPct, R-(strokeW+4)*2)}
          style={{ filter:`drop-shadow(0 0 ${dim<130?3:4}px rgba(155,89,255,.7))` }}
        />
      </svg>

      {/* center text */}
      <div style={{
        position:"absolute",inset:0,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",
      }}>
        <div style={{
          fontSize:sz[size].tsize*0.75, fontWeight:200,
          fontFamily:"-apple-system,sans-serif", fontVariantNumeric:"tabular-nums",
          color:"#fff", letterSpacing:"-0.04em", lineHeight:1,
          textShadow:"0 0 30px rgba(255,255,255,.3)",
        }}>{timeStr}</div>
        <div style={{ fontSize:sz[size].dsize, color:"rgba(255,255,255,.3)", marginTop:4, letterSpacing:"0.08em" }}>
          {pad(sec)}<span style={{ color:"rgba(255,45,120,.8)" }}>s</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   14. WAVE — Deep ocean with layers
   ══════════════════════════════════════════════════════════════ */
function WaveClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  const w = size === "small" ? 185 : size === "large" ? 300 : 242;
  return (
    <div style={{
      width:w, borderRadius:s.br, padding:`${s.pad+2}px ${s.pad+6}px ${s.pad+16}px`,
      background:"linear-gradient(180deg,#001428 0%,#002a50 40%,#004880 100%)",
      boxShadow:"0 20px 60px rgba(0,30,80,.8), 0 0 0 1px rgba(255,255,255,.07)",
      position:"relative",overflow:"hidden",
    }}>
      {/* depth gradient */}
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(0,150,255,.18),transparent 60%)",pointerEvents:"none" }}/>
      {/* foam surface specular */}
      <div style={{ position:"absolute",top:0,left:"10%",right:"10%",height:1,background:"linear-gradient(90deg,transparent,rgba(150,220,255,.5),transparent)" }}/>

      <div style={{ fontSize:s.tsize,fontWeight:200,fontFamily:"-apple-system,sans-serif",fontVariantNumeric:"tabular-nums",letterSpacing:"-0.03em",color:"#fff",textShadow:"0 2px 12px rgba(0,0,0,.6), 0 0 30px rgba(100,200,255,.2)",position:"relative",zIndex:2,marginBottom:5,lineHeight:1.05 }}>{time}</div>
      <div style={{ color:"rgba(150,210,255,.5)",fontSize:s.dsize,letterSpacing:"0.05em",position:"relative",zIndex:2 }}>{date}</div>

      {/* wave layers */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"38%",overflow:"hidden" }}>
        <svg viewBox="0 0 400 50" preserveAspectRatio="none" style={{ width:"100%",height:"100%" }}>
          <defs>
            <linearGradient id="wave1g" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="rgba(0,160,255,.3)"/>
              <stop offset="100%" stopColor="rgba(0,80,160,.05)"/>
            </linearGradient>
            <linearGradient id="wave2g" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="rgba(100,210,255,.2)"/>
              <stop offset="100%" stopColor="rgba(0,100,180,.05)"/>
            </linearGradient>
          </defs>
          <path fill="url(#wave1g)" style={{animation:"wv1 3.5s ease-in-out infinite"}}>
            <animate attributeName="d"
              values="M0,25 Q50,5 100,25 T200,25 T300,25 T400,25 L400,50 L0,50 Z;M0,18 Q50,38 100,18 T200,18 T300,18 T400,18 L400,50 L0,50 Z;M0,25 Q50,5 100,25 T200,25 T300,25 T400,25 L400,50 L0,50 Z"
              dur="3.5s" repeatCount="indefinite"/>
          </path>
          <path fill="url(#wave2g)" style={{animation:"wv2 5s ease-in-out infinite reverse"}}>
            <animate attributeName="d"
              values="M0,35 Q60,15 120,35 T240,35 T360,35 T480,35 L480,50 L0,50 Z;M0,28 Q60,48 120,28 T240,28 T360,28 T480,28 L480,50 L0,50 Z;M0,35 Q60,15 120,35 T240,35 T360,35 T480,35 L480,50 L0,50 Z"
              dur="5s" repeatCount="indefinite"/>
          </path>
        </svg>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   15. CALENDAR — iOS Calendar + Clock widget
   ══════════════════════════════════════════════════════════════ */
function CalendarClock({ now, fmt, loc, size }: { now: Date; fmt: ClockFormat; loc: ClockLocale; size: ClockSize }) {
  const s = sz[size];
  const months = {
    en:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    ar:["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
    sv:["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"],
  };
  const days = {
    en:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    ar:["أحد","اثن","ثلا","أرب","خمس","جمع","سبت"],
    sv:["Sön","Mån","Tis","Ons","Tor","Fre","Lör"],
  };
  const time = formatTimeShort(now, fmt, loc);
  const month = months[loc][now.getMonth()];
  const day   = days[loc][now.getDay()];
  const calW  = size === "small" ? 56 : size === "large" ? 90 : 72;

  return (
    <div style={{
      display:"flex",alignItems:"stretch",gap:0,
      borderRadius:s.br,overflow:"hidden",
      boxShadow:"0 16px 48px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.08)",
    }}>
      {/* calendar tile */}
      <div style={{ width:calW, background:"#fff", display:"flex",flexDirection:"column",alignItems:"stretch" }}>
        {/* month header — red like iOS */}
        <div style={{ background:"#ff3b30", padding:"4px 0 3px", textAlign:"center", fontSize:s.dsize, fontWeight:700, letterSpacing:"0.1em", color:"#fff", textTransform:"uppercase", fontFamily:"sans-serif" }}>
          {month}
        </div>
        {/* day number */}
        <div style={{ flex:1, display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:size==="small"?32:size==="large"?52:42, fontWeight:100,
          color:"#1c1c1e", fontFamily:"-apple-system,sans-serif", letterSpacing:"-0.03em" }}>
          {now.getDate()}
        </div>
        {/* weekday */}
        <div style={{ padding:"3px 0 4px",textAlign:"center",fontSize:s.dsize-1,fontWeight:600,
          color:"#8e8e93",letterSpacing:"0.08em",background:"#f2f2f7",fontFamily:"sans-serif",textTransform:"uppercase" }}>
          {day}
        </div>
      </div>

      {/* time panel */}
      <div style={{
        flex:1, background:"linear-gradient(145deg,#1c1c1e,#2c2c2e)",
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        padding:`${s.pad}px ${s.pad+4}px`,
        position:"relative",overflow:"hidden",
      }}>
        <div style={{ position:"absolute",top:0,right:0,width:"40%",height:"40%",background:"radial-gradient(circle at 80% 20%,rgba(255,60,50,.12),transparent 70%)",pointerEvents:"none" }}/>
        <div style={{ fontSize:size==="small"?22:size==="large"?38:30, fontWeight:200, fontFamily:"-apple-system,sans-serif", fontVariantNumeric:"tabular-nums", color:"#fff", letterSpacing:"-0.04em", lineHeight:1, textShadow:"0 0 30px rgba(255,255,255,.15)" }}>
          {time}
        </div>
        <div style={{ fontSize:s.dsize, color:"rgba(255,255,255,.35)", marginTop:5, letterSpacing:"0.04em", fontFamily:"sans-serif" }}>
          {pad(now.getSeconds())}<span style={{ color:"rgba(255,60,50,.7)",fontSize:s.dsize-1 }}>s</span>
          {" · "}{now.getFullYear()}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   16. PIXEL — High-res Game Boy / arcade style
   ══════════════════════════════════════════════════════════════ */
function PixelClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{
      background:"linear-gradient(160deg,#0f0f23 0%,#080820 100%)",
      borderRadius:4, padding:`${s.pad}px ${s.pad+4}px`,
      border:"3px solid #2a1a4e",
      boxShadow:"0 0 0 1px #150d30, 4px 4px 0 #0a0818, 0 20px 50px rgba(0,0,0,.9)",
      position:"relative",overflow:"hidden",
    }}>
      {/* scanlines */}
      <div style={{
        position:"absolute",inset:0,
        background:"repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0px,rgba(0,0,0,.25) 1px,transparent 1px,transparent 3px)",
        pointerEvents:"none",zIndex:1,
      }}/>
      {/* CRT corners vignette */}
      <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 50%,transparent 60%,rgba(0,0,0,.7) 100%)",pointerEvents:"none",zIndex:1 }}/>
      {/* screen glow */}
      <div style={{ position:"absolute",inset:"8%",borderRadius:2,background:"radial-gradient(ellipse,rgba(233,32,232,.08),transparent 70%)",pointerEvents:"none" }}/>

      <div style={{
        fontFamily:"'Courier New',monospace", fontVariantNumeric:"tabular-nums",
        fontWeight:700, fontSize:s.tsize, letterSpacing:"0.1em",
        color:"#e920e8",
        textShadow:"0 0 6px #e920e8, 0 0 14px rgba(233,32,232,.6), 0 0 28px rgba(233,32,232,.3)",
        position:"relative",zIndex:2, marginBottom:5,
      }}>{time}</div>

      {/* pixel decoration row */}
      <div style={{ display:"flex",gap:3,marginBottom:5,position:"relative",zIndex:2 }}>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{ width:5,height:3,background:i<Math.floor(new Date().getSeconds()/6)?"#e920e8":"rgba(233,32,232,.15)",boxShadow:i<Math.floor(new Date().getSeconds()/6)?"0 0 4px #e920e8":"none" }}/>
        ))}
      </div>

      <div style={{ fontFamily:"'Courier New',monospace",color:"rgba(233,32,232,.4)",fontSize:s.dsize,letterSpacing:"0.15em",position:"relative",zIndex:2,textTransform:"uppercase" }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   17. SUNBURST — Art Deco gold radial analog
   ══════════════════════════════════════════════════════════════ */
function SunburstClock({ now, date, size }: { now: Date; date: string; size: ClockSize }) {
  const dim = sz[size].face + (size === "large" ? 10 : 0);
  const cx = dim / 2;
  const r  = cx - 6;

  const sec = now.getSeconds();
  const min = now.getMinutes() + sec / 60;
  const hr  = (now.getHours() % 12) + min / 60;
  const rad = (v: number, mx: number) => (v / mx * 360 - 90) * Math.PI / 180;
  const pt  = (a: number, l: number) => ({ x: cx + l * Math.cos(a), y: cx + l * Math.sin(a) });
  const minA = rad(min, 60), hrA = rad(hr, 12), secA = rad(sec, 60);

  const rays = Array.from({length:36},(_,i)=>i);

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="select-none">
        <defs>
          <radialGradient id="sbFace" cx="42%" cy="36%">
            <stop offset="0%"  stopColor="#fff9e6"/>
            <stop offset="70%" stopColor="#f5dea0"/>
            <stop offset="100%" stopColor="#d4a820"/>
          </radialGradient>
          <radialGradient id="sbGloss" cx="38%" cy="28%" r="50%">
            <stop offset="0%"  stopColor="rgba(255,255,255,.5)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <linearGradient id="sbHr" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c4a00"/>
            <stop offset="45%" stopColor="#c8860a"/>
            <stop offset="55%" stopColor="#c8860a"/>
            <stop offset="100%" stopColor="#7c4a00"/>
          </linearGradient>
          <filter id="sbGlow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(212,168,20,.6)"/>
          </filter>
          <filter id="sbHandShadow">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,.45)"/>
          </filter>
        </defs>

        {/* outer gold ring */}
        <circle cx={cx} cy={cx} r={cx-1} fill="none" stroke="#d4a820" strokeWidth={4} filter="url(#sbGlow)"/>
        <circle cx={cx} cy={cx} r={cx-3} fill="none" stroke="#a07010" strokeWidth={.8}/>

        {/* rays */}
        {rays.map(i => {
          const a  = (i / 36) * 2 * Math.PI;
          const long = i % 3 === 0;
          const inn = r * (long ? 0.56 : 0.65);
          return (
            <line key={i}
              x1={pt(a, r * 0.95).x} y1={pt(a, r * 0.95).y}
              x2={pt(a, inn).x}      y2={pt(a, inn).y}
              stroke={long ? "#d4a820" : "#c8960a"}
              strokeWidth={long ? 2.5 : 1}
              strokeOpacity={long ? .95 : .55}
              strokeLinecap="round"
            />
          );
        })}

        {/* face */}
        <circle cx={cx} cy={cx} r={r * 0.54} fill="url(#sbFace)" stroke="#c0900a" strokeWidth="1.5"/>
        <circle cx={cx} cy={cx} r={r * 0.54} fill="url(#sbGloss)"/>

        {/* deco rings */}
        <circle cx={cx} cy={cx} r={r*0.51} fill="none" stroke="#a07010" strokeWidth=".6" opacity=".5"/>

        {/* hour markers on face */}
        {Array.from({length:12},(_,i)=>{
          const a=(i/12)*2*Math.PI-Math.PI/2;
          const out=r*0.49, inn=r*0.42;
          return <line key={i} x1={cx+out*Math.cos(a)} y1={cx+out*Math.sin(a)} x2={cx+inn*Math.cos(a)} y2={cx+inn*Math.sin(a)}
            stroke="#7c4a00" strokeWidth={i%3===0?2:1} strokeLinecap="round" opacity={i%3===0?.85:.5}/>;
        })}

        {/* hour hand */}
        <line x1={cx-6*Math.cos(hrA)} y1={cx-6*Math.sin(hrA)}
          x2={pt(hrA,r*.4).x} y2={pt(hrA,r*.4).y}
          stroke="url(#sbHr)" strokeWidth={dim<130?4:5.5} strokeLinecap="round" filter="url(#sbHandShadow)"/>
        {/* minute hand */}
        <line x1={cx-7*Math.cos(minA)} y1={cx-7*Math.sin(minA)}
          x2={pt(minA,r*.5).x} y2={pt(minA,r*.5).y}
          stroke="#7c4a00" strokeWidth={dim<130?2.5:3.5} strokeLinecap="round" filter="url(#sbHandShadow)"/>
        {/* second hand */}
        <line x1={cx-10*Math.cos(secA)} y1={cx-10*Math.sin(secA)}
          x2={pt(secA,r*.52).x} y2={pt(secA,r*.52).y}
          stroke="#cc2000" strokeWidth={1.2} strokeLinecap="round"/>

        {/* center jewel */}
        <circle cx={cx} cy={cx} r={dim<130?7:9} fill="#d4a820" stroke="#a07010" strokeWidth="1"/>
        <circle cx={cx} cy={cx} r={dim<130?4:5} fill="#fff7dd"/>
        <circle cx={cx} cy={cx} r={dim<130?1.5:2} fill="#d4a820"/>
      </svg>
      <span style={{ color:"var(--muted-foreground)",fontSize:sz[size].dsize,letterSpacing:"0.06em" }}>{date}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   18. HOLOGRAPHIC — Iridescent hologram projection
   ══════════════════════════════════════════════════════════════ */
function HolographicClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{
      borderRadius:s.br, padding:`${s.pad+4}px ${s.pad+8}px`,
      background:"linear-gradient(145deg,rgba(255,255,255,.04),rgba(255,255,255,.01))",
      backdropFilter:"blur(12px)",
      border:"1px solid rgba(255,255,255,.18)",
      boxShadow:"0 24px 70px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.3)",
      position:"relative",overflow:"hidden",
    }}>
      <style>{`
        @keyframes holoShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes holoScan{0%,100%{transform:translateY(-100%)}50%{transform:translateY(200%)}}`}
      </style>
      {/* holographic foil background */}
      <div style={{
        position:"absolute",inset:0,
        background:"linear-gradient(105deg,rgba(255,0,128,.12),rgba(255,165,0,.1),rgba(0,255,128,.1),rgba(0,128,255,.12),rgba(128,0,255,.1),rgba(255,0,128,.12))",
        backgroundSize:"400% 400%",
        animation:"holoShift 8s ease infinite",
        pointerEvents:"none",
      }}/>
      {/* scan line */}
      <div style={{
        position:"absolute",left:0,right:0,height:2,
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)",
        animation:"holoScan 4s ease-in-out infinite",
        pointerEvents:"none",zIndex:3,
      }}/>
      {/* top gloss */}
      <div style={{ position:"absolute",top:0,left:"8%",right:"8%",height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)" }}/>

      <div style={{
        fontSize:s.tsize, fontWeight:200,
        fontFamily:"-apple-system,sans-serif", fontVariantNumeric:"tabular-nums",
        letterSpacing:"-0.025em", lineHeight:1.05, marginBottom:5,
        background:"linear-gradient(90deg,#ff69b4,#ff9a00,#00e5ff,#b44fff,#ff69b4)",
        backgroundSize:"300% auto",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        animation:"gradLive 6s linear infinite",
        filter:"drop-shadow(0 0 12px rgba(180,100,255,.4))",
        position:"relative",zIndex:2,
      }}>{time}</div>
      <div style={{ color:"rgba(255,255,255,.35)",fontSize:s.dsize,letterSpacing:"0.05em",position:"relative",zIndex:2 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   19. GLASS 3D — Tilted premium frosted glass panel
   ══════════════════════════════════════════════════════════════ */
function Glass3DClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  return (
    <div style={{
      borderRadius:s.br, padding:`${s.pad+6}px ${s.pad+10}px ${s.pad+4}px`,
      background:"linear-gradient(155deg,rgba(255,255,255,.28) 0%,rgba(255,255,255,.06) 35%,rgba(255,255,255,.12) 100%)",
      backdropFilter:"blur(28px) saturate(220%) brightness(1.08)",
      WebkitBackdropFilter:"blur(28px) saturate(220%) brightness(1.08)",
      border:"1px solid rgba(255,255,255,.35)",
      boxShadow:"0 32px 80px rgba(0,0,0,.4), inset 0 2px 2px rgba(255,255,255,.6), inset 0 -2px 4px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.15)",
      transform:"perspective(800px) rotateX(5deg) rotateY(-2deg)",
      transformStyle:"preserve-3d",
      position:"relative",overflow:"hidden",
    }}>
      {/* primary gloss dome */}
      <div style={{
        position:"absolute",top:0,left:0,right:0,height:"50%",
        background:"linear-gradient(180deg,rgba(255,255,255,.52) 0%,rgba(255,255,255,.08) 65%,transparent 100%)",
        borderRadius:`${s.br}px ${s.br}px 60% 60%`,
        pointerEvents:"none",
      }}/>
      {/* right edge light */}
      <div style={{ position:"absolute",top:"5%",right:0,width:"12%",height:"88%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent)",pointerEvents:"none" }}/>
      {/* bottom reflection */}
      <div style={{ position:"absolute",bottom:0,left:"15%",right:"15%",height:1,background:"rgba(255,255,255,.25)" }}/>

      <div style={{
        fontSize:s.tsize, fontWeight:300,
        fontFamily:"-apple-system,sans-serif", fontVariantNumeric:"tabular-nums",
        color:"rgba(8,8,20,.88)", letterSpacing:"-0.025em", lineHeight:1.05,
        textShadow:"0 1px 4px rgba(255,255,255,.7), 0 -1px 0 rgba(0,0,0,.04)",
        position:"relative",zIndex:2, marginBottom:5,
      }}>{time}</div>
      <div style={{ color:"rgba(8,8,40,.45)",fontSize:s.dsize,letterSpacing:"0.04em",position:"relative",zIndex:2 }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   20. ORBIT 3D — Planetary orbit analog with cosmos
   ══════════════════════════════════════════════════════════════ */
function Orbit3DClock({ now, date, size }: { now: Date; date: string; size: ClockSize }) {
  const dim = sz[size].face;
  const cx  = dim / 2;
  const r   = cx - 10;

  const sec  = now.getSeconds();
  const min  = now.getMinutes() + sec / 60;
  const hr   = (now.getHours() % 12) + min / 60;
  const rad  = (v: number, mx: number) => (v / mx * 360 - 90) * Math.PI / 180;
  const pt   = (a: number, l: number) => ({ x: cx + l * Math.cos(a), y: cx + l * Math.sin(a) });
  const minA = rad(min, 60), hrA = rad(hr, 12), secA = rad(sec, 60);

  // Planet positions on orbit rings
  const secPlanet = pt(secA,  r * 0.90);
  const minPlanet = pt(minA,  r * 0.68);
  const hrPlanet  = pt(hrA,   r * 0.46);

  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="select-none">
        <defs>
          <radialGradient id="orb3dBg" cx="50%" cy="50%">
            <stop offset="0%"  stopColor="#0c0120"/>
            <stop offset="60%" stopColor="#060010"/>
            <stop offset="100%" stopColor="#020008"/>
          </radialGradient>
          <radialGradient id="orb3dSun" cx="40%" cy="35%">
            <stop offset="0%"  stopColor="#fff8c0"/>
            <stop offset="40%" stopColor="#ffd040"/>
            <stop offset="100%" stopColor="#c07000"/>
          </radialGradient>
          <filter id="orb3dGlow">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* cosmos background */}
        <circle cx={cx} cy={cx} r={cx} fill="url(#orb3dBg)"/>
        {/* stars */}
        {[...Array(30)].map((_,i)=>(
          <circle key={i} cx={cx+Math.cos(i*1.1)*cx*.92} cy={cx+Math.sin(i*1.7)*cx*.92}
            r={.6+i*.08%1.2} fill="rgba(255,255,255,.7)" opacity={.3+Math.sin(i)*.3}/>
        ))}

        {/* orbit rings */}
        <circle cx={cx} cy={cx} r={r*.90} fill="none" stroke="rgba(140,100,255,.15)" strokeWidth=".8" strokeDasharray="4 6"/>
        <circle cx={cx} cy={cx} r={r*.68} fill="none" stroke="rgba(0,180,255,.15)"   strokeWidth=".8" strokeDasharray="3 5"/>
        <circle cx={cx} cy={cx} r={r*.46} fill="none" stroke="rgba(255,180,0,.15)"   strokeWidth=".8" strokeDasharray="3 4"/>

        {/* hour markers — star dots */}
        {Array.from({length:12},(_,i)=>{
          const a=(i/12)*2*Math.PI-Math.PI/2;
          return <circle key={i} cx={cx+(r*.95)*Math.cos(a)} cy={cx+(r*.95)*Math.sin(a)}
            r={i%3===0?2:1} fill="rgba(200,180,255,.6)" opacity={i%3===0?.9:.4}/>;
        })}

        {/* Sun — center */}
        <circle cx={cx} cy={cx} r={dim<130?11:15} fill="url(#orb3dSun)"
          style={{filter:`drop-shadow(0 0 ${dim<130?8:12}px rgba(255,200,0,.7)) drop-shadow(0 0 ${dim<130?16:24}px rgba(255,140,0,.4))`}}/>
        <circle cx={cx} cy={cx} r={dim<130?6:8} fill="rgba(255,255,240,.5)"/>

        {/* hour planet — warm orange */}
        <circle cx={hrPlanet.x} cy={hrPlanet.y} r={dim<130?6:8} fill="#ff8800"
          style={{filter:`drop-shadow(0 0 6px rgba(255,136,0,.8)) drop-shadow(0 0 14px rgba(255,136,0,.4))`}}/>
        <circle cx={hrPlanet.x+dim*.012} cy={hrPlanet.y-dim*.012} r={dim<130?2:3} fill="rgba(255,200,100,.5)"/>

        {/* minute planet — blue */}
        <circle cx={minPlanet.x} cy={minPlanet.y} r={dim<130?4.5:6} fill="#0088ff"
          style={{filter:`drop-shadow(0 0 5px rgba(0,136,255,.8)) drop-shadow(0 0 12px rgba(0,136,255,.4))`}}/>
        <circle cx={minPlanet.x+dim*.008} cy={minPlanet.y-dim*.008} r={dim<130?1.5:2} fill="rgba(150,210,255,.5)"/>

        {/* second dot — tiny fast comet */}
        <circle cx={secPlanet.x} cy={secPlanet.y} r={dim<130?2.5:3.5} fill="#ff3366"
          style={{filter:`drop-shadow(0 0 4px rgba(255,50,100,.9)) drop-shadow(0 0 10px rgba(255,50,100,.5))`}}/>

        {/* outer boundary ring */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
      </svg>
      <span style={{ color:"var(--muted-foreground)",fontSize:sz[size].dsize,letterSpacing:"0.06em" }}>{date}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   21. WATCH 3D — Luxury gold wristwatch (Rolex/Omega inspired)
   ══════════════════════════════════════════════════════════════ */
function Watch3DClock({ now, size }: { now: Date; size: ClockSize }) {
  const dim = size === "small" ? 122 : size === "large" ? 200 : 158;
  const cx = dim / 2;
  const outerR = cx - 2;
  const bezelW = dim < 140 ? 9 : 12;
  const faceR = outerR - bezelW;

  const sec = now.getSeconds();
  const min = now.getMinutes() + sec / 60;
  const hr  = (now.getHours() % 12) + min / 60;
  const toRad = (v: number, mx: number) => (v / mx * 360 - 90) * Math.PI / 180;
  const secA = toRad(sec, 60), minA = toRad(min, 60), hrA = toRad(hr, 12);
  const pt = (a: number, l: number): [number, number] => [cx + l * Math.cos(a), cx + l * Math.sin(a)];
  const [hx, hy] = pt(hrA,  faceR * 0.46);
  const [mx, my] = pt(minA, faceR * 0.68);
  const [sx, sy] = pt(secA, faceR * 0.80);
  const [bx, by] = pt(secA + Math.PI, faceR * 0.22);

  return (
    <div className="flex flex-col items-center" style={{ gap: 0, padding: 4 }}>
      <div style={{ width: dim < 140 ? 5 : 7, height: dim < 140 ? 12 : 16, background: "linear-gradient(180deg,#d4af37,#8b6914)", borderRadius: "3px 3px 0 0", boxShadow: "0 -2px 6px rgba(0,0,0,.4)" }} />
      <div className="relative" style={{
        width: dim, height: dim, borderRadius: "50%",
        background: "conic-gradient(from 195deg,#c8a000,#f7d760,#ffe480,#b89000,#f7d760,#a87c00,#ffe080,#c8a000)",
        boxShadow: "0 0 0 1.5px rgba(0,0,0,.45),0 6px 18px rgba(0,0,0,.65),0 14px 36px rgba(0,0,0,.35),inset 0 2px 4px rgba(255,255,255,.5),inset 0 -2px 4px rgba(0,0,0,.4)",
        transform: "perspective(500px) rotateX(7deg)",
      }}>
        <div style={{ position:"absolute", right: -11, top:"50%", transform:"translateY(-50%)", width: dim<140?10:13, height: dim<140?20:26, background:"linear-gradient(90deg,#ffe080,#c8a000,#d4af37)", borderRadius:3, boxShadow:"2px 0 8px rgba(0,0,0,.45)", zIndex:10 }} />
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ position:"absolute", inset:0, borderRadius:"50%", overflow:"hidden" }} className="select-none">
          <defs>
            <radialGradient id="w3dFace" cx="42%" cy="37%">
              <stop offset="0%"   stopColor="#1a1a2e" />
              <stop offset="65%"  stopColor="#0e0d1a" />
              <stop offset="100%" stopColor="#07060f" />
            </radialGradient>
            <radialGradient id="w3dGloss" cx="37%" cy="27%" r="45%">
              <stop offset="0%"   stopColor="rgba(255,255,255,.22)" />
              <stop offset="55%"  stopColor="rgba(255,255,255,.05)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <linearGradient id="w3dBezel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#f7d760" />
              <stop offset="50%"  stopColor="#b89000" />
              <stop offset="100%" stopColor="#f7d760" />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cx} r={outerR} fill="none" stroke="url(#w3dBezel)" strokeWidth={bezelW} />
          <circle cx={cx} cy={cx} r={faceR} fill="url(#w3dFace)" />
          {Array.from({length:60},(_,i)=>{
            const a=(i/60)*2*Math.PI-Math.PI/2, isH=i%5===0;
            const out=faceR-1, inn=isH?faceR-(dim<140?10:13):faceR-(dim<140?4:6);
            return <line key={i} x1={cx+out*Math.cos(a)} y1={cx+out*Math.sin(a)} x2={cx+inn*Math.cos(a)} y2={cx+inn*Math.sin(a)} stroke={isH?"#d4af37":"#44445a"} strokeWidth={isH?(dim<140?1.5:2):.7} strokeLinecap="round"/>;
          })}
          {[0,3,6,9].map((n,i)=>{
            const a=(n/12)*2*Math.PI-Math.PI/2;
            const ix=cx+(faceR-(dim<140?16:21))*Math.cos(a), iy=cx+(faceR-(dim<140?16:21))*Math.sin(a);
            const rw=dim<140?7:9, rh=dim<140?3.5:4.5;
            return <g key={n} transform={`translate(${ix},${iy}) rotate(${i*90})`}>
              <rect x={-rw/2} y={-rh/2} width={rw} height={rh} rx="1" fill="#d4af37" style={{filter:"drop-shadow(0 0 3px #d4af3788)"}}/>
            </g>;
          })}
          {[1,2,4,5,7,8,10,11].map(n=>{
            const a=(n/12)*2*Math.PI-Math.PI/2;
            const out=faceR-(dim<140?5:7), inn=faceR-(dim<140?12:15);
            return <line key={n} x1={cx+out*Math.cos(a)} y1={cx+out*Math.sin(a)} x2={cx+inn*Math.cos(a)} y2={cx+inn*Math.sin(a)} stroke="#d4af37" strokeWidth={dim<140?1.5:2} strokeLinecap="round" opacity=".75"/>;
          })}
          <text x={cx} y={cx-faceR*.34} textAnchor="middle" fontSize={dim<140?7:9} fill="#d4af37" fontFamily="Georgia,serif" letterSpacing="2" opacity=".8">AttendX</text>
          <text x={cx} y={cx-faceR*.2} textAnchor="middle" fontSize={dim<140?4.5:6} fill="#7788aa" fontFamily="sans-serif" letterSpacing="1" opacity=".55">AUTOMATIC</text>
          <line x1={cx-(dim<140?7:9)*Math.cos(hrA)} y1={cx-(dim<140?7:9)*Math.sin(hrA)} x2={hx} y2={hy} stroke="#d4af37" strokeWidth={dim<140?4.5:6} strokeLinecap="round" style={{filter:"drop-shadow(0 2px 4px rgba(0,0,0,.7))"}}/>
          <line x1={cx} y1={cx} x2={hx} y2={hy} stroke="#ffe080" strokeWidth={dim<140?1.5:2.5} strokeLinecap="round" opacity=".4"/>
          <line x1={cx-(dim<140?9:11)*Math.cos(minA)} y1={cx-(dim<140?9:11)*Math.sin(minA)} x2={mx} y2={my} stroke="#d4af37" strokeWidth={dim<140?3:4} strokeLinecap="round" style={{filter:"drop-shadow(0 2px 4px rgba(0,0,0,.6))"}}/>
          <line x1={cx} y1={cx} x2={mx} y2={my} stroke="#ffe080" strokeWidth={dim<140?1:1.5} strokeLinecap="round" opacity=".35"/>
          <line x1={bx} y1={by} x2={sx} y2={sy} stroke="#dd1111" strokeWidth={dim<140?1.1:1.5} strokeLinecap="round" style={{filter:"drop-shadow(0 1px 3px rgba(0,0,0,.5))"}}/>
          <circle cx={bx} cy={by} r={dim<140?3.5:4.5} fill="#dd1111"/>
          <circle cx={cx} cy={cx} r={dim<140?5:7} fill="#d4af37" stroke="#a87c00" strokeWidth="1.2"/>
          <circle cx={cx} cy={cx} r={dim<140?2:3} fill="#fff7aa"/>
          <ellipse cx={cx*.65} cy={cx*.54} rx={faceR*.38} ry={faceR*.22} fill="url(#w3dGloss)" transform={`rotate(-35,${cx},${cx})`}/>
        </svg>
      </div>
      <div style={{ width: dim<140?5:7, height: dim<140?12:16, background: "linear-gradient(180deg,#8b6914,#d4af37)", borderRadius: "0 0 3px 3px", boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   22. DESK 3D — Classic mahogany mantel clock
   ══════════════════════════════════════════════════════════════ */
function Desk3DClock({ now, size }: { now: Date; size: ClockSize }) {
  const W=size==="small"?108:size==="large"?168:138, H=W, D=size==="small"?12:size==="large"?18:15;
  const totalW=W+D, totalH=H+D;
  const cx=W/2, cy=H/2+D, fr=W/2-10;
  const sec=now.getSeconds(), min=now.getMinutes()+sec/60, hr=(now.getHours()%12)+min/60;
  const toRad=(v:number,mx:number)=>(v/mx*360-90)*Math.PI/180;
  const secA=toRad(sec,60), minA=toRad(min,60), hrA=toRad(hr,12);
  const pt=(a:number,l:number):[number,number]=>[cx+l*Math.cos(a),cy+l*Math.sin(a)];
  const romans=["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];

  return (
    <div style={{ padding:6 }}>
      <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="select-none">
        <defs>
          <radialGradient id="d3dFace" cx="40%" cy="35%"><stop offset="0%" stopColor="#faf6ef"/><stop offset="100%" stopColor="#ddd0b0"/></radialGradient>
          <linearGradient id="d3dRight" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3d1f0a"/><stop offset="100%" stopColor="#1e0d04"/></linearGradient>
          <linearGradient id="d3dTop" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#7a5028"/><stop offset="100%" stopColor="#4a2e10"/></linearGradient>
          <filter id="d3dShadow"><feDropShadow dx="3" dy="5" stdDeviation="5" floodColor="rgba(0,0,0,.55)"/></filter>
          <radialGradient id="d3dGloss" cx="38%" cy="28%" r="50%"><stop offset="0%" stopColor="rgba(255,255,255,.45)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>
        </defs>
        <path d={`M${W},${D} L${totalW},0 L${totalW},${H} L${W},${totalH} Z`} fill="url(#d3dRight)"/>
        <path d={`M0,${D} L${D},0 L${totalW},0 L${W},${D} Z`} fill="url(#d3dTop)"/>
        <rect x={0} y={D} width={W} height={H} rx="7" fill="#2c1610" filter="url(#d3dShadow)"/>
        <rect x={5} y={D+5} width={W-10} height={H-10} rx="4" fill="none" stroke="#8b5e2e" strokeWidth="1.5" opacity=".7"/>
        <circle cx={cx} cy={cy} r={fr} fill="url(#d3dFace)" stroke="#c8942a" strokeWidth="2.5"/>
        <circle cx={cx} cy={cy} r={fr-4} fill="none" stroke="#b07820" strokeWidth=".8" opacity=".5"/>
        {romans.map((lbl,i)=>{
          const a=(i/12)*2*Math.PI-Math.PI/2;
          const tx=cx+(fr-(W<120?12:17))*Math.cos(a), ty=cy+(fr-(W<120?12:17))*Math.sin(a);
          return <text key={i} x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize={W<120?6:8} fontFamily="Georgia,serif" fill="#4a2e0a" fontWeight="bold" opacity=".9">{lbl}</text>;
        })}
        {Array.from({length:60},(_,i)=>{
          if(i%5===0) return null;
          const a=(i/60)*2*Math.PI-Math.PI/2;
          return <line key={i} x1={cx+(fr-2)*Math.cos(a)} y1={cy+(fr-2)*Math.sin(a)} x2={cx+(fr-5)*Math.cos(a)} y2={cy+(fr-5)*Math.sin(a)} stroke="#7a5030" strokeWidth=".7" opacity=".45"/>;
        })}
        <line x1={cx-6*Math.cos(hrA)} y1={cy-6*Math.sin(hrA)} x2={pt(hrA,fr*.52)[0]} y2={pt(hrA,fr*.52)[1]} stroke="#1c0e06" strokeWidth={W<120?4:5.5} strokeLinecap="round" style={{filter:"drop-shadow(0 1px 3px rgba(0,0,0,.5))"}}/>
        <line x1={cx-8*Math.cos(minA)} y1={cy-8*Math.sin(minA)} x2={pt(minA,fr*.73)[0]} y2={pt(minA,fr*.73)[1]} stroke="#1c0e06" strokeWidth={W<120?3:4} strokeLinecap="round" style={{filter:"drop-shadow(0 1px 3px rgba(0,0,0,.4))"}}/>
        <line x1={cx-10*Math.cos(secA)} y1={cy-10*Math.sin(secA)} x2={pt(secA,fr*.86)[0]} y2={pt(secA,fr*.86)[1]} stroke="#880000" strokeWidth={1.2} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={W<120?4:5} fill="#1c0e06"/>
        <circle cx={cx} cy={cy} r={W<120?2:2.5} fill="#c8942a"/>
        <circle cx={cx} cy={cx*.84+D} r={fr} fill="url(#d3dGloss)"/>
        <rect x={8} y={D+H-4} width={W-16} height={6} rx="2" fill="#8b5e2e" opacity=".8"/>
        <rect x={14} y={D+H+1} width={12} height={5} rx="2" fill="#5a3818"/>
        <rect x={W-26} y={D+H+1} width={12} height={5} rx="2" fill="#5a3818"/>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   23. CRYSTAL 3D — Crystal ball with light refraction
   ══════════════════════════════════════════════════════════════ */
function Crystal3DClock({ now, size }: { now: Date; size: ClockSize }) {
  const dim=size==="small"?124:size==="large"?204:162;
  const cx=dim/2, cy=dim/2, r=cx-4;
  const sec=now.getSeconds(), min=now.getMinutes()+sec/60, hr=(now.getHours()%12)+min/60;
  const toRad=(v:number,mx:number)=>(v/mx*360-90)*Math.PI/180;
  const secA=toRad(sec,60), minA=toRad(min,60), hrA=toRad(hr,12);
  const pt=(a:number,l:number):[number,number]=>[cx+l*Math.cos(a),cy+l*Math.sin(a)];
  const [hx,hy]=pt(hrA,r*.47), [mx2,my2]=pt(minA,r*.68), [sx2,sy2]=pt(secA,r*.81), [bx,by]=pt(secA+Math.PI,r*.2);

  return (
    <div style={{ padding:4 }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="select-none">
        <defs>
          <radialGradient id="cr3dInner" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#1a2a6c"/><stop offset="60%" stopColor="#0a1445"/><stop offset="100%" stopColor="#060c2a"/></radialGradient>
          <radialGradient id="cr3dOuter" cx="38%" cy="32%" r="65%"><stop offset="0%" stopColor="rgba(220,235,255,.82)"/><stop offset="35%" stopColor="rgba(160,200,255,.35)"/><stop offset="75%" stopColor="rgba(80,140,255,.12)"/><stop offset="100%" stopColor="rgba(20,60,200,.4)"/></radialGradient>
          <radialGradient id="cr3dSpec1" cx="36%" cy="29%" r="32%"><stop offset="0%" stopColor="rgba(255,255,255,.95)"/><stop offset="45%" stopColor="rgba(255,255,255,.22)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>
          <radialGradient id="cr3dSpec2" cx="68%" cy="75%" r="25%"><stop offset="0%" stopColor="rgba(160,210,255,.38)"/><stop offset="100%" stopColor="rgba(160,210,255,0)"/></radialGradient>
          <radialGradient id="cr3dRim" cx="50%" cy="50%" r="50%"><stop offset="82%" stopColor="rgba(255,255,255,0)"/><stop offset="96%" stopColor="rgba(255,255,255,.18)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/></radialGradient>
          <filter id="cr3dGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="cr3dShadow"><feGaussianBlur stdDeviation="3" in="SourceAlpha" result="b"/><feOffset dx="0" dy="6" in="b" result="o"/><feFlood floodColor="rgba(10,20,80,.4)" result="c"/><feComposite in="c" in2="o" operator="in" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="cr3dClip"><circle cx={cx} cy={cy} r={r-1}/></clipPath>
        </defs>
        <ellipse cx={cx} cy={dim-3} rx={r*.6} ry={r*.13} fill="rgba(10,20,80,.3)" style={{filter:"blur(4px)"}}/>
        <circle cx={cx} cy={cy} r={r} fill="url(#cr3dInner)" filter="url(#cr3dShadow)"/>
        {Array.from({length:60},(_,i)=>{
          const a=(i/60)*2*Math.PI-Math.PI/2, isH=i%5===0;
          const out=r*.88, inn=isH?r*.76:r*.83;
          return <line key={i} clipPath="url(#cr3dClip)" x1={cx+out*Math.cos(a)} y1={cy+out*Math.sin(a)} x2={cx+inn*Math.cos(a)} y2={cy+inn*Math.sin(a)} stroke={isH?"rgba(160,210,255,.75)":"rgba(100,160,255,.25)"} strokeWidth={isH?1.5:.8} strokeLinecap="round"/>;
        })}
        {[0,3,6,9].map(n=>{
          const a=(n/12)*2*Math.PI-Math.PI/2;
          const [dx,dy]=pt(a,r*.78) as [number,number];
          return <circle key={n} cx={dx} cy={dy} r={dim<140?2.5:3.5} fill="rgba(180,220,255,.8)" style={{filter:"drop-shadow(0 0 4px rgba(150,200,255,.9))"}}/>;
        })}
        <line clipPath="url(#cr3dClip)" x1={cx-8*Math.cos(hrA)} y1={cy-8*Math.sin(hrA)} x2={hx} y2={hy} stroke="rgba(210,230,255,.95)" strokeWidth={dim<140?3.5:5} strokeLinecap="round" style={{filter:"drop-shadow(0 0 5px rgba(140,200,255,.85))"}}/>
        <line clipPath="url(#cr3dClip)" x1={cx-10*Math.cos(minA)} y1={cy-10*Math.sin(minA)} x2={mx2} y2={my2} stroke="rgba(210,230,255,.9)" strokeWidth={dim<140?2.5:3.5} strokeLinecap="round" style={{filter:"drop-shadow(0 0 4px rgba(140,200,255,.75))"}}/>
        <line clipPath="url(#cr3dClip)" x1={bx} y1={by} x2={sx2} y2={sy2} stroke="rgba(255,120,120,.85)" strokeWidth={dim<140?1.2:1.6} strokeLinecap="round"/>
        <circle clipPath="url(#cr3dClip)" cx={bx} cy={by} r={dim<140?3:4} fill="rgba(255,100,100,.85)"/>
        <circle clipPath="url(#cr3dClip)" cx={cx} cy={cy} r={dim<140?4:5.5} fill="rgba(200,220,255,.9)" style={{filter:"drop-shadow(0 0 6px rgba(150,210,255,1))"}}/>
        <circle clipPath="url(#cr3dClip)" cx={cx} cy={cy} r={dim<140?1.5:2} fill="rgba(255,255,255,.95)"/>
        <circle cx={cx} cy={cy} r={r} fill="url(#cr3dOuter)"/>
        <circle cx={cx} cy={cy} r={r} fill="url(#cr3dSpec1)"/>
        <circle cx={cx} cy={cy} r={r} fill="url(#cr3dSpec2)"/>
        <circle cx={cx} cy={cy} r={r} fill="url(#cr3dRim)"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth=".8"/>
        <ellipse cx={cx+r*.42} cy={cy+r*.5} rx={r*.1} ry={r*.05} fill="rgba(255,255,255,.22)" transform={`rotate(38,${cx+r*.42},${cy+r*.5})`}/>
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   24. SCI-FI — multi-ring neon analog (pink + cyan)
   ══════════════════════════════════════════════════════════════ */
function SciFiClock({ now, size }: { now: Date; size: ClockSize }) {
  const dim = sz[size].face;
  const cx = dim / 2, cy = dim / 2, r = dim / 2 - 5;
  const sec = now.getSeconds() + now.getMilliseconds() / 1000;
  const min = now.getMinutes() + sec / 60;
  const hr  = (now.getHours() % 12) + min / 60;
  const toXY = (a: number, rad: number): [number, number] => [
    cx + rad * Math.cos(a - Math.PI / 2),
    cy + rad * Math.sin(a - Math.PI / 2),
  ];
  const secA = (sec / 60) * 2 * Math.PI;
  const minA = (min / 60) * 2 * Math.PI;
  const hrA  = (hr  / 12) * 2 * Math.PI;
  const [sx, sy] = toXY(secA, r * 0.82);
  const [mx, my] = toXY(minA, r * 0.70);
  const [hx, hy] = toXY(hrA,  r * 0.50);
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const romans = [
    { label: "XII", a: 0 }, { label: "III", a: Math.PI / 2 },
    { label: "VI",  a: Math.PI }, { label: "IX", a: (3 * Math.PI) / 2 },
  ];
  const secCirc = 2 * Math.PI * r * 0.78;
  return (
    <div style={{
      width: dim, height: dim,
      background: "radial-gradient(circle at 50% 45%,#100820 0%,#05030d 70%)",
      borderRadius: "50%",
      boxShadow: "0 0 60px rgba(200,60,255,.2),0 0 120px rgba(0,150,255,.12),inset 0 0 40px rgba(0,0,0,.9)",
      position: "relative",
    }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <defs>
          <filter id="sfG1"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="sfG2"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* tick ring */}
        {ticks.map(i => {
          const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
          const maj = i % 5 === 0;
          const r1 = r - 2, r2 = r - (maj ? 11 : 5);
          return <line key={i}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke={maj ? "rgba(0,210,255,.85)" : "rgba(0,150,200,.35)"}
            strokeWidth={maj ? 1.6 : 0.7}/>;
        })}
        {/* outer cyan ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,210,255,.65)" strokeWidth="1.5"
          style={{ filter:"drop-shadow(0 0 6px rgba(0,210,255,.9))" }}/>
        {/* pink arc = second progress */}
        <circle cx={cx} cy={cy} r={r * 0.78} fill="none"
          stroke="rgba(255,40,180,.9)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${(sec / 60) * secCirc} ${secCirc}`}
          transform={`rotate(-90,${cx},${cy})`}
          style={{ filter:"drop-shadow(0 0 8px rgba(255,40,180,1))" }}/>
        {/* static pink ring */}
        <circle cx={cx} cy={cy} r={r * 0.78} fill="none"
          stroke="rgba(255,40,180,.18)" strokeWidth="1.2"/>
        {/* inner rings */}
        <circle cx={cx} cy={cy} r={r * 0.57} fill="none" stroke="rgba(100,60,200,.4)" strokeWidth="0.8"/>
        <circle cx={cx} cy={cy} r={r * 0.38} fill="none" stroke="rgba(0,150,255,.25)" strokeWidth="0.6"/>
        {/* Roman numerals */}
        {romans.map(({ label, a }) => {
          const [rx, ry] = toXY(a, r * 0.63);
          return <text key={label} x={rx} y={ry}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgba(220,170,255,.85)"
            fontSize={dim < 140 ? 7 : 9} fontFamily="Georgia,serif"
            style={{ filter:"drop-shadow(0 0 4px rgba(200,100,255,.8))" }}>
            {label}
          </text>;
        })}
        {/* hands */}
        <line x1={cx - 5 * Math.cos(minA - Math.PI / 2)} y1={cy - 5 * Math.sin(minA - Math.PI / 2)}
          x2={mx} y2={my} stroke="rgba(255,40,180,.9)" strokeWidth={dim < 140 ? 2 : 2.8}
          strokeLinecap="round" style={{ filter:"drop-shadow(0 0 6px rgba(255,40,180,1))" }}/>
        <line x1={cx - 5 * Math.cos(hrA - Math.PI / 2)} y1={cy - 5 * Math.sin(hrA - Math.PI / 2)}
          x2={hx} y2={hy} stroke="rgba(255,40,180,.95)" strokeWidth={dim < 140 ? 3 : 4}
          strokeLinecap="round" style={{ filter:"drop-shadow(0 0 8px rgba(255,40,180,1))" }}/>
        <line x1={cx} y1={cy} x2={sx} y2={sy}
          stroke="rgba(0,220,255,.9)" strokeWidth={dim < 140 ? 1 : 1.4}
          strokeLinecap="round" style={{ filter:"drop-shadow(0 0 4px rgba(0,220,255,1))" }}/>
        {/* center */}
        <circle cx={cx} cy={cy} r={dim < 140 ? 4 : 5.5} fill="rgba(255,40,180,.9)"
          style={{ filter:"drop-shadow(0 0 8px rgba(255,40,180,1))" }}/>
        <circle cx={cx} cy={cy} r={dim < 140 ? 1.5 : 2} fill="rgba(255,255,255,.9)"/>
        {/* scatter glow dots */}
        {[0,1,2,3,4,5,6,7].map(i => {
          const pa = (i / 8) * 2 * Math.PI + 0.3;
          const pr = r * (0.89 + (i % 3) * 0.02);
          return <circle key={i} cx={cx + pr * Math.cos(pa)} cy={cy + pr * Math.sin(pa)}
            r={1.2} fill={i % 2 === 0 ? "rgba(0,200,255,.7)" : "rgba(255,40,180,.6)"}/>;
        })}
      </svg>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   25. HOLO — holographic projection with light beam
   ══════════════════════════════════════════════════════════════ */
function HoloClock({ time, date, size }: { time: string; date: string; size: ClockSize }) {
  const s = sz[size];
  const w = size === "small" ? 210 : size === "large" ? 340 : 275;
  const h = Math.round(w * 0.54);
  return (
    <div style={{
      width: w, height: h,
      background: "linear-gradient(180deg,#001428 0%,#002040 50%,#000e1a 100%)",
      borderRadius: s.br,
      position: "relative", overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,.9),0 0 0 1px rgba(0,150,255,.15)",
    }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
        style={{ position:"absolute", top:0, left:0 }}>
        <defs>
          <filter id="holoG"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="beamG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,200,255,0)"/>
            <stop offset="100%" stopColor="rgba(0,200,255,.45)"/>
          </linearGradient>
        </defs>
        {/* circuit grid */}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`v${i}`} x1={i * w / 6} y1={h * 0.55} x2={i * w / 6} y2={h}
            stroke="rgba(0,150,255,.12)" strokeWidth="0.7"/>
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={h * 0.55 + i * (h * 0.45 / 4)} x2={w} y2={h * 0.55 + i * (h * 0.45 / 4)}
            stroke="rgba(0,130,255,.1)" strokeWidth="0.7"/>
        ))}
        {/* light beam */}
        <polygon
          points={`${w/2 - w*0.17},${h*0.32} ${w/2 + w*0.17},${h*0.32} ${w/2 + w*0.045},${h*0.76} ${w/2 - w*0.045},${h*0.76}`}
          fill="url(#beamG)" opacity="0.4"/>
        <line x1={w/2 - w*0.17} y1={h*0.32} x2={w/2 - w*0.045} y2={h*0.76}
          stroke="rgba(0,200,255,.2)" strokeWidth="0.8"/>
        <line x1={w/2 + w*0.17} y1={h*0.32} x2={w/2 + w*0.045} y2={h*0.76}
          stroke="rgba(0,200,255,.2)" strokeWidth="0.8"/>
        {/* platform rings */}
        {[0.28,0.21,0.15,0.09].map((rr, i) => (
          <ellipse key={i} cx={w/2} cy={h*0.8} rx={w*rr} ry={h*rr*0.32}
            fill={i===0?"rgba(0,140,255,.08)":"none"}
            stroke={`rgba(0,${155+i*18},255,${0.28-i*0.05})`} strokeWidth={i===0?1:0.6}/>
        ))}
        {/* orb */}
        <circle cx={w/2} cy={h*0.8} r={h*0.07}
          fill="rgba(0,180,255,.85)" style={{ filter:"url(#holoG)" }}/>
        <circle cx={w/2} cy={h*0.8} r={h*0.032} fill="rgba(200,240,255,.95)"/>
        {/* corner circuit dots */}
        {[[0.08,0.7],[0.92,0.7],[0.08,0.85],[0.92,0.85]].map(([px,py],i) => (
          <circle key={i} cx={w*px} cy={h*py} r={2}
            fill="rgba(0,180,255,.3)" stroke="rgba(0,180,255,.5)" strokeWidth="0.5"/>
        ))}
      </svg>
      {/* time */}
      <div style={{
        position:"absolute", top:"8%", width:"100%", textAlign:"center",
        fontFamily:"'Courier New',monospace",
        fontSize: s.tsize * 0.78, fontWeight:700,
        color:"rgba(0,230,255,.95)", letterSpacing:"0.14em",
        textShadow:"0 0 18px rgba(0,210,255,.9),0 0 36px rgba(0,160,255,.6),0 0 56px rgba(0,100,200,.4)",
      }}>{time}</div>
      {/* date */}
      <div style={{
        position:"absolute", top:"38%", width:"100%", textAlign:"center",
        fontSize: s.dsize, color:"rgba(0,180,255,.55)",
        fontFamily:"'Courier New',monospace", letterSpacing:"0.08em",
      }}>{date}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   26. TECH ROOM — spinning gears + orange LED time
   ══════════════════════════════════════════════════════════════ */
function TechRoomClock({ now, fmt, size }: { now: Date; fmt: ClockFormat; size: ClockSize }) {
  const dim = sz[size].face;
  const s = sz[size];
  const cx = dim / 2, cy = dim / 2;
  const R = dim / 2 - 6;
  const h = now.getHours(), m = now.getMinutes(), se = now.getSeconds();
  const hStr = String(fmt === "12h" ? (h % 12 || 12) : h).padStart(2, "0");
  const mStr = pad(m);
  const ampm = h < 12 ? "AM" : "PM";
  const dateStr = now.toLocaleDateString("en-GB", { weekday:"short", day:"2-digit", month:"short" });
  const gearRot = (se / 60) * 2 * Math.PI;
  const gearPath = (gcx: number, gcy: number, outer: number, inner: number, teeth: number, rot: number) => {
    const pts: string[] = [];
    for (let i = 0; i < teeth * 4; i++) {
      const a = (i / (teeth * 4)) * 2 * Math.PI + rot;
      const rr = i % 4 < 2 ? outer : inner;
      pts.push(`${gcx + rr * Math.cos(a)},${gcy + rr * Math.sin(a)}`);
    }
    return pts.join(" ");
  };
  const seCirc = 2 * Math.PI * R * 0.6;
  return (
    <div style={{
      width: dim, height: dim,
      background: "radial-gradient(circle at 50% 50%,#000c1e 0%,#000608 80%)",
      borderRadius: "50%",
      boxShadow: "0 0 40px rgba(0,140,255,.18),0 0 80px rgba(0,80,200,.12),inset 0 0 30px rgba(0,0,0,.8)",
      position: "relative", overflow: "hidden",
    }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}
        style={{ position:"absolute", top:0, left:0 }}>
        <defs>
          <filter id="trG"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* outer cyan ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(0,180,255,.5)" strokeWidth="1.5"
          style={{ filter:"drop-shadow(0 0 6px rgba(0,180,255,.8))" }}/>
        {/* large gear outline */}
        <polygon points={gearPath(cx, cy, R*0.83, R*0.77, 18, gearRot)}
          fill="none" stroke="rgba(0,150,200,.28)" strokeWidth="0.8"/>
        {/* side gears */}
        <polygon points={gearPath(cx + R*0.56, cy - R*0.1, R*0.22, R*0.17, 8, -gearRot*1.6)}
          fill="none" stroke="rgba(0,160,220,.4)" strokeWidth="0.8"/>
        <polygon points={gearPath(cx - R*0.56, cy - R*0.1, R*0.22, R*0.17, 8, -gearRot*1.6)}
          fill="none" stroke="rgba(0,160,220,.4)" strokeWidth="0.8"/>
        {/* inner display circle */}
        <circle cx={cx} cy={cy} r={R*0.6} fill="rgba(0,15,35,.92)" stroke="rgba(0,200,255,.3)" strokeWidth="1"/>
        {/* second arc progress */}
        <circle cx={cx} cy={cy} r={R*0.6} fill="none"
          stroke="rgba(0,200,255,.6)" strokeWidth="2"
          strokeDasharray={`${(se/60)*seCirc} ${seCirc}`}
          strokeLinecap="round" transform={`rotate(-90,${cx},${cy})`}
          style={{ filter:"drop-shadow(0 0 5px rgba(0,200,255,1))" }}/>
        {/* gear center dots */}
        {[cx + R*0.56, cx - R*0.56, cx].map((gx, i) => (
          <circle key={i} cx={gx} cy={i === 2 ? cy : cy - R*0.1} r={i===2?R*0.07:R*0.055}
            fill="rgba(0,100,200,.45)" stroke="rgba(0,160,255,.5)" strokeWidth="0.7"/>
        ))}
      </svg>
      {/* large time */}
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-58%)",
        fontFamily:"'Courier New','OCR A Std',monospace",
        fontSize: s.tsize * 0.95, fontWeight:700,
        color:"#ff9200",
        letterSpacing:"0.04em",
        textShadow:"0 0 12px rgba(255,140,0,.9),0 0 24px rgba(255,100,0,.6),0 0 40px rgba(255,80,0,.4)",
        textAlign:"center", lineHeight:1,
      }}>{hStr}:{mStr}</div>
      {/* AM/PM + date */}
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,14%)",
        fontSize: s.dsize, color:"rgba(255,140,0,.6)",
        fontFamily:"'Courier New',monospace", letterSpacing:"0.06em", textAlign:"center",
      }}>{fmt==="12h" ? ampm+" · " : ""}{dateStr}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   27. CAR DASH — speedometer ring + green LCD time
   ══════════════════════════════════════════════════════════════ */
function CarDashClock({ now, fmt, size }: { now: Date; fmt: ClockFormat; size: ClockSize }) {
  const base = sz[size].face;
  const s = sz[size];
  const dim = base + 16;
  const cx = dim / 2, cy = dim / 2;
  const R = dim / 2 - 9;
  const h = now.getHours(), m = now.getMinutes(), se = now.getSeconds();
  const hStr = String(fmt === "12h" ? (h % 12 || 12) : h).padStart(2, "0");
  const mStr = pad(m);
  const seStr = pad(se);
  const ampm = h < 12 ? "AM" : "PM";
  const dayName = now.toLocaleDateString("en-GB", { weekday:"short" });
  const dayNum = now.getDate();
  const monName = now.toLocaleDateString("en-GB", { month:"short" });
  // Speedometer: 240° sweep, start at 210°
  const startDeg = 210;
  const sweepDeg = 240;
  const minorCount = 50;
  return (
    <div style={{
      width: dim, height: dim,
      background: "radial-gradient(circle at 48% 42%,#111 0%,#060606 70%)",
      borderRadius: "50%",
      boxShadow: "0 0 50px rgba(0,100,255,.22),0 20px 60px rgba(0,0,0,.9),inset 0 0 30px rgba(0,0,0,.8)",
      position: "relative",
    }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <defs>
          <filter id="cdG"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {/* dark rim */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="8"/>
        {/* blue neon outer ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(0,145,255,.8)" strokeWidth="2.5"
          style={{ filter:"drop-shadow(0 0 10px rgba(0,165,255,.9)) drop-shadow(0 0 20px rgba(0,120,255,.5))" }}/>
        {/* amber accent arc (high zone ~last 60°) */}
        {(() => {
          const arcR = R - 11;
          const arcC = 2 * Math.PI * arcR;
          const arcFrac = 60 / 360;
          const offsetDeg = -(startDeg + sweepDeg - 60) + 90;
          return <circle cx={cx} cy={cy} r={arcR} fill="none"
            stroke="rgba(255,140,0,.55)" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${arcFrac * arcC} ${arcC}`}
            transform={`rotate(${offsetDeg},${cx},${cy})`}
            style={{ filter:"drop-shadow(0 0 4px rgba(255,140,0,.7))" }}/>;
        })()}
        {/* tick marks */}
        {Array.from({ length: minorCount + 1 }, (_, i) => {
          const deg = startDeg + (i / minorCount) * sweepDeg;
          const a = (deg * Math.PI) / 180;
          const maj = i % 5 === 0;
          const r1 = R - 4, r2 = R - (maj ? 13 : 8);
          return <line key={i}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke={maj ? "rgba(0,180,255,.8)" : "rgba(0,110,200,.38)"}
            strokeWidth={maj ? 1.6 : 0.7}/>;
        })}
        {/* numeric labels every 2 major = 10, 20 … 100 */}
        {Array.from({ length: 11 }, (_, i) => {
          const deg = startDeg + (i / 10) * sweepDeg;
          const a = (deg * Math.PI) / 180;
          const lr = R - 24;
          return <text key={i} x={cx + lr * Math.cos(a)} y={cy + lr * Math.sin(a)}
            textAnchor="middle" dominantBaseline="middle"
            fill="rgba(0,175,255,.65)" fontSize={dim < 155 ? 5.5 : 6.5} fontFamily="monospace">
            {i * 10}
          </text>;
        })}
        {/* inner display circle */}
        <circle cx={cx} cy={cy} r={R * 0.57} fill="rgba(0,0,0,.72)" stroke="rgba(0,115,200,.22)" strokeWidth="0.8"/>
        {/* POWER label */}
        <text x={cx} y={cy + R * 0.44} textAnchor="middle" dominantBaseline="middle"
          fill="#ff9600" fontSize={dim < 155 ? 7 : 9} fontFamily="monospace"
          letterSpacing="3" fontWeight="bold"
          style={{ filter:"drop-shadow(0 0 5px rgba(255,140,0,.8))" }}>
          POWER
        </text>
      </svg>
      {/* time */}
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-62%)",
        fontFamily:"'Courier New',monospace",
        fontSize: s.tsize * 0.85, fontWeight:700,
        color:"rgba(160,255,160,.95)", letterSpacing:"0.06em",
        textShadow:"0 0 12px rgba(80,255,80,.65),0 0 24px rgba(0,200,80,.45)",
        textAlign:"center", lineHeight:1,
      }}>{hStr}:{mStr}:{seStr}</div>
      {/* AM/PM + date */}
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,2%)",
        fontSize: s.dsize, color:"rgba(120,230,120,.6)",
        fontFamily:"'Courier New',monospace",
        letterSpacing:"0.04em", textAlign:"center", lineHeight:1.5,
      }}>
        <div>{fmt === "12h" ? ampm : ""}</div>
        <div>{dayName} {dayNum} {monName}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════ */
export default function ClockWidget({ className = "" }: { className?: string }) {
  const { clockFormat, clockLocale, clockStyle, clockSize } = useSettings();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatTime(now, clockFormat, clockLocale);
  const date = formatDate(now, clockLocale);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {clockStyle === "digital"      && <DigitalClock     time={time} date={date} size={clockSize} now={now} />}
      {clockStyle === "boxed"        && <BoxedClock       now={now} fmt={clockFormat} loc={clockLocale} size={clockSize} />}
      {clockStyle === "neon"         && <NeonClock        time={time} date={date} size={clockSize} />}
      {clockStyle === "retro"        && <RetroClock       now={now} fmt={clockFormat} size={clockSize} />}
      {clockStyle === "gradient"     && <GradientClock    time={time} date={date} size={clockSize} />}
      {clockStyle === "glass"        && <GlassClock       time={time} date={date} size={clockSize} />}
      {clockStyle === "flip"         && <FlipClock        now={now} size={clockSize} />}
      {clockStyle === "analog"       && (
        <div className="flex flex-col items-center gap-2 p-2">
          <AnalogClock now={now} size={clockSize} />
          <span style={{ color:"var(--muted-foreground)", fontSize:sz[clockSize].dsize }}>{date}</span>
        </div>
      )}
      {clockStyle === "minimal"      && <MinimalClock     time={time} date={date} size={clockSize} />}
      {clockStyle === "neontube"     && <NeonTubeClock    time={time} date={date} size={clockSize} />}
      {clockStyle === "aurora"       && <AuroraClock      time={time} date={date} size={clockSize} />}
      {clockStyle === "matrix"       && <MatrixClock      time={time} date={date} size={clockSize} now={now} />}
      {clockStyle === "neonring"     && <NeonRingClock    now={now} fmt={clockFormat} loc={clockLocale} size={clockSize} />}
      {clockStyle === "wave"         && <WaveClock        time={time} date={date} size={clockSize} />}
      {clockStyle === "calendar"     && <CalendarClock    now={now} fmt={clockFormat} loc={clockLocale} size={clockSize} />}
      {clockStyle === "pixel"        && <PixelClock       time={time} date={date} size={clockSize} />}
      {clockStyle === "sunburst"     && <SunburstClock    now={now} date={date} size={clockSize} />}
      {clockStyle === "holographic"  && <HolographicClock time={time} date={date} size={clockSize} />}
      {clockStyle === "glass3d"      && <Glass3DClock     time={time} date={date} size={clockSize} />}
      {clockStyle === "orbit3d"      && <Orbit3DClock     now={now} date={date} size={clockSize} />}
      {clockStyle === "watch3d"      && <Watch3DClock     now={now} size={clockSize} />}
      {clockStyle === "desk3d"       && <Desk3DClock      now={now} size={clockSize} />}
      {clockStyle === "crystal3d"    && <Crystal3DClock   now={now} size={clockSize} />}
      {clockStyle === "scifi"        && <SciFiClock       now={now} size={clockSize} />}
      {clockStyle === "holo"         && <HoloClock        time={time} date={date} size={clockSize} />}
      {clockStyle === "techroom"     && <TechRoomClock    now={now} fmt={clockFormat} size={clockSize} />}
      {clockStyle === "cardash"      && <CarDashClock     now={now} fmt={clockFormat} size={clockSize} />}
    </div>
  );
}
