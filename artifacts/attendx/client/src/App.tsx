import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/hooks/use-settings";
import { AppConfigProvider, useAppConfig } from "@/contexts/AppConfigContext";
import { useAuth } from "@/hooks/use-auth";
import { setAuthTokenGetter } from "@/lib/api-client/index";
import { lazy, Suspense, useEffect } from "react";
import FloatingClock from "@/components/FloatingClock";
import ErrorBoundary from "@/components/ErrorBoundary";
import SplashScreen from "@/components/SplashScreen";
import { bootNotifications } from "@/lib/notifications";
import { bootShiftAlarms } from "@/lib/alarm";
import { useAutoUpdate } from "@/hooks/use-auto-update";

const LoginPage              = lazy(() => import("@/pages/login"));
const RegisterPage           = lazy(() => import("@/pages/register"));
const DashboardPage          = lazy(() => import("@/pages/dashboard"));
const AttendancePage         = lazy(() => import("@/pages/attendance"));
const EmployeesPage          = lazy(() => import("@/pages/employees"));
const DepartmentsPage        = lazy(() => import("@/pages/departments"));
const LocationsPage          = lazy(() => import("@/pages/locations"));
const LeavePage              = lazy(() => import("@/pages/leave"));
const LeaveCalendarPage      = lazy(() => import("@/pages/leave-calendar"));
const HolidaysPage           = lazy(() => import("@/pages/holidays"));
const PayrollPage            = lazy(() => import("@/pages/payroll"));
const ReportsPage            = lazy(() => import("@/pages/reports"));
const SettingsPage           = lazy(() => import("@/pages/settings"));
const AiPage                 = lazy(() => import("@/pages/ai"));
const ActionCenterPage       = lazy(() => import("@/pages/action-center"));
const MessagesPage           = lazy(() => import("@/pages/messages"));
const ClearReportsPage       = lazy(() => import("@/pages/clear-reports"));
const BonusesPage            = lazy(() => import("@/pages/bonuses"));
const WorkRequestsPage       = lazy(() => import("@/pages/work-requests"));
const WorkReportsHistoryPage = lazy(() => import("@/pages/work-reports-history"));
const SalaryAdvancesPage          = lazy(() => import("@/pages/salary-advances"));
const AttendanceCorrectionsPage   = lazy(() => import("@/pages/attendance-corrections"));
const AnnouncementsPage           = lazy(() => import("@/pages/announcements"));
const ProfilePage                 = lazy(() => import("@/pages/profile"));
const PurchasesPage                = lazy(() => import("@/pages/purchases"));
const NotFound                    = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 5 minutes: data stays fresh across page navigations without re-fetching
      staleTime: 5 * 60_000,
      // 15 minutes: keep unused data in memory so navigating back is instant
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
    },
  },
});

/* ── Persist query cache to localStorage for instant PWA restores ── */
const CACHE_KEY = "attendx_qcache_v1";
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function saveCache() {
  try {
    const cache = queryClient.getQueryCache().getAll();
    const serialisable = cache
      .filter(q => q.state.status === "success" && q.state.data !== undefined)
      .map(q => ({ key: q.queryKey, data: q.state.data, ts: Date.now() }));
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), queries: serialisable }));
  } catch { /* quota errors — silently ignore */ }
}

function restoreCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const { ts, queries } = JSON.parse(raw) as { ts: number; queries: { key: unknown[]; data: unknown; ts: number }[] };
    if (Date.now() - ts > CACHE_MAX_AGE) { localStorage.removeItem(CACHE_KEY); return; }
    for (const { key, data } of queries) {
      queryClient.setQueryData(key as any, data);
    }
  } catch { /* corrupt data — silently ignore */ }
}

restoreCache();

// Save cache to localStorage every 5 minutes and on page hide.
// Serialising the whole cache every 30 s was causing main-thread jank;
// 5 min is plenty — the primary save path is the pagehide/visibilitychange events.
if (typeof window !== "undefined") {
  setInterval(saveCache, 5 * 60_000);
  window.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveCache(); });
  window.addEventListener("pagehide", saveCache);
}

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Component />;
}

function AuthInit() {
  const { token } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("auth_token"));
  }, [token]);
  useEffect(() => {
    const lang = (localStorage.getItem("settings_lang") as "en" | "ar" | "sv") || "en";
    // Pass actual alarm times so daily reminders fire at work start/end, not hardcoded 7:00
    const alarmCfg = (() => { try { return JSON.parse(localStorage.getItem("setting_shift_alarms") ?? "{}"); } catch { return {}; } })();
    bootNotifications(lang, alarmCfg.startTime, alarmCfg.endTime);
    bootShiftAlarms(lang);

    // Warm up the shared AudioContext on first user interaction.
    // Browsers block Web Audio autoplay — AudioContext.resume() only works
    // inside a direct user-gesture handler. By warming up on the first
    // click/touch after login the alarm setTimeout can play sound later.
    const handleFirstGesture = () => {
      import("@/lib/alarm").then(({ getAlarmSettings, warmUpAudioContext }) => {
        if (getAlarmSettings().enabled) warmUpAudioContext();
      });
      window.removeEventListener("click",      handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("keydown",    handleFirstGesture);
    };
    window.addEventListener("click",      handleFirstGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstGesture, { passive: true });
    window.addEventListener("keydown",    handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener("click",      handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("keydown",    handleFirstGesture);
    };
  }, []);
  return null;
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  const isPublicPage = location === "/login" || location === "/register";

  return (
    <>
      <AuthInit />
      <ErrorBoundary key={location}>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route path="/register" component={RegisterPage} />
            <Route path="/" component={() => <Redirect to="/attendance" />} />
            <Route path="/dashboard"      component={() => <ProtectedRoute component={DashboardPage} />} />
            <Route path="/attendance"     component={() => <ProtectedRoute component={AttendancePage} />} />
            <Route path="/employees"      component={() => <ProtectedRoute component={EmployeesPage} />} />
            <Route path="/departments"    component={() => <ProtectedRoute component={DepartmentsPage} />} />
            <Route path="/locations"      component={() => <ProtectedRoute component={LocationsPage} />} />
            <Route path="/leave"          component={() => <ProtectedRoute component={LeavePage} />} />
            <Route path="/leave/calendar" component={() => <ProtectedRoute component={LeaveCalendarPage} />} />
            <Route path="/holidays"       component={() => <ProtectedRoute component={HolidaysPage} />} />
            <Route path="/payroll"        component={() => <ProtectedRoute component={PayrollPage} />} />
            <Route path="/reports"        component={() => <ProtectedRoute component={ReportsPage} />} />
            <Route path="/settings"       component={() => <ProtectedRoute component={SettingsPage} />} />
            <Route path="/ai"             component={() => <ProtectedRoute component={AiPage} />} />
            <Route path="/action-center"  component={() => <ProtectedRoute component={ActionCenterPage} />} />
            <Route path="/messages"       component={() => <ProtectedRoute component={MessagesPage} />} />
            <Route path="/clear-reports"  component={() => <ProtectedRoute component={ClearReportsPage} />} />
            <Route path="/bonuses"        component={() => <ProtectedRoute component={BonusesPage} />} />
            <Route path="/work-requests"  component={() => <ProtectedRoute component={WorkRequestsPage} />} />
            <Route path="/work-reports"      component={() => <ProtectedRoute component={WorkReportsHistoryPage} />} />
            <Route path="/salary-advances"        component={() => <ProtectedRoute component={SalaryAdvancesPage} />} />
            <Route path="/attendance-corrections" component={() => <ProtectedRoute component={AttendanceCorrectionsPage} />} />
            <Route path="/announcements"          component={() => <ProtectedRoute component={AnnouncementsPage} />} />
            <Route path="/profile"                component={() => <ProtectedRoute component={ProfilePage} />} />
            <Route path="/purchases"              component={() => <ProtectedRoute component={PurchasesPage} />} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
      {isAuthenticated && !isPublicPage && <FloatingClock />}
    </>
  );
}

function AutoUpdateWatcher() {
  useAutoUpdate();
  return null;
}

/** Renders the splash screen only after server config is fetched,
 *  so the correct app name/logo are always shown (never the defaults). */
function SplashScreenGate() {
  const { configLoaded } = useAppConfig();
  if (!configLoaded) return null;
  return <SplashScreen />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AppConfigProvider>
          <TooltipProvider>
            <SplashScreenGate />
            <AutoUpdateWatcher />
            <WouterRouter base={(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}>
              <AppContent />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AppConfigProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}

export default App;
