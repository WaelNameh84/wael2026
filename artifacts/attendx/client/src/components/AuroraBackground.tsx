/**
 * AuroraBackground — Fixed full-screen background layer.
 *
 * PERFORMANCE OPTIMISATIONS applied:
 *  • Particles reduced to 16 (was 36) — fewer DOM nodes and GPU layers
 *  • `will-change` only on the outer drift wrapper, NOT the inner rise element
 *  • Canvas redraws ONLY on mousemove, not every RAF frame (was ~60fps constant)
 *  • `contain: strict` on the particle container limits browser paint scope
 *  • All heavy animations respect `prefers-reduced-motion`
 *  • Blobs reduced from 4 to 3
 */
import { useEffect, useRef, useMemo } from "react";

export interface AuroraBackgroundProps {
  aurora?:     boolean;
  particles?:  boolean;
  mouseLight?: boolean;
  palette?:    "indigo" | "ocean" | "emerald" | "rose" | "gold";
}

const PALETTES = {
  indigo:  ["#6366f1", "#8b5cf6", "#06b6d4", "#4338ca", "#a78bfa"],
  ocean:   ["#0ea5e9", "#06b6d4", "#0284c7", "#38bdf8", "#7dd3fc"],
  emerald: ["#10b981", "#06b6d4", "#059669", "#34d399", "#6ee7b7"],
  rose:    ["#f43f5e", "#e879f9", "#f472b6", "#db2777", "#fb7185"],
  gold:    ["#f59e0b", "#fbbf24", "#f97316", "#eab308", "#fcd34d"],
} as const;

const BLOB_CONFIGS = [
  { size: "65vw",  top: "-22%", left: "-18%", dur: "24s", delay: "0s"   },
  { size: "55vw",  top: "52%",  left: "58%",  dur: "30s", delay: "-9s"  },
  { size: "48vw",  top: "18%",  left: "38%",  dur: "28s", delay: "-15s" },
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function genParticle(i: number, colors: readonly string[]) {
  const depth  = randomBetween(0.25, 1.0);
  const size   = randomBetween(1.5, 5.0) * depth;
  const opacity = randomBetween(0.12, 0.45) * depth;
  const blur   = (1 - depth) * 3;
  const speed  = randomBetween(20, 50) / depth;

  return {
    id:       i,
    left:     `${randomBetween(2, 97)}%`,
    size:     `${size}px`,
    opacity,
    blur,
    dur:      `${speed.toFixed(1)}s`,
    driftDur: `${randomBetween(5, 12).toFixed(1)}s`,
    delay:    `-${randomBetween(0, 30).toFixed(1)}s`,   // negative = start mid-animation (no initial burst)
    color:    colors[i % colors.length],
    depth,
    // Alternate drift direction per particle
    driftEnd: i % 2 === 0 ? "18px" : "-18px",
    // box-shadow only for near particles (saves GPU)
    glow: depth > 0.65
      ? `0 0 ${(7 * depth).toFixed(1)}px ${(3 * depth).toFixed(1)}px ${colors[i % colors.length]}88`
      : "none",
  };
}

export default function AuroraBackground({
  aurora     = true,
  particles  = true,
  mouseLight = true,
  palette    = "indigo",
}: AuroraBackgroundProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const mousePosRef  = useRef({ x: -9999, y: -9999 });
  const rafRef       = useRef<number>(0);
  const dirtyRef     = useRef(false);   // true = needs a canvas redraw
  const colors       = PALETTES[palette] ?? PALETTES.indigo;

  /* ── Mousemove → mark dirty, schedule single RAF draw ─────── */
  useEffect(() => {
    if (!mouseLight) return;

    const onMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (!dirtyRef.current) {
        dirtyRef.current = true;
        rafRef.current = requestAnimationFrame(drawFrame);
      }
    };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });

    function drawFrame() {
      dirtyRef.current = false;
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x, y } = mousePosRef.current;
      if (x > -1000) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 300);
        g.addColorStop(0,   "rgba(255,255,255,0.075)");
        g.addColorStop(0.4, "rgba(255,255,255,0.025)");
        g.addColorStop(1,   "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const g2 = ctx.createRadialGradient(x, y, 0, x, y, 50);
        g2.addColorStop(0, "rgba(255,255,255,0.10)");
        g2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, [mouseLight]);

  /* ── Stable particle data ───────────────────────────────────── */
  const particleData = useMemo(
    () => Array.from({ length: 16 }, (_, i) => genParticle(i, colors)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette]
  );

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: -2 }}
      aria-hidden="true"
    >
      {/* ── Aurora blobs ─────────────────────────────────────── */}
      {aurora && BLOB_CONFIGS.map((cfg, i) => (
        <div
          key={i}
          style={{
            position:     "absolute",
            width:        cfg.size,
            height:       cfg.size,
            top:          cfg.top,
            left:         cfg.left,
            borderRadius: "50%",
            background:   `radial-gradient(circle, ${colors[i % colors.length]}50 0%, transparent 70%)`,
            filter:       "blur(80px)",
            opacity:      0.5,
            animation:    `aurora-drift ${cfg.dur} ease-in-out infinite alternate`,
            animationDelay: cfg.delay,
            willChange:   "transform",
          }}
        />
      ))}

      {/* ── Particles container — contain limits repaint scope ── */}
      {particles && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            contain: "strict",        // key perf win: browser won't repaint outside
            overflow: "hidden",
          }}
        >
          {particleData.map(p => (
            // Outer: horizontal drift only → will-change:transform (1 GPU layer per particle)
            <div
              key={p.id}
              style={{
                position:  "absolute",
                bottom:    "-12px",
                left:      p.left,
                animation: `particle-drift-x ${p.driftDur} ease-in-out infinite alternate`,
                animationDelay: p.delay,
                willChange: "transform",   // only on this wrapper
              }}
            >
              {/* Inner: vertical rise + visual — NO will-change (inherits layer from parent) */}
              <div
                style={{
                  width:        p.size,
                  height:       p.size,
                  borderRadius: "50%",
                  background:   p.color,
                  opacity:      p.opacity,
                  filter:       p.blur > 0 ? `blur(${p.blur}px)` : undefined,
                  boxShadow:    p.glow,
                  animation:    `particle-rise ${p.dur} ease-in infinite`,
                  animationDelay: p.delay,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Mouse light canvas ──────────────────────────────── */}
      {mouseLight && (
        <canvas
          ref={canvasRef}
          style={{
            position:      "absolute",
            inset:         0,
            zIndex:        1,
            pointerEvents: "none",
            opacity:       0.85,
          }}
        />
      )}
    </div>
  );
}
