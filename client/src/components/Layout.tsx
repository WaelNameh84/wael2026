import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGetMe } from "@/lib/api-client/index";
import { useTranslation } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Clock, Users, MapPin, Calendar,
  BarChart3, Settings, Bot, LogOut, Menu, Building2, Bell, Inbox, DollarSign, MessageSquare, Trash2, Award, ClipboardList, Camera, Banknote
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import NotificationsPanel from "@/components/NotificationsPanel";
import FloatingAI from "@/components/FloatingAI";
import { useQuery } from "@tanstack/react-query";
import { apiUrl, authHeaders } from "@/lib/api-url";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { data: me } = useGetMe();
  const { t } = useTranslation();
  const { appName, appLogo } = useAppConfig();
  const { sidebarStyle } = useSettings();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const isAdmin = me?.role === "admin";
  const isIconOnly = sidebarStyle === "icon-only";
  const isCompact = sidebarStyle === "compact";
  const isWide = sidebarStyle === "wide";

  const sidebarWidth = isIconOnly ? "w-16" : isCompact ? "w-44" : isWide ? "w-64" : "w-56";

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["notifications-count"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/notifications/count"), { headers: authHeaders() });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const { data: msgCountData } = useQuery<{ count: number }>({
    queryKey: ["messages-unread-count"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/messages/unread-count"), { headers: authHeaders() });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const unreadCount = countData?.count ?? 0;
  const unreadMsgCount = msgCountData?.count ?? 0;

  /* ── Browser push notifications for admins ──────────────── */
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const prev = prevUnreadRef.current;
    if (prev !== null && unreadCount > prev) {
      const newCount = unreadCount - prev;
      const notif = new Notification("AttendX — إشعار جديد", {
        body: newCount === 1
          ? "لديك إشعار جديد يستحق المراجعة"
          : `لديك ${newCount} إشعارات جديدة`,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "attendx-admin-notif",
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, isAdmin]);

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { href: "/attendance", icon: Clock, label: t("attendance") },
    ...(isAdmin ? [{ href: "/employees", icon: Users, label: t("employees") }] : []),
    ...(isAdmin ? [{ href: "/departments", icon: Building2, label: t("departments") }] : []),
    ...(isAdmin ? [{ href: "/locations", icon: MapPin, label: t("locations") }] : []),
    { href: "/leave", icon: Calendar, label: t("leave") },
    ...(isAdmin ? [{ href: "/payroll", icon: DollarSign, label: t("payroll") }] : []),
    { href: "/bonuses", icon: Award, label: isAdmin ? t("bonuses_deductions") : t("my_bonuses") },
    { href: "/work-requests", icon: ClipboardList, label: t("work_requests_permissions") },
    { href: "/work-reports", icon: Camera, label: t("task_documentation") },
    { href: "/salary-advances", icon: Banknote, label: t("salary_advance_requests") },
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
      onClick={() => setNotifOpen(o => !o)}
      data-testid="button-notifications"
    >
      <Bell className="w-5 h-5" />
      {isAdmin && unreadCount > 0 && (
        <span className="absolute top-1 end-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none">
          {unreadCount > 99 ? "99+" : unreadCount}
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={cn("hidden md:flex flex-col bg-sidebar border-e border-sidebar-border flex-shrink-0 transition-all duration-200", sidebarWidth)}>
        <NavContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-56 bg-sidebar flex flex-col">
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
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} data-testid="button-menu">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm flex-1">{appName}</span>
          <BellButton />
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-end px-6 py-3 border-b border-border bg-card/50">
          <BellButton />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Floating AI assistant */}
      <FloatingAI />
    </div>
  );
}
