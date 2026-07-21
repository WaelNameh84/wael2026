/* ── 3D Realistic AI Button Icons ──────────────────────────────
   Each icon is a pure-SVG component with gradients, shadows, and
   specular highlights to simulate 3D depth. viewBox 0 0 28 28.
   size prop = Tailwind unit (6 → 24 px, 7 → 28 px, etc.)
────────────────────────────────────────────────────────────── */

interface P { size?: number }
const px = (s: number) => s * 4;

/* ── 1. Robot 3D — metallic chrome head ────────────────────── */
export function Robot3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-rb-head" x1="4" y1="6" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#d4e0ec"/>
          <stop offset="45%"  stopColor="#7090aa"/>
          <stop offset="100%" stopColor="#2c4050"/>
        </linearGradient>
        <radialGradient id="ai3d-rb-eye" cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#80ffff"/>
          <stop offset="40%"  stopColor="#00b8d8"/>
          <stop offset="100%" stopColor="#004888"/>
        </radialGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="14" cy="26.5" rx="7" ry="1.4" fill="rgba(0,0,0,0.22)"/>
      {/* neck */}
      <rect x="11.5" y="21" width="5" height="3.5" rx="1" fill="#507090" opacity="0.9"/>
      {/* head body */}
      <rect x="4.5" y="7" width="19" height="14.5" rx="3.5" fill="url(#ai3d-rb-head)"/>
      {/* top highlight strip */}
      <rect x="5.5" y="7.5" width="17" height="2.5" rx="2" fill="rgba(255,255,255,0.28)"/>
      {/* left side shadow */}
      <rect x="4.5" y="7" width="2" height="14.5" rx="1" fill="rgba(0,0,0,0.13)"/>
      {/* eyes — socket */}
      <circle cx="10" cy="14.5" r="2.8" fill="#001828" opacity="0.9"/>
      <circle cx="10" cy="14.5" r="2.2" fill="url(#ai3d-rb-eye)"/>
      <circle cx="10" cy="14.5" r="1"   fill="#30ffff" opacity="0.55"/>
      <circle cx="9"  cy="13.5" r="0.55" fill="white" opacity="0.9"/>
      <circle cx="18" cy="14.5" r="2.8" fill="#001828" opacity="0.9"/>
      <circle cx="18" cy="14.5" r="2.2" fill="url(#ai3d-rb-eye)"/>
      <circle cx="18" cy="14.5" r="1"   fill="#30ffff" opacity="0.55"/>
      <circle cx="17" cy="13.5" r="0.55" fill="white" opacity="0.9"/>
      {/* LED mouth */}
      <rect x="8.5" y="18.8" width="11" height="1.9" rx="0.95" fill="#001820"/>
      {["#00d8ff","#00a8cc","#00d8ff","#00a8cc","#00d8ff"].map((c,i)=>(
        <rect key={i} x={9+i*2} y="19.1" width="1.6" height="1.3" rx="0.4" fill={c} opacity="0.9"/>
      ))}
      {/* antenna */}
      <line x1="14" y1="7" x2="14" y2="3.5" stroke="#608098" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="14" cy="3" r="1.9" fill="#00c8e0"/>
      <circle cx="13.3" cy="2.4" r="0.5" fill="white" opacity="0.85"/>
      {/* ear bolts */}
      {[4.3, 23.7].map((cx2,i)=>(
        <g key={i}>
          <circle cx={cx2} cy="13.5" r="1.7" fill="#3a5870"/>
          <circle cx={cx2} cy="13.5" r="0.85" fill="#5a7888"/>
          <circle cx={cx2} cy="13.5" r="0.32" fill="#90b0c0"/>
        </g>
      ))}
    </svg>
  );
}

/* ── 2. Gem 3D — faceted diamond ───────────────────────────── */
export function Gem3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-gm-t"  x1="0%" y1="0%"   x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ddf4ff"/><stop offset="100%" stopColor="#80c8f0"/>
        </linearGradient>
        <linearGradient id="ai3d-gm-l"  x1="0%" y1="0%"   x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#a8daf8"/><stop offset="100%" stopColor="#58a8d8"/>
        </linearGradient>
        <linearGradient id="ai3d-gm-r"  x1="0%" y1="0%"   x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#3880c0"/><stop offset="100%" stopColor="#1858a0"/>
        </linearGradient>
        <linearGradient id="ai3d-gm-b"  x1="0%" y1="0%"   x2="0%"   y2="100%">
          <stop offset="0%"   stopColor="#2868b0"/><stop offset="100%" stopColor="#0c3878"/>
        </linearGradient>
      </defs>
      <ellipse cx="14" cy="26.5" rx="5.5" ry="1.1" fill="rgba(0,50,120,0.28)"/>
      {/* crown top */}
      <polygon points="8,10 20,10 17,5 11,5"       fill="url(#ai3d-gm-t)"/>
      <polygon points="8,10 11,5 14,10"             fill="#c8ecff" opacity="0.65"/>
      <polygon points="20,10 17,5 14,10"            fill="#58a0d0" opacity="0.75"/>
      {/* upper facets */}
      <polygon points="8,10 14,10 10,16"            fill="url(#ai3d-gm-l)"/>
      <polygon points="2,14 8,10 10,16"             fill="#b8dcf0"/>
      <polygon points="14,10 20,10 18,16"           fill="url(#ai3d-gm-r)"/>
      <polygon points="20,10 26,14 18,16"           fill="#3868a8"/>
      {/* center facet */}
      <polygon points="10,16 14,18 18,16 14,10"     fill="#78b4e0" opacity="0.88"/>
      {/* lower facets */}
      <polygon points="2,14 10,16 14,26"            fill="#a8c8e8" opacity="0.9"/>
      <polygon points="26,14 18,16 14,26"           fill="url(#ai3d-gm-b)"/>
      <polygon points="10,16 14,26 14,22"           fill="#6898c0" opacity="0.78"/>
      {/* specular flashes */}
      <polygon points="11,6.5 13.5,9.5 10.5,9.5"   fill="rgba(255,255,255,0.68)"/>
      <polygon points="9,11 11.5,13 9,14.5"         fill="rgba(255,255,255,0.42)"/>
      <circle cx="14" cy="10" r="0.7"               fill="rgba(255,255,255,0.9)"/>
    </svg>
  );
}

/* ── 3. Brain 3D — neon glowing brain ──────────────────────── */
export function Brain3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="ai3d-br-l" cx="35%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#ff88d8"/><stop offset="60%"  stopColor="#d040a0"/><stop offset="100%" stopColor="#801870"/>
        </radialGradient>
        <radialGradient id="ai3d-br-r" cx="65%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#e068c8"/><stop offset="60%"  stopColor="#b03090"/><stop offset="100%" stopColor="#601060"/>
        </radialGradient>
        <filter id="ai3d-br-glow">
          <feGaussianBlur stdDeviation="1.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="14" cy="13.5" rx="11" ry="10" fill="#ff40a0" opacity="0.1"/>
      {/* lobes */}
      <path d="M14,21.5 C10,21.5 5.5,18 4.5,14 C3.5,10 6.5,6.5 10,7 C11,6 12.5,5.5 14,6 Z" fill="url(#ai3d-br-l)"/>
      <path d="M14,21.5 C18,21.5 22.5,18 23.5,14 C24.5,10 21.5,6.5 18,7 C17,6 15.5,5.5 14,6 Z" fill="url(#ai3d-br-r)"/>
      {/* center divide */}
      <line x1="14" y1="5.5" x2="14" y2="21.8" stroke="#601060" strokeWidth="1.1" opacity="0.45"/>
      {/* fold lines left */}
      <path d="M8,12.5 Q10,10.5 11,13.5"  stroke="#ff96dc" strokeWidth="1"   fill="none" strokeLinecap="round" opacity="0.8"/>
      <path d="M7,16.5 Q9,14.5 11,17.5"   stroke="#ff96dc" strokeWidth="1"   fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M10,9.5 Q12,8.5 12,11.5"   stroke="#ff96dc" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.65"/>
      {/* fold lines right */}
      <path d="M20,12.5 Q18,10.5 17,13.5" stroke="#d060b0" strokeWidth="1"   fill="none" strokeLinecap="round" opacity="0.7"/>
      <path d="M21,16.5 Q19,14.5 17,17.5" stroke="#d060b0" strokeWidth="1"   fill="none" strokeLinecap="round" opacity="0.6"/>
      {/* stem */}
      <rect x="12.5" y="21.5" width="3" height="3" rx="1" fill="#801870" opacity="0.65"/>
      {/* shine */}
      <ellipse cx="10" cy="9" rx="2" ry="1.4" fill="rgba(255,255,255,0.28)" transform="rotate(-20,10,9)"/>
      {/* neon edge glow */}
      <path d="M14,21.5 C10,21.5 5.5,18 4.5,14 C3.5,10 6.5,6.5 10,7 C11,6 12.5,5.5 14,6 Z"
        fill="none" stroke="#ff68c8" strokeWidth="0.8" opacity="0.75" filter="url(#ai3d-br-glow)"/>
      <path d="M14,21.5 C18,21.5 22.5,18 23.5,14 C24.5,10 21.5,6.5 18,7 C17,6 15.5,5.5 14,6 Z"
        fill="none" stroke="#ff68c8" strokeWidth="0.8" opacity="0.6"  filter="url(#ai3d-br-glow)"/>
    </svg>
  );
}

/* ── 4. Flame 3D — realistic fire ──────────────────────────── */
export function Flame3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="ai3d-fl-out" cx="50%" cy="55%" r="60%">
          <stop offset="0%"   stopColor="#ff9400"/><stop offset="55%"  stopColor="#ff3c00"/><stop offset="100%" stopColor="#cc1000"/>
        </radialGradient>
        <radialGradient id="ai3d-fl-in" cx="50%" cy="65%" r="55%">
          <stop offset="0%"   stopColor="#ffffa0"/><stop offset="45%"  stopColor="#ffcc00"/><stop offset="100%" stopColor="#ff8000"/>
        </radialGradient>
        <filter id="ai3d-fl-glow"><feGaussianBlur stdDeviation="0.7"/></filter>
      </defs>
      <ellipse cx="14" cy="26.5" rx="5.5" ry="1.3" fill="rgba(200,50,0,0.28)"/>
      <ellipse cx="14" cy="18.5" rx="7.5" ry="9"   fill="#ff5500" opacity="0.13" filter="url(#ai3d-fl-glow)"/>
      {/* outer flame */}
      <path d="M14,3 C18.5,8.5 22,11 21,17 C20,22 18,25 14,26 C10,25 8,22 7,17 C6,11 9.5,8.5 14,3 Z" fill="url(#ai3d-fl-out)"/>
      {/* inner flame */}
      <path d="M14,9.5 C16.5,13 18,15.5 17.5,18.5 C17,21.5 15.5,23.5 14,24 C12.5,23.5 11,21.5 10.5,18.5 C10,15.5 11.5,13 14,9.5 Z" fill="url(#ai3d-fl-in)"/>
      {/* white-hot core */}
      <path d="M14,16 C15,17.5 15.5,19 14.5,21 C14,22 14,22 14,22 C13.5,21 13,19.5 13.5,18 C13.5,16.5 14,16 14,16 Z" fill="white" opacity="0.82"/>
      {/* side wisps */}
      <path d="M9,12 C7.5,9.5 8,13.5 9.5,15"  fill="none" stroke="#ff8800" strokeWidth="1.5" strokeLinecap="round" opacity="0.65"/>
      <path d="M19,12 C20.5,9.5 20,13.5 18.5,15" fill="none" stroke="#ff8800" strokeWidth="1.5" strokeLinecap="round" opacity="0.65"/>
    </svg>
  );
}

/* ── 5. Star 3D — gold metallic star ────────────────────────── */
export function Star3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="ai3d-st-fill" cx="38%" cy="30%" r="65%">
          <stop offset="0%"   stopColor="#fff0a0"/><stop offset="30%"  stopColor="#ffd040"/>
          <stop offset="70%"  stopColor="#e08000"/><stop offset="100%" stopColor="#a05000"/>
        </radialGradient>
        <radialGradient id="ai3d-st-in" cx="40%" cy="35%" r="50%">
          <stop offset="0%"   stopColor="#fff8c0"/><stop offset="100%" stopColor="#ffc040"/>
        </radialGradient>
        <filter id="ai3d-st-sh">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.5" floodColor="rgba(140,70,0,0.5)"/>
        </filter>
      </defs>
      <path d="M14,2 L16.5,10 L25,10 L18.5,15.5 L21,24 L14,19 L7,24 L9.5,15.5 L3,10 L11.5,10 Z"
        fill="url(#ai3d-st-fill)" filter="url(#ai3d-st-sh)"/>
      <path d="M14,6 L15.6,11.5 L21.5,11.5 L16.9,15 L18.5,20.5 L14,17.2 L9.5,20.5 L11.1,15 L6.5,11.5 L12.4,11.5 Z"
        fill="url(#ai3d-st-in)" opacity="0.65"/>
      {/* top-left highlight facets */}
      <polygon points="14,2 16.5,10 11.5,10"        fill="rgba(255,255,255,0.5)"/>
      <polygon points="14,2 11.5,10 7.5,8"           fill="rgba(255,255,255,0.28)"/>
      {/* center sparkle */}
      <circle cx="14" cy="14" r="2.2" fill="rgba(255,255,255,0.7)"/>
      <line x1="14" y1="11" x2="14" y2="17" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7"/>
      <line x1="11" y1="14" x2="17" y2="14" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7"/>
    </svg>
  );
}

/* ── 6. Orb 3D — magic crystal ball ────────────────────────── */
export function Orb3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="ai3d-orb-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3020a8"/><stop offset="55%"  stopColor="#180880"/><stop offset="100%" stopColor="#080440"/>
        </radialGradient>
        <radialGradient id="ai3d-orb-gl" cx="36%" cy="27%" r="55%">
          <stop offset="0%"   stopColor="rgba(225,215,255,0.88)"/>
          <stop offset="40%"  stopColor="rgba(165,145,255,0.22)"/>
          <stop offset="100%" stopColor="rgba(100,80,200,0)"/>
        </radialGradient>
        <radialGradient id="ai3d-orb-gw" cx="50%" cy="50%" r="50%">
          <stop offset="68%"  stopColor="rgba(140,100,255,0)"/>
          <stop offset="100%" stopColor="rgba(140,100,255,0.55)"/>
        </radialGradient>
        <filter id="ai3d-orb-blur"><feGaussianBlur stdDeviation="1.2"/></filter>
      </defs>
      <circle cx="14" cy="14" r="13"  fill="rgba(120,80,255,0.18)" filter="url(#ai3d-orb-blur)"/>
      <ellipse cx="14" cy="26.5" rx="6" ry="1.3" fill="rgba(60,20,160,0.3)"/>
      <circle cx="14" cy="13.5" r="11" fill="url(#ai3d-orb-bg)"/>
      {/* inner swirls */}
      <path d="M7.5,13 Q11,7.5 14,13 Q17,18.5 20.5,13"  stroke="rgba(190,170,255,0.38)" strokeWidth="1.4" fill="none"/>
      <path d="M8.5,16.5 Q12,11.5 15,16.5 Q18,21.5 21.5,16.5" stroke="rgba(165,130,255,0.28)" strokeWidth="1" fill="none"/>
      {/* star particles */}
      {[[10,10,0.7],[18,8,0.55],[20,17,0.62],[9,18.5,0.55],[14.5,7,0.5],[11,20.5,0.45]].map(([cx2,cy2,r2],i)=>(
        <circle key={i} cx={cx2} cy={cy2} r={r2} fill="#d0b8ff" opacity="0.78"/>
      ))}
      {/* glass shell */}
      <circle cx="14" cy="13.5" r="11" fill="url(#ai3d-orb-gl)"/>
      <circle cx="14" cy="13.5" r="11" fill="url(#ai3d-orb-gw)"/>
      <circle cx="14" cy="13.5" r="11" fill="none" stroke="rgba(190,170,255,0.38)" strokeWidth="0.75"/>
      <ellipse cx="18.5" cy="19.5" rx="1.5" ry="0.65" fill="rgba(210,195,255,0.24)" transform="rotate(32,18.5,19.5)"/>
    </svg>
  );
}

/* ── 7. Shield 3D — metallic steel shield ──────────────────── */
export function Shield3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-sh-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#c8d8ea"/><stop offset="40%"  stopColor="#6888a8"/>
          <stop offset="75%"  stopColor="#384f68"/><stop offset="100%" stopColor="#1c3040"/>
        </linearGradient>
        <linearGradient id="ai3d-sh-bev" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.38)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <filter id="ai3d-sh-shd">
          <feDropShadow dx="2" dy="3" stdDeviation="2" floodColor="rgba(0,20,40,0.48)"/>
        </filter>
      </defs>
      <path d="M14,2 L23,5 L23,14 C23,19.5 19,23.5 14,26 C9,23.5 5,19.5 5,14 L5,5 Z"
        fill="url(#ai3d-sh-body)" filter="url(#ai3d-sh-shd)"/>
      {/* left bevel highlight */}
      <path d="M14,2 L5,5 L5,14 C5,19.5 9,23.5 14,26 L14,2 Z" fill="url(#ai3d-sh-bev)"/>
      {/* top highlight band */}
      <path d="M14,2 L23,5 L14,7.5 L5,5 Z" fill="rgba(255,255,255,0.32)"/>
      {/* inner shield line */}
      <path d="M14,5.5 L20.5,7.5 L20.5,14 C20.5,17.5 17.5,21 14,23 C10.5,21 7.5,17.5 7.5,14 L7.5,7.5 Z"
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.75"/>
      {/* gold star emblem */}
      <path d="M14,10 L15.1,12.8 L18,12.8 L15.8,14.5 L16.9,17.3 L14,15.7 L11.1,17.3 L12.2,14.5 L10,12.8 L12.9,12.8 Z"
        fill="rgba(255,220,70,0.92)"/>
      <path d="M7,5.8 L14,3.5 L21,5.8" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="0.75"/>
    </svg>
  );
}

/* ── 8. Crown 3D — golden royal crown ──────────────────────── */
export function Crown3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-cr-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffe880"/><stop offset="40%"  stopColor="#f0c000"/><stop offset="100%" stopColor="#a07000"/>
        </linearGradient>
        <linearGradient id="ai3d-cr-band" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffd040"/><stop offset="100%" stopColor="#c09000"/>
        </linearGradient>
        <filter id="ai3d-cr-shd">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.5" floodColor="rgba(100,50,0,0.4)"/>
        </filter>
      </defs>
      <ellipse cx="14" cy="25.5" rx="9" ry="1.4" fill="rgba(100,50,0,0.22)"/>
      {/* crown body */}
      <path d="M3,22 L3,13 L8,19 L14,7 L20,19 L25,13 L25,22 Z" fill="url(#ai3d-cr-body)" filter="url(#ai3d-cr-shd)"/>
      {/* band */}
      <path d="M3,19 L25,19 L25,22 L3,22 Z" fill="url(#ai3d-cr-band)"/>
      {/* bevel highlights */}
      <path d="M3,13 L3,15.5 L8,19 L8,16 Z"     fill="rgba(255,255,255,0.24)"/>
      <path d="M14,7 L16,12.5 L20,19 L18,16 Z"   fill="rgba(255,255,255,0.18)"/>
      {/* gemstones */}
      <circle cx="14" cy="7" r="2.2" fill="#ff2040"/><circle cx="14" cy="7" r="1.1" fill="#ff8898" opacity="0.7"/>
      <circle cx="13.3" cy="6.3" r="0.4" fill="white" opacity="0.8"/>
      <circle cx="3" cy="13" r="1.8" fill="#2060ff"/><circle cx="3" cy="13" r="0.9" fill="#80b0ff" opacity="0.65"/>
      <circle cx="25" cy="13" r="1.8" fill="#20b050"/><circle cx="25" cy="13" r="0.9" fill="#80e0a0" opacity="0.65"/>
      {/* band rivets */}
      {[9,14,19].map(x=><circle key={x} cx={x} cy="20.5" r="1.1" fill="#ffd040"/>)}
    </svg>
  );
}

/* ── 9. Rocket 3D — silver rocket with flame ───────────────── */
export function Rocket3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-rk-body" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#eaf0f6"/><stop offset="45%"  stopColor="#bcc8d4"/><stop offset="100%" stopColor="#7888a0"/>
        </linearGradient>
        <linearGradient id="ai3d-rk-nose" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ff6868"/><stop offset="100%" stopColor="#cc2020"/>
        </linearGradient>
        <radialGradient id="ai3d-rk-win" cx="35%" cy="32%" r="60%">
          <stop offset="0%"   stopColor="#a8dcff"/><stop offset="100%" stopColor="#1878c0"/>
        </radialGradient>
        <radialGradient id="ai3d-rk-fl" cx="50%" cy="20%" r="70%">
          <stop offset="0%"   stopColor="#ffffa0"/><stop offset="40%"  stopColor="#ffa000"/><stop offset="100%" stopColor="#ff3800"/>
        </radialGradient>
      </defs>
      {/* flame */}
      <path d="M11,23 Q12.5,28.5 14,26.5 Q15.5,28.5 17,23" fill="url(#ai3d-rk-fl)" opacity="0.92"/>
      <path d="M12.5,23 Q13.5,27 14,26 Q14.5,27 15.5,23" fill="#ffffa0" opacity="0.78"/>
      {/* fins */}
      <path d="M10,22 L5.5,26.5 L10,24 Z" fill="#7888a0"/>
      <path d="M18,22 L22.5,26.5 L18,24 Z" fill="#5a6878"/>
      {/* body */}
      <rect x="10" y="10" width="8" height="13" rx="4" fill="url(#ai3d-rk-body)"/>
      {/* body highlight strip */}
      <rect x="10.5" y="10.5" width="2.5" height="12" rx="1.25" fill="rgba(255,255,255,0.38)"/>
      {/* nose cone */}
      <path d="M10,10 Q14,2 18,10 Z" fill="url(#ai3d-rk-nose)"/>
      <path d="M10.5,10 Q13,4 14,4" fill="none" stroke="rgba(255,120,120,0.5)" strokeWidth="0.8"/>
      {/* porthole */}
      <circle cx="14" cy="17" r="2.8" fill="#08182a"/>
      <circle cx="14" cy="17" r="2.2" fill="url(#ai3d-rk-win)"/>
      <circle cx="13" cy="16" r="0.6" fill="rgba(255,255,255,0.82)"/>
      {/* body right shadow */}
      <rect x="16.5" y="10" width="1.5" height="13" rx="0.75" fill="rgba(0,0,0,0.1)"/>
    </svg>
  );
}

/* ── 11. Neural 3D — glowing neural network ────────────────── */
export function Neural3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="ai3d-nn-node" cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#a0f0ff"/>
          <stop offset="50%"  stopColor="#00b4e0"/>
          <stop offset="100%" stopColor="#004888"/>
        </radialGradient>
        <radialGradient id="ai3d-nn-center" cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#ffffff"/>
          <stop offset="40%"  stopColor="#60e0ff"/>
          <stop offset="100%" stopColor="#0080c0"/>
        </radialGradient>
        <filter id="ai3d-nn-glow">
          <feGaussianBlur stdDeviation="0.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* connection lines */}
      <line x1="14" y1="14" x2="5"  y2="7"  stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="23" y2="7"  stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="5"  y2="21" stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="23" y2="21" stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="14" y2="3"  stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="14" y2="25" stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="3"  y2="14" stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      <line x1="14" y1="14" x2="25" y2="14" stroke="#00c8f0" strokeWidth="0.9" opacity="0.6"/>
      {/* cross-connections */}
      <line x1="5" y1="7" x2="14" y2="3"    stroke="#0090c0" strokeWidth="0.6" opacity="0.4"/>
      <line x1="23" y1="7" x2="14" y2="3"   stroke="#0090c0" strokeWidth="0.6" opacity="0.4"/>
      <line x1="5" y1="21" x2="3" y2="14"   stroke="#0090c0" strokeWidth="0.6" opacity="0.4"/>
      <line x1="23" y1="21" x2="25" y2="14" stroke="#0090c0" strokeWidth="0.6" opacity="0.4"/>
      {/* outer nodes */}
      {[
        [5,7],[23,7],[5,21],[23,21],[14,3],[14,25],[3,14],[25,14]
      ].map(([cx2,cy2],i) => (
        <g key={i} filter="url(#ai3d-nn-glow)">
          <circle cx={cx2} cy={cy2} r="2.2" fill="#001828" opacity="0.9"/>
          <circle cx={cx2} cy={cy2} r="1.6" fill="url(#ai3d-nn-node)"/>
          <circle cx={cx2-0.5} cy={cy2-0.5} r="0.45" fill="white" opacity="0.85"/>
        </g>
      ))}
      {/* center node */}
      <circle cx="14" cy="14" r="4"   fill="#001020" opacity="0.95"/>
      <circle cx="14" cy="14" r="3.2" fill="url(#ai3d-nn-center)" filter="url(#ai3d-nn-glow)"/>
      <circle cx="12.5" cy="12.5" r="0.8" fill="white" opacity="0.9"/>
      <ellipse cx="14" cy="27" rx="5" ry="0.9" fill="rgba(0,100,180,0.2)"/>
    </svg>
  );
}

/* ── 12. Hologram 3D — floating holographic hex ─────────────── */
export function Hologram3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-holo-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#80ffee"/>
          <stop offset="50%"  stopColor="#00e5c8"/>
          <stop offset="100%" stopColor="#0088a0"/>
        </linearGradient>
        <linearGradient id="ai3d-holo-side" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#00c8b0"/>
          <stop offset="100%" stopColor="#003850"/>
        </linearGradient>
        <filter id="ai3d-holo-glow">
          <feGaussianBlur stdDeviation="1" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* bottom glow shadow */}
      <ellipse cx="14" cy="26" rx="7" ry="1.2" fill="rgba(0,200,180,0.22)"/>
      {/* hex prism sides */}
      <polygon points="7,11.5 14,15.5 21,11.5 21,18.5 14,22.5 7,18.5" fill="url(#ai3d-holo-side)" opacity="0.85"/>
      {/* hex prism top face */}
      <polygon points="7,11.5 14,7.5 21,11.5 14,15.5" fill="url(#ai3d-holo-top)"/>
      {/* top face bevel */}
      <polygon points="7,11.5 14,7.5 14,15.5" fill="rgba(255,255,255,0.22)"/>
      <polygon points="14,7.5 21,11.5 14,15.5" fill="rgba(0,0,0,0.14)"/>
      {/* rim top highlight */}
      <polygon points="7,11.5 14,7.5 21,11.5" fill="none" stroke="rgba(160,255,240,0.7)" strokeWidth="0.7"/>
      {/* hologram scan lines */}
      {[13,15.5,18].map((y,i) => (
        <line key={i} x1="7" y1={y} x2="21" y2={y} stroke="rgba(0,255,220,0.18)" strokeWidth="0.5"/>
      ))}
      {/* center hex symbol */}
      <polygon points="14,10.5 16.2,11.7 16.2,14.3 14,15.5 11.8,14.3 11.8,11.7"
        fill="rgba(255,255,255,0.2)" stroke="rgba(160,255,240,0.8)" strokeWidth="0.6"
        filter="url(#ai3d-holo-glow)"/>
      {/* vertical scan beam */}
      <line x1="14" y1="3" x2="14" y2="7.5"
        stroke="rgba(0,255,220,0.5)" strokeWidth="0.7" strokeDasharray="1,1.5"
        filter="url(#ai3d-holo-glow)"/>
      <circle cx="14" cy="3" r="1.2" fill="#00ffe0" opacity="0.6" filter="url(#ai3d-holo-glow)"/>
      {/* rim edge glow */}
      <polygon points="7,11.5 14,7.5 21,11.5 21,18.5 14,22.5 7,18.5"
        fill="none" stroke="rgba(0,240,210,0.45)" strokeWidth="0.6"/>
    </svg>
  );
}

/* ── 13. Infinity 3D — glowing infinity loop ────────────────── */
export function Infinity3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-inf-l" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#e0b8ff"/>
          <stop offset="40%"  stopColor="#9040f0"/>
          <stop offset="100%" stopColor="#4010a0"/>
        </linearGradient>
        <linearGradient id="ai3d-inf-r" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffb0e0"/>
          <stop offset="40%"  stopColor="#e040a0"/>
          <stop offset="100%" stopColor="#800060"/>
        </linearGradient>
        <filter id="ai3d-inf-glow">
          <feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* shadow */}
      <ellipse cx="14" cy="22" rx="10" ry="1.4" fill="rgba(100,0,150,0.2)"/>
      {/* glow halo */}
      <path d="M5.5,14 C5.5,9.5 8.5,7 12,7 C14.5,7 16,9 17,11 C18,9 19.5,7 22,7 C25.5,7 28.5,9.5 28.5,14 C28.5,18.5 25.5,21 22,21 C19.5,21 18,19 17,17 C16,19 14.5,21 12,21 C8.5,21 5.5,18.5 5.5,14 Z"
        stroke="#c060ff" strokeWidth="3" fill="none" opacity="0.18" filter="url(#ai3d-inf-glow)"
        transform="translate(-2,0) scale(1.05)"/>
      {/* left lobe — bottom half (shadow face) */}
      <path d="M9.5,14 C9.5,16.8 10.8,18.5 12,18.5 C13.5,18.5 15,16.5 17,14 C15,11.5 13.5,9.5 12,9.5 C10.8,9.5 9.5,11.2 9.5,14 Z"
        fill="url(#ai3d-inf-l)" opacity="0.7"/>
      {/* right lobe — bottom half */}
      <path d="M18.5,14 C18.5,16.8 19.8,18.5 21,18.5 C22.5,18.5 24,16.5 24,14 C24,11.5 22.5,9.5 21,9.5 C19.8,9.5 18.5,11.2 18.5,14 Z"
        fill="url(#ai3d-inf-r)" opacity="0.7"/>
      {/* main stroke */}
      <path d="M17,14 C15,11.2 13.2,8.5 11.5,8.5 C8.5,8.5 6,11 6,14 C6,17 8.5,19.5 11.5,19.5 C13.2,19.5 15,16.8 17,14 C19,11.2 20.8,8.5 22.5,8.5 C25.5,8.5 28,11 28,14 C28,17 25.5,19.5 22.5,19.5 C20.8,19.5 19,16.8 17,14 Z"
        stroke="url(#ai3d-inf-l)" strokeWidth="2.8" fill="none" filter="url(#ai3d-inf-glow)"
        transform="translate(-3,0)"/>
      {/* highlight strip */}
      <path d="M14,12.5 C13,11.5 12,10.5 11.5,10.5 C10,10.5 9,11.8 9,14"
        stroke="rgba(240,200,255,0.65)" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <path d="M20,12.5 C21,11.5 22,10.5 22.5,10.5 C24,10.5 25,11.8 25,14"
        stroke="rgba(255,200,235,0.5)"  strokeWidth="1.1" fill="none" strokeLinecap="round"
        transform="translate(-3,0)"/>
      {/* center sparkle */}
      <circle cx="14" cy="14" r="1.5" fill="white" opacity="0.8"/>
      <circle cx="14" cy="14" r="0.6" fill="white"/>
    </svg>
  );
}

/* ── 14. DNA 3D — glowing double helix ──────────────────────── */
export function Dna3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-dna-l" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#40d0ff"/>
          <stop offset="100%" stopColor="#0080c0"/>
        </linearGradient>
        <linearGradient id="ai3d-dna-r" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8040ff"/>
          <stop offset="100%" stopColor="#40a0ff"/>
        </linearGradient>
        <filter id="ai3d-dna-glow">
          <feGaussianBlur stdDeviation="0.7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="14" cy="26.5" rx="5.5" ry="1" fill="rgba(0,80,160,0.2)"/>
      {/* left strand */}
      <path d="M10,3 C6,6 18,9.5 10,13 C6,15 18,18.5 10,22 C8,23.5 8,25 10,26"
        stroke="url(#ai3d-dna-l)" strokeWidth="2.2" fill="none" strokeLinecap="round"
        filter="url(#ai3d-dna-glow)"/>
      {/* right strand */}
      <path d="M18,3 C22,6 10,9.5 18,13 C22,15 10,18.5 18,22 C20,23.5 20,25 18,26"
        stroke="url(#ai3d-dna-r)" strokeWidth="2.2" fill="none" strokeLinecap="round"
        filter="url(#ai3d-dna-glow)"/>
      {/* rungs */}
      {[[10,7.5,18,5.5],[11,10.8,17,10.8],[10,14.5,18,12],[11,17.5,17,17.5],[10,21,18,19]].map(([x1,y1,x2,y2],i)=>(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={i % 2 === 0 ? "rgba(64,208,255,0.65)" : "rgba(128,64,255,0.65)"}
          strokeWidth="1.3" strokeLinecap="round"/>
      ))}
      {/* node dots on intersections */}
      {[[10,3,0],[18,3,1],[10,13,0],[18,13,1],[14,8,0],[14,18,1]].map(([cx2,cy2,t],i)=>(
        <circle key={i} cx={cx2} cy={cy2} r="1.5"
          fill={t === 0 ? "#40d0ff" : "#8040ff"} opacity="0.9"
          filter="url(#ai3d-dna-glow)"/>
      ))}
    </svg>
  );
}

/* ── 15. Chip 3D — metallic AI processor chip ───────────────── */
export function Chip3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ai3d-ch-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#d0e8f8"/>
          <stop offset="45%"  stopColor="#5888b0"/>
          <stop offset="100%" stopColor="#1c3850"/>
        </linearGradient>
        <linearGradient id="ai3d-ch-core" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#20f090"/>
          <stop offset="50%"  stopColor="#00a860"/>
          <stop offset="100%" stopColor="#004830"/>
        </linearGradient>
        <filter id="ai3d-ch-glow">
          <feGaussianBlur stdDeviation="0.6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="14" cy="26" rx="8" ry="1.3" fill="rgba(0,30,60,0.28)"/>
      {/* chip body */}
      <rect x="5" y="5" width="18" height="18" rx="2.5" fill="url(#ai3d-ch-top)"/>
      {/* top highlight */}
      <rect x="5.5" y="5.5" width="17" height="3" rx="1.5" fill="rgba(255,255,255,0.28)"/>
      {/* left shadow */}
      <rect x="5" y="5" width="2.5" height="18" rx="1" fill="rgba(0,0,0,0.12)"/>
      {/* core window */}
      <rect x="9" y="9" width="10" height="10" rx="1.5" fill="#0a1c28" opacity="0.95"/>
      <rect x="9.5" y="9.5" width="9" height="9" rx="1" fill="url(#ai3d-ch-core)" opacity="0.85" filter="url(#ai3d-ch-glow)"/>
      {/* core grid lines */}
      <line x1="14" y1="9.5" x2="14" y2="18.5" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6"/>
      <line x1="9.5" y1="14" x2="18.5" y2="14" stroke="rgba(0,0,0,0.3)" strokeWidth="0.6"/>
      <rect x="11.5" y="11.5" width="5" height="5" rx="0.8" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
      {/* center LED */}
      <circle cx="14" cy="14" r="1.4" fill="#80ffe0" opacity="0.9" filter="url(#ai3d-ch-glow)"/>
      <circle cx="13.4" cy="13.4" r="0.4" fill="white" opacity="0.85"/>
      {/* pins — top & bottom */}
      {[7,10,13,16,19].map((x,i)=>(
        <g key={i}>
          <rect x={x} y="3"  width="1.5" height="2.5" rx="0.5" fill="#6888a0"/>
          <rect x={x} y="22.5" width="1.5" height="2.5" rx="0.5" fill="#5070880"/>
        </g>
      ))}
      {/* pins — left & right */}
      {[7,10,13,16,19].map((y,i)=>(
        <g key={i}>
          <rect x="3"  y={y} width="2.5" height="1.5" rx="0.5" fill="#6888a0"/>
          <rect x="22.5" y={y} width="2.5" height="1.5" rx="0.5" fill="#507090"/>
        </g>
      ))}
    </svg>
  );
}

/* ── 10. Eye 3D — mystical glowing eye ─────────────────────── */
export function Eye3DIcon({ size = 6 }: P) {
  const s = px(size);
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" fill="none">
      <defs>
        <radialGradient id="ai3d-ey-iris" cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#44ccff"/><stop offset="42%"  stopColor="#0082d4"/><stop offset="100%" stopColor="#003888"/>
        </radialGradient>
        <radialGradient id="ai3d-ey-rim" cx="50%" cy="50%" r="50%">
          <stop offset="62%"  stopColor="rgba(0,165,255,0)"/>
          <stop offset="100%" stopColor="rgba(0,165,255,0.6)"/>
        </radialGradient>
        <filter id="ai3d-ey-blur"><feGaussianBlur stdDeviation="1.4"/></filter>
      </defs>
      {/* outer aura */}
      <ellipse cx="14" cy="14" rx="12" ry="7.5" fill="rgba(0,160,255,0.1)" filter="url(#ai3d-ey-blur)"/>
      {/* sclera */}
      <ellipse cx="14" cy="14" rx="11.5" ry="7.5" fill="#f2f7ff"/>
      <ellipse cx="14" cy="14" rx="11.5" ry="7.5" fill="none" stroke="#bcd0e8" strokeWidth="0.5"/>
      {/* iris */}
      <circle cx="14" cy="14" r="5.8"  fill="url(#ai3d-ey-iris)"/>
      <circle cx="14" cy="14" r="5.8"  fill="url(#ai3d-ey-rim)"/>
      {/* iris fibres */}
      {[0,60,120,180,240,300].map((deg,i)=>{
        const rad = deg * Math.PI / 180;
        return <line key={i}
          x1={14+2.9*Math.cos(rad)} y1={14+2.9*Math.sin(rad)}
          x2={14+5.4*Math.cos(rad)} y2={14+5.4*Math.sin(rad)}
          stroke="rgba(0,185,255,0.32)" strokeWidth="0.6"/>;
      })}
      {/* pupil */}
      <circle cx="14" cy="14" r="2.6"  fill="#030810"/>
      {/* upper eyelid shadow */}
      <path d="M2.5,14 Q14,6.5 25.5,14" fill="rgba(70,105,145,0.22)" strokeWidth="0"/>
      <path d="M2.5,14 Q14,6.5 25.5,14" fill="none" stroke="rgba(55,80,110,0.5)" strokeWidth="0.8"/>
      <path d="M2.5,14 Q14,21.5 25.5,14" fill="none" stroke="rgba(55,80,110,0.35)" strokeWidth="0.8"/>
      {/* specular */}
      <circle cx="11" cy="11.5" r="1.6" fill="rgba(255,255,255,0.9)"/>
      <circle cx="16.8" cy="12.6" r="0.75" fill="rgba(255,255,255,0.7)"/>
    </svg>
  );
}
