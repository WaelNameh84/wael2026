import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGetMe } from "@/lib/api-client/index";
import { useTranslation } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Clock, Users, MapPin, Calendar,
  BarChart3, Settings, Bot, LogOut, Menu, Building2, Bell, Inbox, DollarSign, MessageSquare, Trash2, Award, ClipboardList, Camera, Banknote, PenLine, Megaphone, UserCircle, ShoppingBag, PartyPopper
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useSwipeBack } from "@/hooks/use-swipe-back";
import { useKeyboardAvoid } from "@/hooks/use-keyboard-avoid";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { usePageProgress } from "@/hooks/use-page-progress";
import { Button } from "@/components/ui/button";
import NotificationsPanel from "@/components/NotificationsPanel";
import FloatingAI from "@/components/FloatingAI";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { playNotification, primeAudio } from "@/lib/sounds";
import { playAlarmSound, getAlarmSettings, warmUpAudioContext } from "@/lib/alarm";
import { syncPushSubscription } from "@/lib/push-alarm";
import { useNavTTS } from "@/hooks/use-tts";

/* ── Module-level nav direction tracker (survives Layout remounts) ── */
const _navHistory: string[] = [];
let _lastDirection: "forward" | "back" = "forward";

function trackNavDirection(location: string): "forward" | "back" {
  if (_navHistory.length === 0) {
    _navHistory.push(location);
    _lastDirection = "forward";
    return _lastDirection;
  }
  const idx = _navHistory.lastIndexOf(location);
  if (idx >= 0 && idx < _navHistory.length - 1) {
    // Going back: trim the stack
    _lastDirection = "back";
    _navHistory.splice(idx + 1);
  } else if (_navHistory[_navHistory.length - 1] !== location) {
    _lastDirection = "forward";
    _navHistory.push(location);
  }
  return _lastDirection;
}

/* ── Framer-motion slide variants (iOS-style) ── */
const slideVariants = {
  initial: (dir: "forward" | "back") => ({
    x: dir === "back" ? "-28%" : "100%",
    opacity: dir === "back" ? 0.6 : 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: (dir: "forward" | "back") => ({
    x: dir === "back" ? "100%" : "-28%",
    opacity: dir === "back" ? 0 : 0.5,
    transition: { duration: 0.26, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { data: me } = useGetMe();
  const { t } = useTranslation();
  const { appName, appLogo } = useAppConfig();
  const { sidebarStyle, soundEnabled, soundVolume, backgroundMode } = useSettings();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alarmModal, setAlarmModal] = useState<{ label: string; body: string } | null>(null);
  const alarmPlayedRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  // Track direction for slide animation
  const direction = trackNavDirection(location);

  usePullToRefresh(mainRef);
  useSwipeBack();
  useKeyboardAvoid();

  const isOnline = useNetworkStatus();
  const { progress, visible: progressVisible } = usePageProgress(location);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const prevOnlineRef = useRef(true);

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 2500);
      return () => clearTimeout(t);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const qc = useQueryClient();
  const isAdmin = me?.role === "admin" || me?.role === "manager";
  const isIconOnly = sidebarStyle === "icon-only";
  const isCompact = sidebarStyle === "compact";
  const isWide = sidebarStyle === "wide";

  const sidebarWidth = isIconOnly ? "w-16" : isCompact ? "w-44" : isWide ? "w-64" : "w-56";

  // Poll every 2 min
  const NOTIF_POLL = 2 * 60_000;
  const NOTIF_STALE = NOTIF_POLL - 5_000;

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(apiUrl("/api/notifications/count"), { headers: authHeaders(), signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { clearTimeout(timer); return { count: 0 }; }
    },
    enabled: isAdmin,
    refetchInterval: NOTIF_POLL,
    staleTime:       NOTIF_STALE,
    gcTime:         10 * 60_000,
  });

  const { data: myNotifCountData } = useQuery<{ count: number }>({
    queryKey: ["my-notifications-count"],
    queryFn: async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(apiUrl("/api/notifications/my/count"), { headers: authHeaders(), signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { clearTimeout(timer); return { count: 0 }; }
    },
    enabled: !!me && !isAdmin,
    refetchInterval: NOTIF_POLL,
    staleTime:       NOTIF_STALE,
    gcTime:         10 * 60_000,
  });

  const { data: msgCountData } = useQuery<{ count: number }>({
    queryKey: ["messages-unread-count"],
    queryFn: async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(apiUrl("/api/messages/unread-count"), { headers: authHeaders(), signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { clearTimeout(timer); return { count: 0 }; }
    },
    refetchInterval: NOTIF_POLL,
    staleTime:       NOTIF_STALE,
    gcTime:         10 * 60_000,
  });

  const unreadCount    = countData?.count ?? 0;
  const myNotifCount   = myNotifCountData?.count ?? 0;
  const unreadMsgCount = msgCountData?.count ?? 0;

  /* ── Pre-fetch notifications ─────────────────────── */
  useEffect(() => {
    if (!isAdmin) return;
    qc.prefetchQuery({
      queryKey: ["notifications-panel"],
      queryFn: async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const res = await fetch(apiUrl("/api/notifications"), { headers: authHeaders(), signal: ctrl.signal });
          clearTimeout(timer);
          if (!res.ok) return [];
          return res.json();
        } catch { clearTimeout(timer); return []; }
      },
      staleTime: 30_000,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!me?.id) return;
    const t = setTimeout(() => {
      syncPushSubscription().catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [me?.id]);

  const prevUnreadRef = useRef<number | null>(null);

  const triggerAlarm = useCallback((label: string, body: string) => {
    if (alarmPlayedRef.current) return;
    alarmPlayedRef.current = true;
    setTimeout(() => { alarmPlayedRef.current = false; }, 60_000);
    try {
      warmUpAudioContext();
      const settings = getAlarmSettings();
      playAlarmSound(settings.soundType, settings.volume, settings.repeatCount).catch(() => {});
    } catch { /* silently ignore */ }
    setAlarmModal({ label, body });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PLAY_ALARM") {
        const label = event.data?.label ?? "🔔 تنبيه الدوام";
        const body  = event.data?.body  ?? "حان وقت دوامك";
        triggerAlarm(label, body);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [triggerAlarm]);

  useEffect(() => {
    if (!me?.id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("alarm") === "1") {
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
      const alarmType = params.get("alarmType") ?? "start";
      const label = alarmType === "end" ? "🔔 انتهاء الدوام" : "🔔 بدء الدوام";
      const body  = alarmType === "end" ? "انتهى وقت دوامك" : "حان وقت بدء دوامك";
      triggerAlarm(label, body);
    }
  }, [me?.id, triggerAlarm]);

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const prev = prevUnreadRef.current;
    if (prev !== null && unreadCount > prev) {
      const newCount = unreadCount - prev;
      const notif = new Notification(`${appName} — إشعار جديد`, {
        body: newCount === 1 ? "لديك إشعار جديد يستحق المراجعة" : `لديك ${newCount} إشعارات جديدة`,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "attendx-admin-notif",
      });
      notif.onclick = () => { window.focus(); notif.close(); };
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, isAdmin]);

  const { speakNav } = useNavTTS();
  const prevLocationRef = useRef<string>("");

  useEffect(() => {
    if (location === prevLocationRef.current) return;
    prevLocationRef.current = location;
    const allItems = [
      { href: "/dashboard", label: t("dashboard") },
      { href: "/attendance", label: t("attendance") },
      { href: "/employees", label: t("employees") },
      { href: "/departments", label: t("departments") },
      { href: "/locations", label: t("locations") },
      { href: "/leave", label: t("leave") },
      { href: "/holidays", label: t("holidays_menu") },
      { href: "/payroll", label: t("payroll") },
      { href: "/bonuses", label: isAdmin ? t("bonuses_deductions") : t("my_bonuses") },
      { href: "/work-requests", label: t("work_requests_permissions") },
      { href: "/work-reports", label: t("task_documentation") },
      { href: "/salary-advances", label: t("salary_advance_requests") },
      { href: "/purchases", label: t("purchases_menu") },
      { href: "/attendance-corrections", label: t("attendance_corrections_menu") },
      { href: "/announcements", label: t("announcements_menu") },
      { href: "/profile", label: t("my_profile_menu") },
      { href: "/reports", label: t("reports") },
      { href: "/messages", label: t("messages_menu") },
      { href: "/ai", label: t("ai_assistant") },
      { href: "/action-center", label: t("action_center") },
      { href: "/settings", label: t("settings") },
    ];
    const match = allItems.find(item => location === item.href || location.startsWith(item.href + "/"));
    if (match) speakNav(match.label);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, speakNav]);

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { href: "/attendance", icon: Clock, label: t("attendance") },
    ...(isAdmin ? [{ href: "/employees", icon: Users, label: t("employees") }] : []),
    ...(isAdmin ? [{ href: "/departments", icon: Building2, label: t("departments") }] : []),
    ...(isAdmin ? [{ href: "/locations", icon: MapPin, label: t("locations") }] : []),
    { href: "/leave", icon: Calendar, label: t("leave") },
    { href: "/holidays", icon: PartyPopper, label: t("holidays_menu") },
    ...(isAdmin ? [{ href: "/payroll", icon: DollarSign, label: t("payroll") }] : []),
    { href: "/bonuses", icon: Award, label: isAdmin ? t("bonuses_deductions") : t("my_bonuses") },
    { href: "/work-requests", icon: ClipboardList, label: t("work_requests_permissions") },
    { href: "/work-reports", icon: Camera, label: t("task_documentation") },
    { href: "/salary-advances", icon: Banknote, label: t("salary_advance_requests") },
    { href: "/purchases", icon: ShoppingBag, label: t("purchases_menu") },
    { href: "/attendance-corrections", icon: PenLine, label: t("attendance_corrections_menu") },
    { href: "/announcements", icon: Megaphone, label: t("announcements_menu"), badge: !isAdmin ? myNotifCount : 0 },
    { href: "/profile", icon: UserCircle, label: t("my_profile_menu") },
    { href: "/reports", icon: BarChart3, label: t("reports") },
    ...(isAdmin ? [{ href: "/clear-reports", icon: Trash2, label: t("clear_reports_menu") }] : []),
    { href: "/messages", icon: MessageSquare, label: t("messages_menu"), badge: unreadMsgCount },
    { href: "/ai", icon: Bot, label: t("ai_assistant") },
    ...(isAdmin ? [{ href: "/action-center", icon: Inbox, label: t("action_center"), badge: unreadCount }] : []),
    { href: "/settings", icon: Settings, label: t("settings") },
  ];


  const BellButton = ({ className }: { className?: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      onClick={() => { setNotifOpen(o => !o); if (soundEnabled) { primeAudio(); playNotification(soundVolume); } }}
      data-testid="button-notifications"
    >
      <Bell className="w-5 h-5" />
      {isAdmin && unreadCount > 0 && (
        <span className="absolute top-1 end-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {!isAdmin && myNotifCount > 0 && (
        <span className="absolute top-1 end-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none">
          {myNotifCount > 99 ? "99+" : myNotifCount}
        </span>
      )}
    </Button>
  );

  const NavContent = () => (
    <nav className="flex flex-col h-full">
      {/* Logo / App name */}
      <div className={cn("border-b border-sidebar-border flex-shrink-0", isIconOnly ? "px-3 py-5 flex justify-center" : "px-4 py-5")}>
        {isIconOnly ? (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
            {appLogo ? <img src={appLogo} alt="logo" className="w-full h-full object-contain" /> : <Clock className="w-4 h-4 text-primary-foreground" />}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
              {appLogo ? <img src={appLogo} alt="logo" className="w-full h-full object-contain" /> : <Clock className="w-4 h-4 text-primary-foreground" />}
            </div>
            <span className="font-bold text-sidebar-foreground text-sm tracking-wide uppercase truncate">{appName}</span>
          </div>
        )}
      </div>

      <div className={cn("flex-1 py-4 overflow-y-auto space-y-0.5", isIconOnly ? "px-2" : "px-3")}>
        {navItems.map(({ href, icon: Icon, label, badge }: any) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-link-${href.replace("/", "") || "home"}`}
              title={isIconOnly ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-all",
                isIconOnly ? "justify-center px-2 py-2.5" : isCompact ? "px-2 py-2" : "px-3 py-2.5",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isIconOnly && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {badge > 0 && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </>
              )}
              {isIconOnly && badge > 0 && (
                <span className="absolute top-1 end-1 w-2.5 h-2.5 rounded-full bg-destructive" />
              )}
            </Link>
          );
        })}
      </div>

      <div className={cn("py-4 border-t border-sidebar-border", isIconOnly ? "px-2" : "px-3")}>
        {me && !isIconOnly && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{me.name}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{me.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          data-testid="button-logout"
          title={isIconOnly ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 w-full rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-all",
            isIconOnly ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isIconOnly && t("logout")}
        </button>
      </div>
    </nav>
  );

  return (
    <div className={cn("flex h-screen overflow-hidden", backgroundMode === "default" ? "bg-background" : "bg-transparent")}>

      {/* ── Page progress bar ── */}
      {progressVisible && (
        <div
          className={cn("page-progress-bar", progress === 100 && "done")}
          style={{ width: `${progress}%` }}
        />
      )}

      {/* ── Network status banners ── */}
      {!isOnline && (
        <div className="network-offline-banner">
          <span>🔴</span>
          <span>لا يوجد اتصال بالإنترنت</span>
        </div>
      )}
      {showBackOnline && (
        <div className="network-back-banner">
          <span>✅</span>
          <span>عاد الاتصال بالإنترنت</span>
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className={cn("hidden md:flex flex-col bg-sidebar border-e border-sidebar-border flex-shrink-0 transition-all duration-200", sidebarWidth)}>
        <NavContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-56 bg-sidebar flex flex-col animate-in slide-in-from-start duration-250" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Notifications panel */}
      {notifOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}>
          <div
            className="absolute top-14 end-4 w-80 bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <NotificationsPanel onClose={() => setNotifOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary to-violet-600 text-white shadow-md" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} data-testid="button-menu" className="text-white hover:bg-white/20 hover:text-white">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm flex-1 text-white cursor-pointer" onClick={scrollToTop}>{appName}</span>
          <BellButton className="text-white hover:bg-white/20 hover:text-white" />
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-end px-6 py-3 border-b border-border bg-card/50">
          <BellButton />
        </header>

        {/* Scrollable page area — overflow container */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden relative"
          style={{ scrollbarGutter: "stable" }}
        >
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={location}
              custom={direction}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="min-h-full p-4 md:p-6"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Floating AI assistant */}
      <FloatingAI />

      {/* ── Alarm Modal ── */}
      {alarmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="mx-4 w-full max-w-sm bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-destructive/10 px-6 pt-7 pb-5 flex flex-col items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-20 h-20 rounded-full bg-destructive/20 animate-ping" />
                <span className="relative w-16 h-16 rounded-full bg-destructive/30 flex items-center justify-center">
                  <Bell className="w-8 h-8 text-destructive" />
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground text-center mt-1">{alarmModal.label}</h2>
              <p className="text-sm text-muted-foreground text-center">{alarmModal.body}</p>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <button
                className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground font-bold text-base hover:bg-destructive/90 active:scale-95 transition-transform"
                onClick={() => {
                  try {
                    warmUpAudioContext();
                    const settings = getAlarmSettings();
                    playAlarmSound(settings.soundType, settings.volume, settings.repeatCount).catch(() => {});
                  } catch { /* ignore */ }
                  setAlarmModal(null);
                }}
              >
                إغلاق المنبّه
              </button>
              <button
                className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
                onClick={() => setAlarmModal(null)}
              >
                تجاهل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
