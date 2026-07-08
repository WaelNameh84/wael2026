import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/hooks/use-settings";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import { useAuth } from "@/hooks/use-auth";
import { setAuthTokenGetter } from "@/lib/api-client/index";
import { lazy, Suspense, useEffect } from "react";
import FloatingClock from "@/components/FloatingClock";
import ErrorBoundary from "@/components/ErrorBoundary";
import { bootNotifications } from "@/lib/notifications";
import { bootShiftAlarms } from "@/lib/alarm";

const LoginPage              = lazy(() => import("@/pages/login"));
const RegisterPage           = lazy(() => import("@/pages/register"));
const DashboardPage          = lazy(() => import("@/pages/dashboard"));
const AttendancePage         = lazy(() => import("@/pages/attendance"));
const EmployeesPage          = lazy(() => import("@/pages/employees"));
const DepartmentsPage        = lazy(() => import("@/pages/departments"));
const LocationsPage          = lazy(() => import("@/pages/locations"));
const LeavePage              = lazy(() => import("@/pages/leave"));
const LeaveCalendarPage      = lazy(() => import("@/pages/leave-calendar"));
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
const SalaryAdvancesPage     = lazy(() => import("@/pages/salary-advances"));
const NotFound               = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
});

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
    bootNotifications(lang);
    bootShiftAlarms(lang);
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
            <Route path="/salary-advances"  component={() => <ProtectedRoute component={SalaryAdvancesPage} />} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </ErrorBoundary>
      {isAuthenticated && !isPublicPage && <FloatingClock />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AppConfigProvider>
          <TooltipProvider>
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
