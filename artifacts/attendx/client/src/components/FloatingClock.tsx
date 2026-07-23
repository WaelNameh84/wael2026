import { useEffect, useRef, useState, useCallback } from "react";
import { X, GripHorizontal, Minimize2, Maximize2, Clock, LogIn, LogOut, ChevronDown, Loader2 } from "lucide-react";
import { useDoubleClickClose } from "@/hooks/use-double-click-close";
import ClockWidget from "@/components/ClockWidget";
import { useSettings } from "@/hooks/use-settings";
import {
  useCheckIn, useCheckOut, useGetTodayAttendance, useListLocations,
  getGetTodayAttendanceQueryKey, getListAttendanceQueryKey,
} from "@/lib/api-client/index";
import { useQueryClient } from "@tanstack/react-query";

const POS_KEY  = "floating_clock_pos";
const OPEN_KEY = "floating_clock_open";

function loadPos(fallback: { x: number; y: number }) {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) return JSON.parse(raw) as { x: number; y: number };
  } catch {}
  return fallback;
}

export default function FloatingClock() {
  const { floatingClockEnabled, floatingClockCheckIn, language } = useSettings();
  const isArabic = language === "ar";

  const [isOpen, setIsOpen]       = useState(() => localStorage.getItem(OPEN_KEY) !== "false");
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos]             = useState(() => loadPos({ x: window.innerWidth - 240, y: 80 }));
  const [dragging, setDragging]   = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const ref     = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0, active: false });

  const qc = useQueryClient();
  const { data: today }     = useGetTodayAttendance({ query: { queryKey: getGetTodayAttendanceQueryKey() } });
  const { data: locations } = useListLocations();
  const checkInMut  = useCheckIn();
  const checkOutMut = useCheckOut();

  const todayExt = today as any;
  const checkedIn: boolean = todayExt?.currentlyCheckedIn ?? false;
  const locList: any[] = (locations as any) ?? [];
  const [locationId, setLocationId] = useState<string>("");

  useEffect(() => {
    if (locList.length > 0 && !locationId) {
      setLocationId(String(locList[0].id));
    }
  }, [locList, locationId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
  };

  const handleCheckIn = async () => {
    if (!locationId) return;
    try {
      await checkInMut.mutateAsync({ data: { locationId: parseInt(locationId), biometricVerified: false } });
      refresh();
    } catch {}
  };

  const handleCheckOut = async () => {
    try {
      await checkOutMut.mutateAsync({ data: {} });
      refresh();
    } catch {}
  };

  /* ── clamp ───────────────────────────────────────────── */
  const clamp = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return { x, y };
    const w = el.offsetWidth  || 200;
    const h = el.offsetHeight || 80;
    return {
      x: Math.max(0, Math.min(window.innerWidth  - w, x)),
      y: Math.max(0, Math.min(window.innerHeight - h, y)),
    };
  }, []);

  /* ── Mouse drag ──────────────────────────────────────── */
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,select")) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y, active: true };
    setDragging(true);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      setPos(clamp(dragRef.current.ox + e.clientX - dragRef.current.startX, dragRef.current.oy + e.clientY - dragRef.current.startY));
    };
    const onUp = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      setDragging(false);
      setPos(p => { localStorage.setItem(POS_KEY, JSON.stringify(p)); return p; });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [clamp]);

  /* ── Touch drag ──────────────────────────────────────── */
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button,select")) return;
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, ox: pos.x, oy: pos.y, active: true };
  };

  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (!dragRef.current.active) return;
      const t = e.touches[0];
      setPos(clamp(dragRef.current.ox + t.clientX - dragRef.current.startX, dragRef.current.oy + t.clientY - dragRef.current.startY));
    };
    const onEnd = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      setPos(p => { localStorage.setItem(POS_KEY, JSON.stringify(p)); return p; });
    };
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend",  onEnd);
    return () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
  }, [clamp]);

  /* ── Resize re-clamp ─────────────────────────────────── */
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const handleClose = () => { setIsOpen(false); localStorage.setItem(OPEN_KEY, "false"); };
  const handleReopen = () => { setIsOpen(true); localStorage.setItem(OPEN_KEY, "true"); };
  const requireDoubleClickClose = useDoubleClickClose(handleClose);

  if (!floatingClockEnabled) return null;

  /* ── Collapsed pill ──────────────────────────────────── */
  if (!isOpen) {
    return (
      <button
        onClick={handleReopen}
        className="fixed z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        style={{ left: pos.x, top: pos.y }}
      >
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span>{isArabic ? "الساعة" : "Clock"}</span>
      </button>
    );
  }

  const busy = checkInMut.isPending || checkOutMut.isPending;

  return (
    <div
      ref={ref}
      className={`fixed z-50 rounded-2xl shadow-2xl overflow-hidden select-none
        border border-white/10 backdrop-blur-sm
        ${dragging ? "scale-[1.03] shadow-primary/20" : ""}
        transition-shadow transition-transform duration-150`}
      style={{
        left: pos.x,
        top:  pos.y,
        cursor: dragging ? "grabbing" : "grab",
        willChange: "transform",
        boxShadow: dragging
          ? "0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(var(--primary),0.2)"
          : "0 8px 32px rgba(0,0,0,0.2)",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Drag handle bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-card/90 border-b border-border/60">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
            {isArabic ? "الساعة" : "Clock"}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setCollapsed(v => !v)}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={requireDoubleClickClose}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Clock body */}
      {!collapsed && (
        <div className="bg-card/95">
          <ClockWidget />

          {/* Check-in / Check-out panel */}
          {floatingClockCheckIn && (
            <div
              className="px-3 pb-3 pt-1 border-t border-border/50 space-y-2"
              onMouseDown={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
            >
              {/* Status indicator */}
              <div className="flex items-center justify-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${checkedIn ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
                <span className="text-[11px] text-muted-foreground">
                  {checkedIn
                    ? (isArabic ? "أنت داخل العمل الآن" : "Currently checked in")
                    : (isArabic ? "لم تسجّل حضورك بعد" : "Not checked in")}
                </span>
              </div>

              {/* Location selector — only shown when checking in and multiple locations */}
              {!checkedIn && locList.length > 1 && (
                <div className="relative" onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setLocationOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground hover:border-primary/50 transition-colors"
                  >
                    <span className="truncate">
                      {locList.find(l => String(l.id) === locationId)?.name ?? (isArabic ? "اختر الموقع" : "Select location")}
                    </span>
                    <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                  </button>
                  {locationOpen && (
                    <div className="absolute bottom-full mb-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                      {locList.map((loc: any) => (
                        <button
                          key={loc.id}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                          onClick={() => { setLocationId(String(loc.id)); setLocationOpen(false); }}
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Check-in / Check-out button */}
              <button
                type="button"
                disabled={busy || (!checkedIn && !locationId)}
                onClick={checkedIn ? handleCheckOut : handleCheckIn}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  ${checkedIn
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  }`}
              >
                {busy
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : checkedIn
                    ? <LogOut className="w-3 h-3" />
                    : <LogIn className="w-3 h-3" />
                }
                {busy
                  ? (isArabic ? "جارٍ..." : "...")
                  : checkedIn
                    ? (isArabic ? "تسجيل انصراف" : "Check out")
                    : (isArabic ? "تسجيل حضور" : "Check in")
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
