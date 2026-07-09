import { useState, useMemo } from "react";
import {
  useGetDashboardStats, useGetTodayAttendance, useListUsers, useListAttendance,
  useGetMe, getGetDashboardStatsQueryKey, getGetMeQueryKey, getListAttendanceQueryKey,
  useListLeave, getListLeaveQueryKey,
} from "@/lib/api-client/index";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, UserCheck, UserX, Clock, TrendingUp, AlertCircle, Calendar,
  Radio, LogIn, LogOut, MapPin, ChevronRight, Layers, Timer, X, Umbrella, Search,
  UserCog, CheckCircle, XCircle, RefreshCw, BarChart2, Camera, Trash2, Eye,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import ClockWidget from "@/components/ClockWidget";
import { apiUrl, authHeaders } from "@/lib/api-url";
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

/* ─── Types ────────────────────────────────────────────────── */

type CategoryFilter = "total" | "present" | "absent" | "late" | "on_leave";

type ActivityEvent = {
  recordId: number;
  userId: number;
  userName: string;
  date: string;
  action: "check_in" | "check_out";
  timestamp: string;
  locationName: string | null;
  status: string;
};

type SelectedEmployee = { userId: number; userName: string; date: string };

type EmployeeRow = {
  id: number;
  name: string;
  department?: string | null;
  status: string;
  checkIn?: string | null;
};

/* ─── Helpers ───────────────────────────────────────────────── */

const LATE_CUTOFF_MINUTES = 7 * 60; // 07:00

function fmtExact(iso: string) {
  const d = new Date(iso);
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function fmtDuration(hours: number | null | undefined) {
  if (hours == null) return null;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sessionStatus(s: any, isOpenSession: boolean): string {
  if (s.status === "on_leave") return "on_leave";
  if (isOpenSession) return "currently_working";
  if (s.status === "early_leave") return "early_leave";
  if (s.status === "late") return "late";
  return "checked_out";
}

function statusBadgeVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "present" || s === "currently_working") return "default";
  if (s === "late") return "secondary";
  if (s === "absent" || s === "early_leave") return "destructive";
  if (s === "on_leave") return "outline";
  return "outline";
}

function eventDotColor(action: "check_in" | "check_out") {
  return action === "check_in" ? "bg-green-500" : "bg-slate-400 dark:bg-slate-500";
}

function eventActionColor(action: "check_in" | "check_out") {
  return action === "check_in"
    ? "text-green-600 dark:text-green-400"
    : "text-slate-500 dark:text-slate-400";
}

function categoryDotColor(status: string) {
  if (status === "present") return "bg-green-500";
  if (status === "late") return "bg-yellow-500";
  if (status === "absent") return "bg-red-500";
  if (status === "on_leave") return "bg-blue-400";
  return "bg-muted-foreground";
}

function categoryBadgeColor(filter: CategoryFilter): string {
  if (filter === "present") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (filter === "absent")  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (filter === "late")    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  if (filter === "on_leave") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-primary/10 text-primary";
}

/* ─── StatCard (interactive button) ─────────────────────────── */

function StatCard({
  label, value, icon: Icon, color, onClick, gradientFrom, gradientTo,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
  onClick?: () => void;
  gradientFrom?: string;
  gradientTo?: string;
}) {
  return (
    <button
      className={`relative overflow-hidden bg-card border border-card-border rounded-2xl p-5 text-start w-full transition-all duration-200 group
        ${onClick ? "cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99]" : "cursor-default"}`}
      onClick={onClick}
      disabled={!onClick}
    >
      {/* Gradient top accent bar */}
      {gradientFrom && gradientTo && (
        <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})` }} />
      )}
      {/* Background glow on hover */}
      {gradientFrom && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity rounded-2xl" style={{ background: `radial-gradient(circle at 30% 30%, ${gradientFrom}, transparent 70%)` }} />
      )}
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shadow-sm`}>
            <Icon className="w-5 h-5" />
          </div>
          {onClick && (
            <ChevronRight className={`w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1`} />
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground font-medium mt-1 truncate">{label}</p>
      </div>
    </button>
  );
}

/* ─── Category Employee Modal ────────────────────────────────── */

const STATUS_CHIPS: Array<{ key: string; labelKey: string }> = [
  { key: "all",      labelKey: "all_employees" },
  { key: "present",  labelKey: "present" },
  { key: "late",     labelKey: "late" },
  { key: "absent",   labelKey: "absent" },
  { key: "on_leave", labelKey: "on_leave" },
];

const CHIP_ACTIVE: Record<string, string> = {
  all:      "bg-primary text-primary-foreground",
  present:  "bg-green-600 text-white",
  late:     "bg-orange-500 text-white",
  absent:   "bg-destructive text-destructive-foreground",
  on_leave: "bg-blue-500 text-white",
};

function CategoryModal({
  filter,
  employees,
  onClose,
  onSelectEmployee,
  t,
  isArabic,
}: {
  filter: CategoryFilter;
  employees: EmployeeRow[];
  onClose: () => void;
  onSelectEmployee: (emp: EmployeeRow) => void;
  t: (k: string) => string;
  isArabic: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusChip, setStatusChip] = useState<string>("all");

  const categoryLabel = t(filter === "on_leave" ? "on_leave" : filter);
  const dotColor = categoryDotColor(
    filter === "total" ? "present" : filter === "on_leave" ? "on_leave" : filter
  );

  const filtered = useMemo(() => {
    let list = employees;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          (e.department?.toLowerCase().includes(q) ?? false)
      );
    }
    if (filter === "total" && statusChip !== "all") {
      list = list.filter(e => e.status === statusChip);
    }
    return list;
  }, [employees, search, statusChip, filter]);

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md max-h-[85vh] flex flex-col overflow-hidden gap-0 p-0"
        dir={isArabic ? "rtl" : "ltr"}
      >
        {/* ── Header ── */}
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
            <span>{categoryLabel}</span>
            <Badge variant="outline" className="ms-auto text-xs font-normal tabular-nums">
              {filtered.length}
              {filtered.length !== employees.length && (
                <span className="text-muted-foreground"> / {employees.length}</span>
              )}
              {" "}{t("employees")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* ── Search bar ── */}
        <div className="px-5 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("search_employees")}
              className="ps-8 pe-8 h-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Status filter chips (Total category only) ── */}
        {filter === "total" && (
          <div className="px-5 pb-3 flex flex-wrap gap-1.5 flex-shrink-0">
            {STATUS_CHIPS.map(chip => (
              <button
                key={chip.key}
                onClick={() => setStatusChip(chip.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusChip === chip.key
                    ? (CHIP_ACTIVE[chip.key] ?? "bg-primary text-primary-foreground")
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {t(chip.labelKey)}
              </button>
            ))}
          </div>
        )}

        <div className="h-px bg-border flex-shrink-0 mx-5" />

        {/* ── Employee list ── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("no_employees")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(emp => (
                <button
                  key={emp.id}
                  className="w-full px-2 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-start group rounded-lg"
                  onClick={() => onSelectEmployee(emp)}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {emp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.department ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-end">
                      <Badge
                        variant={statusBadgeVariant(emp.status)}
                        className="text-xs capitalize"
                      >
                        {t(emp.status) || emp.status.replace(/_/g, " ")}
                      </Badge>
                      {emp.checkIn && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {fmtExact(emp.checkIn)}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${isArabic ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 flex-shrink-0 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">{t("click_row_for_details")}</p>
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── SessionRow ────────────────────────────────────────────── */

function SessionRow({
  session, idx, isOpenSession, t,
}: {
  session: any;
  idx: number;
  isOpenSession: boolean;
  t: (k: string) => string;
}) {
  const sessStatus = sessionStatus(session, isOpenSession);
  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isOpenSession
          ? "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              isOpenSession
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {idx + 1}
          </div>
          <span className="text-sm font-semibold">
            {t("session")} {idx + 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOpenSession && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
              <Radio className="w-3 h-3 animate-pulse" /> {t("live")}
            </span>
          )}
          <Badge variant={statusBadgeVariant(sessStatus)} className="text-xs capitalize">
            {t(sessStatus) || sessStatus.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LogIn className="w-3 h-3 flex-shrink-0" /> {t("check_in")}
          </div>
          <p className="font-mono font-semibold text-base">{fmtExact(session.checkIn)}</p>
          {session.locationName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{session.locationName}</span>
            </div>
          )}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LogOut className="w-3 h-3 flex-shrink-0" /> {t("check_out")}
          </div>
          {session.checkOut ? (
            <>
              <p className="font-mono font-semibold text-base">{fmtExact(session.checkOut)}</p>
              {session.locationName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{session.locationName}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm italic">{t("in_progress")}</p>
          )}
        </div>
      </div>

      {(session.hoursWorked != null || isOpenSession) && (
        <div className="pt-2 border-t border-border flex items-center gap-3 text-sm">
          <Timer className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground text-xs">{t("duration")}:</span>
          <span className="font-semibold">
            {session.hoursWorked != null ? fmtDuration(session.hoursWorked) : t("in_progress")}
          </span>
          {session.overtime != null && session.overtime > 0 && (
            <span className="text-orange-500 text-xs">+{fmtDuration(session.overtime)} OT</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Employee Detail Modal ─────────────────────────────────── */

function EmployeeDetailModal({
  selected, onClose, t, isArabic,
}: {
  selected: SelectedEmployee;
  onClose: () => void;
  t: (k: string) => string;
  isArabic: boolean;
}) {
  const { data: sessions, isLoading } = useListAttendance(
    { userId: selected.userId, from: selected.date, to: selected.date },
    {
      query: {
        queryKey: getListAttendanceQueryKey({ userId: selected.userId, from: selected.date, to: selected.date }),
        enabled: true,
      },
    }
  );

  const totalHours = sessions?.reduce((s, r) => s + (r.hoursWorked ?? 0), 0) ?? 0;
  const hasOpenSession = sessions?.some(s => !s.checkOut) ?? false;
  const overallStatus = hasOpenSession
    ? "currently_working"
    : sessions?.length
    ? "checked_out"
    : "absent";

  const displayDate = (() => {
    try {
      return format(new Date(selected.date + "T12:00:00"), "EEEE, MMMM d, yyyy");
    } catch {
      return selected.date;
    }
  })();

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
              {selected.userName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-base">{selected.userName}</p>
              <p className="text-xs text-muted-foreground font-normal">{displayDate}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 px-1">
          <Badge variant={statusBadgeVariant(overallStatus)} className="capitalize">
            {t(overallStatus)}
          </Badge>
          {sessions && sessions.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              <span>
                {sessions.length} {sessions.length === 1 ? t("session") : t("sessions_today")}
              </span>
            </div>
          )}
          {totalHours > 0 && (
            <div className="flex items-center gap-1.5 ms-auto text-sm font-medium">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>{fmtDuration(totalHours)}</span>
              <span className="text-muted-foreground text-xs">{t("total")}</span>
            </div>
          )}
        </div>

        <div className="space-y-3 mt-1">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : sessions && sessions.length > 0 ? (
            sessions
              .slice()
              .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime())
              .map((s, idx) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  idx={idx}
                  isOpenSession={!s.checkOut}
                  t={t}
                />
              ))
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("no_activity_today")}</p>
            </div>
          )}
        </div>

        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Dashboard ────────────────────────────────────────── */

function statusDotColor(s: string) {
  if (s === "present") return "bg-green-500";
  if (s === "late") return "bg-yellow-500";
  if (s === "absent") return "bg-red-500";
  if (s === "on_leave") return "bg-blue-400";
  return "bg-muted-foreground";
}

function statusColorVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "present") return "default";
  if (s === "late") return "secondary";
  if (s === "absent") return "destructive";
  return "outline";
}

/* ─── Weekly Attendance Bar Chart ──────────────────────────── */
function WeeklyAttendanceChart({ isArabic }: { isArabic: boolean }) {
  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      return format(d, "yyyy-MM-dd");
    });
  }, []);

  const { data: weekRecords } = useQuery<any[]>({
    queryKey: ["weekly-att", last7[0]],
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/attendance?from=${last7[0]}&to=${last7[6]}`),
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    return last7.map(date => {
      const recs = (weekRecords ?? []).filter((r: any) => r.date === date);
      const present = recs.filter((r: any) => r.status === "present").length;
      const late    = recs.filter((r: any) => r.status === "late").length;
      const absent  = recs.filter((r: any) => r.status === "absent").length;
      const label   = format(new Date(date + "T12:00:00"), "EEE");
      return { label, present, late, absent };
    });
  }, [weekRecords, last7]);

  return (
    <div className="bg-card border border-card-border rounded-xl p-5" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">
          {isArabic ? t("attendance_last_7_days") : "Attendance Last 7 Days"}
        </h2>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={14} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <RechartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="present" name={isArabic ? t("present_label2") : "Present"} fill="#22c55e" radius={[3,3,0,0]} />
          <Bar dataKey="late"    name={isArabic ? t("late_label2") : "Late"}    fill="#f97316" radius={[3,3,0,0]} />
          <Bar dataKey="absent"  name={isArabic ? t("absent_label2") : "Absent"}   fill="#ef4444" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isArabic = lang === "ar";

  const today = format(new Date(), "yyyy-MM-dd");
  const now = new Date();

  const { data: stats, isLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: todayAtt } = useGetTodayAttendance();
  const { data: allUsers } = useListUsers(undefined, {
    query: { enabled: me?.role === "admin" } as any,
  });

  const { data: todayRecords } = useListAttendance(
    { from: today, to: today },
    {
      query: {
        enabled: me?.role === "admin",
        queryKey: getListAttendanceQueryKey({ from: today, to: today }),
      },
    }
  );

  const { data: approvedLeaves } = useListLeave(
    { from: today, to: today, status: "approved" },
    {
      query: {
        enabled: me?.role === "admin",
        queryKey: getListLeaveQueryKey({ from: today, to: today, status: "approved" }),
      },
    }
  );

  const { data: pendingLeaveRequests, refetch: refetchPendingLeaves } = useListLeave(
    { status: "pending" },
    {
      query: {
        enabled: me?.role === "admin",
        queryKey: getListLeaveQueryKey({ status: "pending" }),
        staleTime: 30_000,
      },
    }
  );

  const [selectedEmployee, setSelectedEmployee] = useState<SelectedEmployee | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter | null>(null);
  const [approvalLoading, setApprovalLoading] = useState<number | null>(null);
  const [leaveActionLoading, setLeaveActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAdmin = me?.role === "admin";

  const [wrViewImg, setWrViewImg]   = useState<string | null>(null);
  const [wrDeleteId, setWrDeleteId] = useState<number | null>(null);
  const [wrDeleting, setWrDeleting] = useState(false);
  const [wrShowAll,  setWrShowAll]  = useState(false);

  /* ── Metric card dialogs ── */
  const [hoursDialogOpen,  setHoursDialogOpen]  = useState(false);
  const [rateDialogOpen,   setRateDialogOpen]   = useState(false);
  const [leavesDialogOpen, setLeavesDialogOpen] = useState(false);

  const { data: workReports = [], refetch: refetchWr } = useQuery<any[]>({
    queryKey: ["admin-work-reports"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/work-reports"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const handleDeleteWr = async () => {
    if (!wrDeleteId) return;
    setWrDeleting(true);
    try {
      await fetch(apiUrl(`/api/work-reports/${wrDeleteId}`), {
        method: "DELETE", headers: authHeaders(),
      });
      toast({ title: isArabic ? t("report_deleted2") : "Report deleted" });
      setWrDeleteId(null);
      refetchWr();
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setWrDeleting(false);
    }
  };

  const { data: pendingUsers, refetch: refetchPending } = useQuery<any[]>({
    queryKey: ["admin-pending-users"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/admin/pending-users"), {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to fetch pending users (${res.status})`);
      return res.json();
    },
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const handleApprove = async (userId: number) => {
    setApprovalLoading(userId);
    try {
      const res = await fetch(apiUrl(`/api/admin/approve/${userId}`), {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("user_approved") });
      refetchPending();
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    } catch {
      toast({ title: t("approval_failed"), variant: "destructive" });
    } finally {
      setApprovalLoading(null);
    }
  };

  const handleReject = async (userId: number) => {
    setApprovalLoading(userId);
    try {
      const res = await fetch(apiUrl(`/api/admin/reject/${userId}`), {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("user_rejected") });
      refetchPending();
    } catch {
      toast({ title: t("approval_failed"), variant: "destructive" });
    } finally {
      setApprovalLoading(null);
    }
  };

  const handleLeaveApprove = async (leaveId: number) => {
    setLeaveActionLoading(`approve-${leaveId}`);
    try {
      const res = await fetch(apiUrl(`/api/leave/${leaveId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("leave_approved_toast") });
      refetchPendingLeaves();
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setLeaveActionLoading(null);
    }
  };

  const handleLeaveReject = async (leaveId: number) => {
    setLeaveActionLoading(`reject-${leaveId}`);
    try {
      const res = await fetch(apiUrl(`/api/leave/${leaveId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: t("leave_rejected_toast") });
      refetchPendingLeaves();
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally {
      setLeaveActionLoading(null);
    }
  };

  const todayExt = todayAtt as any;
  const currentlyCheckedIn: boolean = todayExt?.currentlyCheckedIn ?? false;
  const sessions: any[] = todayExt?.sessions ?? (todayAtt ? [todayAtt] : []);
  const totalHoursToday: number = todayExt?.totalHoursWorked ?? todayAtt?.hoursWorked ?? 0;
  const recentActivity = stats?.recentActivity ?? [];
  const allUsersList = allUsers ?? [];

  /* ── Category employee lists (computed from real-time data) ── */
  const categoryEmployees = useMemo((): Record<CategoryFilter, EmployeeRow[]> => {
    if (!isAdmin || !allUsersList.length) {
      return { total: [], present: [], absent: [], late: [], on_leave: [] };
    }

    const recordsByUser = new Map<number, any[]>();
    for (const rec of todayRecords ?? []) {
      if (!recordsByUser.has(rec.userId)) recordsByUser.set(rec.userId, []);
      recordsByUser.get(rec.userId)!.push(rec);
    }

    const leaveUserIds = new Set((approvedLeaves ?? []).map(l => l.userId));

    const presentList: EmployeeRow[] = [];
    const lateList: EmployeeRow[] = [];
    const absentList: EmployeeRow[] = [];
    const onLeaveList: EmployeeRow[] = [];

    for (const user of allUsersList) {
      const recs = recordsByUser.get(user.id) ?? [];

      const row: EmployeeRow = {
        id: user.id,
        name: user.name,
        department: (user as any).department ?? null,
        status: "absent",
        checkIn: null,
      };

      if (leaveUserIds.has(user.id)) {
        row.status = "on_leave";
        onLeaveList.push(row);
      } else if (recs.length === 0) {
        row.status = "absent";
        absentList.push(row);
      } else {
        const sorted = recs
          .slice()
          .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
        const firstRec = sorted[0];
        const firstCheckIn = new Date(firstRec.checkIn);
        const minutesSinceMidnight =
          firstCheckIn.getHours() * 60 + firstCheckIn.getMinutes();
        const isLate =
          firstRec.status === "late" || minutesSinceMidnight > LATE_CUTOFF_MINUTES;

        row.checkIn = firstRec.checkIn;
        if (isLate) {
          row.status = "late";
          lateList.push(row);
        } else {
          row.status = "present";
          presentList.push(row);
        }
      }
    }

    const totalList: EmployeeRow[] = allUsersList.map(u => {
      const found =
        presentList.find(e => e.id === u.id) ??
        lateList.find(e => e.id === u.id) ??
        absentList.find(e => e.id === u.id) ??
        onLeaveList.find(e => e.id === u.id);
      return (
        found ?? {
          id: u.id,
          name: u.name,
          department: (u as any).department ?? null,
          status: "absent",
          checkIn: null,
        }
      );
    });

    return {
      total: totalList,
      present: presentList,
      absent: absentList,
      late: lateList,
      on_leave: onLeaveList,
    };
  }, [todayRecords, allUsersList, approvedLeaves, isAdmin]);

  /* ── Activity events for live feed ── */
  const activityEvents = useMemo((): ActivityEvent[] => {
    if (!todayRecords) return [];
    const events: ActivityEvent[] = [];
    for (const rec of todayRecords) {
      events.push({
        recordId: rec.id,
        userId: rec.userId,
        userName: (rec as any).userName ?? `User #${rec.userId}`,
        date: rec.date,
        action: "check_in",
        timestamp: rec.checkIn,
        locationName: (rec as any).locationName ?? null,
        status: rec.status,
      });
      if (rec.checkOut) {
        events.push({
          recordId: rec.id,
          userId: rec.userId,
          userName: (rec as any).userName ?? `User #${rec.userId}`,
          date: rec.date,
          action: "check_out",
          timestamp: rec.checkOut,
          locationName: (rec as any).locationName ?? null,
          status: rec.status,
        });
      }
    }
    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [todayRecords]);

  const openDetailModal = (userId: number, userName: string, date: string) => {
    setCategoryFilter(null);
    setSelectedEmployee({ userId, userName, date });
  };

  const handleCategoryEmployeeClick = (emp: EmployeeRow) => {
    setCategoryFilter(null);
    setSelectedEmployee({ userId: emp.id, userName: emp.name, date: today });
  };

  if (!me && !isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm text-muted-foreground">{t("loading") ?? "Loading…"}</p>
        </div>
      </Layout>
    );
  }

  if (isLoading || !me) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header — gradient hero banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-violet-600 text-primary-foreground p-6 shadow-lg">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium opacity-80">
                {(() => {
                  const h = now.getHours();
                  if (h < 12) return t("good_morning");
                  if (h < 17) return t("good_afternoon");
                  return t("good_evening");
                })()}
              </p>
              <h1 className="text-2xl font-bold mt-0.5">{t("welcome_greeting", { name: me?.name ?? "" })}</h1>
              <p className="text-sm opacity-70 mt-1">{format(now, "EEEE, MMMM d, yyyy")}</p>
              {todayAtt && (
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {currentlyCheckedIn ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-sm font-medium">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      {t("currently_checked_in")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-medium">
                      <LogOut className="w-3.5 h-3.5" />
                      {t("session_ended")}
                    </div>
                  )}
                  {sessions.length > 1 && (
                    <span className="text-xs opacity-70">{sessions.length} {t("sessions_today")}</span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold">
                    {t(todayAtt.status ?? "") || (todayAtt.status ?? "").replace("_", " ")}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl shadow-inner">
              <ClockWidget />
            </div>
          </div>
        </div>

        {/* My hours card (employee only) */}
        {todayAtt && !isAdmin && (
          <div className="bg-card border border-card-border rounded-xl p-4 flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                currentlyCheckedIn
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentlyCheckedIn ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-medium">{t("total_hours_today")}</p>
              <p className="text-2xl font-bold">{totalHoursToday.toFixed(2)}h</p>
            </div>
            <div className="ms-auto text-end">
              <p className="text-xs text-muted-foreground">{t("sessions_today")}</p>
              <p className="text-lg font-semibold">{sessions.length}</p>
            </div>
          </div>
        )}

        {/* Stats grid — 5 interactive cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label={t("total_employees")}
              value={stats.totalEmployees}
              icon={Users}
              color="bg-primary/10 text-primary"
              gradientFrom="hsl(var(--primary))"
              gradientTo="#7c3aed"
              onClick={isAdmin ? () => setCategoryFilter("total") : undefined}
            />
            <StatCard
              label={t("present")}
              value={stats.presentToday}
              icon={UserCheck}
              color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              gradientFrom="#16a34a"
              gradientTo="#059669"
              onClick={isAdmin ? () => setCategoryFilter("present") : undefined}
            />
            <StatCard
              label={t("absent")}
              value={stats.absentToday}
              icon={UserX}
              color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              gradientFrom="#dc2626"
              gradientTo="#e11d48"
              onClick={isAdmin ? () => setCategoryFilter("absent") : undefined}
            />
            <StatCard
              label={t("late")}
              value={stats.lateToday}
              icon={AlertCircle}
              color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              gradientFrom="#ea580c"
              gradientTo="#d97706"
              onClick={isAdmin ? () => setCategoryFilter("late") : undefined}
            />
            <StatCard
              label={t("on_leave")}
              value={stats.onLeaveToday ?? 0}
              icon={Umbrella}
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              gradientFrom="#2563eb"
              gradientTo="#0284c7"
              onClick={isAdmin ? () => setCategoryFilter("on_leave") : undefined}
            />
          </div>
        ) : null}

        {/* Metrics row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Hours This Month */}
          <button
            onClick={() => setHoursDialogOpen(true)}
            className="relative overflow-hidden bg-card border border-card-border rounded-2xl p-5 space-y-3 text-start w-full group hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          >
            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 to-primary" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">{t("hours_this_month")}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ms-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-bold tabular-nums">{stats?.totalHoursThisMonth?.toFixed(1) ?? "—"}<span className="text-lg text-muted-foreground ms-1">h</span></p>
            <p className="text-xs text-muted-foreground">{t("total_hours_logged")}</p>
          </button>

          {/* Attendance Rate */}
          <button
            onClick={() => setRateDialogOpen(true)}
            className="relative overflow-hidden bg-card border border-card-border rounded-2xl p-5 space-y-3 text-start w-full group hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          >
            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-gradient-to-r from-emerald-500 to-teal-400" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">{t("attendance_rate")}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ms-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-bold tabular-nums">{stats?.avgAttendanceRate ?? 0}<span className="text-lg text-muted-foreground">%</span></p>
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="h-2 rounded-full transition-all bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: `${stats?.avgAttendanceRate ?? 0}%` }} />
              </div>
            </div>
          </button>

          {/* Pending Leaves */}
          <button
            onClick={() => setLeavesDialogOpen(true)}
            className="relative overflow-hidden bg-card border border-card-border rounded-2xl p-5 space-y-3 text-start w-full group hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
          >
            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-gradient-to-r from-amber-400 to-orange-500" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">{t("pending_leaves")}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ms-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-3xl font-bold tabular-nums">{stats?.pendingLeaves ?? 0}</p>
            <p className="text-xs text-muted-foreground">{t("awaiting_approval")}</p>
          </button>
        </div>

        {/* ── Pending User Approvals (admin only) ── */}
        {isAdmin && pendingUsers && pendingUsers.length > 0 && (
          <div className="bg-card border border-amber-300 dark:border-amber-700 rounded-xl" dir={isArabic ? "rtl" : "ltr"}>
            <div className="px-5 py-4 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2 bg-amber-50/60 dark:bg-amber-900/10 rounded-t-xl">
              <UserCog className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <h2 className="font-semibold text-amber-800 dark:text-amber-300">{t("pending_approvals")}</h2>
              <Badge className="ms-1 bg-amber-500 text-white border-0 text-xs tabular-nums">{pendingUsers.length}</Badge>
              <p className="ms-2 text-xs text-amber-700/70 dark:text-amber-400/70 hidden sm:block">{t("pending_users_desc")}</p>
              <Button
                variant="outline"
                size="sm"
                className="ms-auto h-7 gap-1.5 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={() => refetchPending()}
              >
                <RefreshCw className="w-3 h-3" /> {t("refresh") ?? "Refresh"}
              </Button>
            </div>
            <div className="divide-y divide-border">
              {pendingUsers.map((user: any) => (
                <div key={user.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    {user.department && (
                      <p className="text-xs text-muted-foreground/70">{user.department}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground hidden md:block">
                    <span>{t("registered_at")}: </span>
                    <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                      onClick={() => handleApprove(user.id)}
                      disabled={approvalLoading === user.id}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => handleReject(user.id)}
                      disabled={approvalLoading === user.id}
                    >
                      <XCircle className="w-3.5 h-3.5" /> {t("reject")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Pending Leave Requests (admin only) ── */}
        {isAdmin && pendingLeaveRequests && pendingLeaveRequests.length > 0 && (
          <div className="bg-card border border-blue-300 dark:border-blue-700 rounded-xl" dir={isArabic ? "rtl" : "ltr"}>
            <div className="px-5 py-4 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2 bg-blue-50/60 dark:bg-blue-900/10 rounded-t-xl">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <h2 className="font-semibold text-blue-800 dark:text-blue-300">{t("pending_leave_requests")}</h2>
              <Badge className="ms-1 bg-blue-500 text-white border-0 text-xs tabular-nums">{pendingLeaveRequests.length}</Badge>
              <p className="ms-2 text-xs text-blue-700/70 dark:text-blue-400/70 hidden sm:block">{t("pending_leave_requests_desc")}</p>
            </div>
            <div className="divide-y divide-border">
              {pendingLeaveRequests.map((leave: any) => (
                <div key={leave.id} className="px-5 py-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{leave.userName ?? t("employee")}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {leave.type} — {leave.startDate} → {leave.endDate}
                      <span className="ms-1 text-muted-foreground/60">({leave.totalDays}d)</span>
                    </p>
                    {leave.reason && (
                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5">"{leave.reason}"</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground hidden md:block">
                    <span>{t("registered_at")}: </span>
                    <span>{new Date(leave.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                      onClick={() => handleLeaveApprove(leave.id)}
                      disabled={leaveActionLoading === `approve-${leave.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => handleLeaveReject(leave.id)}
                      disabled={leaveActionLoading === `reject-${leave.id}`}
                    >
                      <XCircle className="w-3.5 h-3.5" /> {t("reject")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Live Activity Feed (admin only) ── */}
        {isAdmin && (
          <div
            className="bg-card border border-card-border rounded-xl"
            dir={isArabic ? "rtl" : "ltr"}
          >
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
                <Radio className="w-4 h-4 text-primary" />
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              </div>
              <h2 className="font-semibold">{t("live_activity_feed")}</h2>
              <span className="text-xs text-muted-foreground ms-1">
                — {t("today")}, {format(now, "HH:mm")}
              </span>
              <span className="ms-auto text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                {activityEvents.length} {t("events")}
              </span>
            </div>

            {activityEvents.length === 0 ? (
              <div className="px-5 py-10 text-center text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("no_activity_today")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {activityEvents.map((ev, idx) => (
                  <button
                    key={`${ev.recordId}-${ev.action}`}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-start group"
                    onClick={() => openDetailModal(ev.userId, ev.userName, ev.date)}
                    data-testid={`row-activity-event-${idx}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${eventDotColor(ev.action)}`}
                    />
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                      {ev.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate">{ev.userName}</span>
                        <span className={`text-xs font-medium ${eventActionColor(ev.action)}`}>
                          {ev.action === "check_in"
                            ? `↑ ${t("checked_in_action")}`
                            : `↓ ${t("checked_out_action")}`}
                        </span>
                      </div>
                      {ev.locationName && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{ev.locationName}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className="font-mono text-sm font-semibold tabular-nums">
                        {fmtExact(ev.timestamp)}
                      </p>
                      <Badge
                        variant={statusBadgeVariant(ev.status)}
                        className="text-xs mt-0.5 capitalize"
                      >
                        {ev.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                        isArabic ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}

            {activityEvents.length > 0 && (
              <div className="px-5 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">{t("click_row_for_details")}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Advanced Charts (admin only) ── */}
        {isAdmin && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Donut chart: today's status breakdown */}
            <div className="bg-card border border-card-border rounded-xl p-5" dir={isArabic ? "rtl" : "ltr"}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">
                  {isArabic ? t("today_attendance_distribution") : "Today's Attendance Breakdown"}
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: isArabic ? t("present_label2") : "Present",  value: stats.presentToday ?? 0 },
                      { name: isArabic ? t("absent_label2") : "Absent",   value: stats.absentToday ?? 0 },
                      { name: isArabic ? t("late_label2") : "Late",    value: stats.lateToday ?? 0 },
                      { name: isArabic ? t("leave_short") : "On Leave", value: stats.onLeaveToday ?? 0 },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {["#22c55e", "#ef4444", "#f97316", "#3b82f6"].map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}
                  </Pie>
                  <RechartTooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 justify-center mt-1">
                {[
                  { label: isArabic ? t("present_label2") : "Present",   color: "#22c55e", val: stats.presentToday ?? 0 },
                  { label: isArabic ? t("absent_label2") : "Absent",    color: "#ef4444", val: stats.absentToday ?? 0 },
                  { label: isArabic ? t("late_label2") : "Late",     color: "#f97316", val: stats.lateToday ?? 0 },
                  { label: isArabic ? t("leave_short") : "On Leave", color: "#3b82f6", val: stats.onLeaveToday ?? 0 },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold tabular-nums">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart: last 7 days attendance */}
            <WeeklyAttendanceChart isArabic={isArabic} />
          </div>
        )}

        {/* Live Monitoring */}
        {isAdmin && allUsersList.length > 0 && (
          <div
            className="bg-card border border-card-border rounded-xl"
            dir={isArabic ? "rtl" : "ltr"}
          >
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <div className="relative flex items-center justify-center w-5 h-5">
                <Radio className="w-4 h-4 text-green-500" />
                <span className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
              </div>
              <h2 className="font-semibold">{t("live_monitoring")}</h2>
              <span className="ms-auto text-xs text-muted-foreground">
                {format(now, "HH:mm")}
              </span>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {allUsersList.map(user => {
                const rec = recentActivity.find(r => r.userId === user.id);
                const status = rec?.status ?? "absent";
                return (
                  <button
                    key={user.id}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-start group"
                    onClick={() => openDetailModal(user.id, user.name, today)}
                    data-testid={`row-live-${user.id}`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(status)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(user as any).department ?? "—"}
                      </p>
                    </div>
                    <div className="text-end flex items-center gap-2">
                      <div>
                        <Badge
                          variant={statusColorVariant(status) as any}
                          className="capitalize text-xs"
                        >
                          {status.replace("_", " ")}
                        </Badge>
                        {rec?.checkIn && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {fmtExact(rec.checkIn)}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ${
                          isArabic ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Modal */}
      {categoryFilter && (
        <CategoryModal
          filter={categoryFilter}
          employees={categoryEmployees[categoryFilter]}
          onClose={() => setCategoryFilter(null)}
          onSelectEmployee={handleCategoryEmployeeClick}
          t={t}
          isArabic={isArabic}
        />
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <EmployeeDetailModal
          selected={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          t={t}
          isArabic={isArabic}
        />
      )}

      {/* ── Admin: Work Reports Panel ──────────────────────── */}
      {isAdmin && (
        <div className="bg-card border border-card-border rounded-xl" dir={isArabic ? "rtl" : "ltr"}>
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">
              {isArabic ? t("work_docs_all_employees") : t("all_employees_reports")}
            </h2>
            <span className="ms-auto text-xs text-muted-foreground tabular-nums">
              {workReports.length} {isArabic ? t("report_label") : "reports"}
            </span>
          </div>

          {workReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">{isArabic ? t("no_reports_yet2") : t("no_reports_yet")}</p>
            </div>
          ) : (
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(wrShowAll ? workReports : workReports.slice(0, 8)).map((r: any) => (
                  <div
                    key={r.id}
                    className="group relative rounded-xl overflow-hidden bg-muted border border-border hover:border-primary/40 transition-all"
                  >
                    {/* thumbnail */}
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={r.imageUrl}
                        alt={r.note ?? ""}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    </div>
                    {/* overlay actions */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setWrViewImg(r.imageUrl)}
                        className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow"
                        title={isArabic ? t("view_action2") : "View"}
                      >
                        <Eye className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => setWrDeleteId(r.id)}
                        className="w-8 h-8 bg-red-500/90 rounded-full flex items-center justify-center hover:bg-red-600 shadow"
                        title={isArabic ? t("delete_action2") : "Delete"}
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    {/* info bar */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                      <p className="text-white text-xs font-medium truncate">{r.employeeName}</p>
                      {r.note && <p className="text-white/70 text-[10px] truncate">{r.note}</p>}
                      <p className="text-white/60 text-[10px]">
                        {format(new Date(r.createdAt), "d/M/yyyy · HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {workReports.length > 8 && (
                <button
                  className="mt-4 w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setWrShowAll(v => !v)}
                >
                  {wrShowAll
                    ? (isArabic ? t("show_less") : "Show less ↑")
                    : (isArabic ? `عرض ${workReports.length - 8} أخرى ↓` : `Show ${workReports.length - 8} more ↓`)}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Image viewer dialog */}
      <Dialog open={!!wrViewImg} onOpenChange={v => { if (!v) setWrViewImg(null); }}>
        <DialogContent className="max-w-2xl p-2 bg-black border-0">
          <button
            onClick={() => setWrViewImg(null)}
            className="absolute top-3 end-3 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
          {wrViewImg && (
            <img src={wrViewImg} alt="full" className="w-full rounded object-contain max-h-[80vh]" />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!wrDeleteId} onOpenChange={v => { if (!v) setWrDeleteId(null); }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              {isArabic ? t("confirm_delete2") : "Confirm Delete"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {isArabic ? t("confirm_delete_report2") : "Delete this work report? This cannot be undone."}
          </p>
          <div className={`flex gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setWrDeleteId(null)} disabled={wrDeleting}>
              {isArabic ? t("cancel_action2") : "Cancel"}
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={handleDeleteWr} disabled={wrDeleting}>
              {wrDeleting ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block me-1" /> : null}
              {isArabic ? t("delete_action2") : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Hours This Month Dialog ── */}
      <Dialog open={hoursDialogOpen} onOpenChange={setHoursDialogOpen}>
        <DialogContent className="max-w-lg" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-600" />
              {isArabic ? t("hours_this_month2") : "Hours This Month"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Big number */}
            <div className="rounded-2xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-5 text-center">
              <p className="text-5xl font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                {stats?.totalHoursThisMonth?.toFixed(1) ?? "—"}
                <span className="text-2xl ms-1 font-normal text-muted-foreground">h</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">{isArabic ? t("total_logged_hours2") : "Total hours logged"}</p>
            </div>
            {/* Per-day breakdown from recent activity */}
            {stats?.recentActivity && stats.recentActivity.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? t("recent_activity2") : "Recent Activity"}</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {(stats.recentActivity as any[]).slice(0, 10).map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 text-sm">
                      <span className="text-muted-foreground">{a.date ?? a.userName ?? "—"}</span>
                      <span className="font-medium tabular-nums">
                        {a.hoursWorked != null ? `${Number(a.hoursWorked).toFixed(1)}h` : a.action ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setHoursDialogOpen(false); window.location.href = "/reports"; }}>
              {isArabic ? t("view_full_attendance_report") : "View Full Attendance Report →"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Attendance Rate Dialog ── */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className="max-w-lg" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {isArabic ? t("attendance_rate2") : "Attendance Rate"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Rate circle */}
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5 text-center">
              <p className="text-5xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {stats?.avgAttendanceRate ?? 0}<span className="text-2xl font-normal text-muted-foreground">%</span>
              </p>
              <div className="mt-3 w-full bg-muted rounded-full h-3">
                <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                  style={{ width: `${stats?.avgAttendanceRate ?? 0}%` }} />
              </div>
              <p className="text-sm text-muted-foreground mt-2">{isArabic ? t("avg_attendance_month") : "Average attendance this month"}</p>
            </div>
            {/* Today's stats */}
            {isAdmin && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: isArabic ? t("present_today2") : "Present Today", value: categoryEmployees.present.length, color: "text-green-600" },
                  { label: isArabic ? t("late_label2") : "Late", value: categoryEmployees.late.length, color: "text-yellow-600" },
                  { label: isArabic ? t("absent_label2") : "Absent", value: categoryEmployees.absent.length, color: "text-red-600" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-border bg-muted/30 p-3 text-center">
                    <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setRateDialogOpen(false); window.location.href = "/reports"; }}>
              {isArabic ? t("view_full_attendance_report") : "View Full Attendance Report →"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Pending Leaves Dialog ── */}
      <Dialog open={leavesDialogOpen} onOpenChange={setLeavesDialogOpen}>
        <DialogContent className="max-w-2xl" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              {isArabic ? t("pending_leave_requests2") : "Pending Leave Requests"}
              {pendingLeaveRequests && pendingLeaveRequests.length > 0 && (
                <span className="ms-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs w-5 h-5 font-bold">{pendingLeaveRequests.length}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {(!pendingLeaveRequests || pendingLeaveRequests.length === 0) ? (
              <div className="text-center py-10 text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isArabic ? t("no_pending_leaves") : "No pending leaves"}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {pendingLeaveRequests.map((leave: any) => (
                  <div key={leave.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{leave.userName ?? t("employee")}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {leave.type} — {leave.startDate} → {leave.endDate}
                        <span className="ms-1 opacity-60">({leave.totalDays}d)</span>
                      </p>
                      {leave.reason && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">"{leave.reason}"</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 h-8"
                        onClick={() => { handleLeaveApprove(leave.id); }}
                        disabled={leaveActionLoading === `approve-${leave.id}`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> {t("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5 h-8"
                        onClick={() => { handleLeaveReject(leave.id); }}
                        disabled={leaveActionLoading === `reject-${leave.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> {t("reject")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
