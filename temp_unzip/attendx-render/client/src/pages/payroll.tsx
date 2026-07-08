import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, Calculator, Save, Clock, TrendingUp, TrendingDown,
  FileText, ChevronDown, ChevronUp, Trash2, Loader2, AlertCircle, User,
  Briefcase, BarChart3, UserX, RefreshCw, Share2, Mail, Gift, Minus, X,
} from "lucide-react";
import { exportProfessionalPDF, shareOrSavePDF, emailReport } from "@/lib/pdf-export";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useTranslation as useI18n } from "react-i18next";
import { apiUrl, authHeaders } from "@/lib/api-url";

async function apiPost(path: string, body: unknown) {
  const res = await fetch(apiUrl(`/api${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

async function apiGet(path: string) {
  const res = await fetch(apiUrl(`/api${path}`), { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

async function apiDelete(path: string) {
  const res = await fetch(apiUrl(`/api${path}`), { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Delete failed");
}

/* ─── Period helpers ─────────────────────────────────────── */

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

/* ─── Stat card ──────────────────────────────────────────── */

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string;
  color: "blue" | "green" | "red" | "amber"; icon: React.ElementType;
}) {
  const cls = {
    blue:  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    red:   "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[color];
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Breakdown row ──────────────────────────────────────── */

function Row({ label, value, sub, positive, deduction }: {
  label: string; value: number; sub?: string; positive?: boolean; deduction?: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <p className="text-sm">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${positive ? "text-green-600 dark:text-green-400" : deduction ? "text-red-500" : ""}`}>
        {deduction ? "−" : positive ? "+" : ""}{fmt(value)}
      </span>
    </div>
  );
}

/* ─── Historical reports list ────────────────────────────── */

function HistoryPanel({ t, qc }: { t: (k: string) => string; qc: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["payroll-reports"],
    queryFn: () => apiGet("/payroll/reports"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiDelete(`/payroll/reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-reports"] });
      setConfirmId(null);
      toast({ title: t("report_deleted") ?? "Report deleted" });
    },
    onError: () => {
      toast({ title: t("failed") ?? "Failed to delete report", variant: "destructive" });
    },
  });

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const reportToDelete = reports.find((r: any) => r.id === confirmId);

  return (
    <>
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <FileText className="w-4 h-4 text-primary" />
            {t("payroll_history")}
            {!isLoading && <Badge variant="secondary" className="ms-1 text-xs">{reports.length}</Badge>}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {open && (
          <div className="border-t border-border">
            {isLoading ? (
              <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : reports.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t("no_payroll_reports")}</p>
            ) : (
              <div className="divide-y divide-border">
                {reports.map((r: any) => (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{r.employeeName || <span className="text-muted-foreground italic text-xs">{t("unknown")}</span>}</p>
                        <Badge variant="outline" className="text-xs">{r.period}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span>{t("base_salary")}: <span className="font-medium text-foreground">{fmt(r.baseSalary)}</span></span>
                        <span className="text-green-600">+{fmt(r.totalAdditions)}</span>
                        <span className="text-red-500">−{fmt(r.totalDeductions)}</span>
                        <span className="font-semibold text-foreground">{t("net_salary")}: {fmt(r.netSalary)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmId(r.id)}
                      disabled={deleteMut.isPending && confirmId === r.id}
                      title={t("delete") ?? "Delete"}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-1.5 rounded hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Confirmation Dialog ── */}
      <Dialog open={confirmId !== null} onOpenChange={v => { if (!v) setConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5 flex-shrink-0" />
              {t("delete_report") ?? "Delete Report"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <p className="text-sm font-medium text-center">
              هل أنت متأكد من حذف هذا التقرير؟
            </p>
            <p className="text-xs text-center text-muted-foreground">
              Are you sure you want to delete this report?
            </p>
            {reportToDelete && (
              <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-center space-y-0.5">
                <p className="text-sm font-semibold">{reportToDelete.employeeName}</p>
                <p className="text-xs text-muted-foreground">{reportToDelete.period} · {t("net_salary")}: {fmt(reportToDelete.netSalary)}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">{t("action_cannot_be_undone") ?? "This action cannot be undone."}</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              disabled={deleteMut.isPending}
            >
              {t("cancel") ?? "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId !== null && deleteMut.mutate(confirmId)}
              disabled={deleteMut.isPending}
              className="gap-2"
            >
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("delete") ?? "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */

export default function PayrollPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { appName, appLogo } = useAppConfig();
  const { i18n } = useI18n();
  const isArabic = i18n.language === "ar";
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [selectedBonusItem, setSelectedBonusItem] = useState<any | null>(null);

  /* ── Fetch employees directly – bypasses generated hook type issues ── */
  const {
    data: rawUsers,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery<any[]>({
    queryKey: ["payroll-employees"],
    queryFn: () => apiGet("/users"),
    staleTime: 60_000,
    retry: 3,
    retryDelay: 1000,
  });

  /* Show all employees (role=employee) regardless of approval status.
     Approved check now works too since the API returns isApproved. */
  const employees = useMemo(
    () => (rawUsers ?? []).filter((u: any) => u.role === "employee"),
    [rawUsers],
  );

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod]  = useState<string>(currentPeriod());
  const [notes, setNotes]                    = useState("");
  const [result, setResult]                  = useState<any | null>(null);
  const [showBreakdown, setShowBreakdown]    = useState(true);

  const periods = useMemo(() => periodOptions(), []);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtHM = (h: number) => {
    if (h <= 0) return "—";
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (isArabic) return hh > 0 && mm > 0 ? `${hh}س ${mm}د` : hh > 0 ? `${hh}س` : `${mm}د`;
    return hh > 0 && mm > 0 ? `${hh}h ${mm}m` : hh > 0 ? `${hh}h` : `${mm}m`;
  };

  const handlePayrollPDF = async (download: boolean) => {
    if (!result) return;
    download ? setPdfLoading(true) : setShareLoading(true);
    try {
      // Build records from attendanceRecords if available
      const records = (result.attendanceRecords ?? []).map((r: any) => ({
        date: r.date ?? "",
        employee: result.employeeName,
        checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
        checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—",
        normalHours: r.hoursWorked != null ? `${Math.min(r.hoursWorked, 8).toFixed(1)}h` : "—",
        overtime: r.overtime > 0 ? `${r.overtime.toFixed(1)}h` : "—",
        status: r.status ?? "present",
        lateMinutes: r.lateMinutes ?? 0,
      }));
      const opts = {
        appName: appName || "AttendX",
        appLogo: appLogo || undefined,
        isArabic,
        from: `${result.period}-01`,
        to: `${result.period}-${new Date(parseInt(result.period.slice(0,4)), parseInt(result.period.slice(5,7)), 0).getDate()}`,
        employeeName: result.employeeName,
        summary: {
          workingDays: result.workingDaysInMonth ?? 0,
          presentDays: result.daysPresent ?? 0,
          absentDays: result.daysAbsent ?? 0,
          leaveDays: (result.paidLeaveDays ?? 0) + (result.unpaidLeaveDays ?? 0),
          lateDays: result.lateDays ?? 0,
          totalHours: result.totalWorkHours ?? 0,
          normalHours: result.totalWorkHours ?? 0,
          overtime: result.totalOvertimeHours ?? 0,
          expectedHours: (result.workingDaysInMonth ?? 0) * (result.workHoursPerDay ?? 8),
        },
        records,
        payroll: {
          baseSalary: result.baseSalary,
          overtimeBonus: result.overtimeBonus,
          latePenalty: result.latePenalty,
          unpaidLeaveDeduction: result.unpaidLeaveDeduction,
          absentDeduction: result.absentDeduction ?? 0,
          totalDeductions: result.totalDeductions,
          netSalary: result.netSalary,
          dailyRate: result.dailyRate,
          hourlyRate: result.hourlyRate,
          totalOvertimeHours: result.totalOvertimeHours,
          totalLateMinutes: result.totalLateMinutes,
          period: result.period,
        },
        isAdmin: true,
      };
      if (download) {
        exportProfessionalPDF(opts);
      } else {
        shareOrSavePDF(opts);
      }
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    } finally {
      setPdfLoading(false);
      setShareLoading(false);
    }
  };

  const handlePayrollEmail = () => {
    if (!result) return;
    const subject = isArabic
      ? `كشف راتب — ${result.employeeName} — ${result.period}`
      : `Payslip — ${result.employeeName} — ${result.period}`;
    const body = isArabic
      ? `السلام عليكم،\n\nمرفق بيانات كشف الراتب للموظف ${result.employeeName} عن شهر ${result.period}:\n\n• الراتب الأساسي: ${result.baseSalary?.toFixed(2)}\n• مكافأة الإضافي: +${result.overtimeBonus?.toFixed(2)}\n• إجمالي الخصومات: −${result.totalDeductions?.toFixed(2)}\n• صافي الراتب: ${result.netSalary?.toFixed(2)}\n\n• أيام الحضور: ${result.daysPresent}\n• أيام الغياب: ${result.daysAbsent}\n• ساعات الإضافي: ${result.totalOvertimeHours}\n\nمع التحية`
      : `Hello,\n\nPayslip details for ${result.employeeName} — ${result.period}:\n\n• Base Salary: ${result.baseSalary?.toFixed(2)}\n• Overtime Bonus: +${result.overtimeBonus?.toFixed(2)}\n• Total Deductions: −${result.totalDeductions?.toFixed(2)}\n• Net Salary: ${result.netSalary?.toFixed(2)}\n\n• Days Present: ${result.daysPresent}\n• Days Absent: ${result.daysAbsent}\n• Overtime Hours: ${result.totalOvertimeHours}\n\nBest regards`;
    emailReport(subject, body);
  };

  /* Calculate mutation */
  const calcMut = useMutation({
    mutationFn: () => apiPost("/payroll/calculate", { userId: parseInt(selectedUserId), period: selectedPeriod }),
    onSuccess: (data) => { setResult(data); setShowBreakdown(true); },
    onError: (err: any) => toast({ title: t("failed"), description: err.message, variant: "destructive" }),
  });

  /* Save mutation */
  const saveMut = useMutation({
    mutationFn: () => apiPost("/payroll/save", { ...result, userId: result?.employeeId ?? result?.userId, notes }),
    onSuccess: () => {
      toast({ title: t("payroll_saved") });
      qc.invalidateQueries({ queryKey: ["payroll-reports"] });
    },
    onError: (err: any) => toast({ title: t("failed"), description: err.message, variant: "destructive" }),
  });

  const selectedEmployee = employees.find((e: any) => String(e.id) === selectedUserId);

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" />
            {t("payroll")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("payroll_subtitle")}</p>
        </div>

        {/* Calculator card */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Employee selector */}
            <div className="space-y-1">
              <Label>{t("employee")}</Label>

              {/* Loading skeleton */}
              {usersLoading && <Skeleton className="h-9 w-full" />}

              {/* Fetch error */}
              {!usersLoading && usersError && (
                <div className="flex items-center gap-2 h-9 px-3 border border-destructive/50 rounded-md bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{t("failed")}</span>
                  <button onClick={() => refetchUsers()} className="flex-shrink-0 hover:opacity-70">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* No employees found */}
              {!usersLoading && !usersError && employees.length === 0 && (
                <div className="flex items-center gap-2 h-9 px-3 border border-border rounded-md bg-muted/50 text-muted-foreground text-sm">
                  <UserX className="w-4 h-4 flex-shrink-0" />
                  <span>{t("no_employees_found")}</span>
                </div>
              )}

              {/* Employee dropdown */}
              {!usersLoading && !usersError && employees.length > 0 && (
                <Select
                  value={selectedUserId}
                  onValueChange={v => { setSelectedUserId(v); setResult(null); }}
                >
                  <SelectTrigger data-testid="select-payroll-employee">
                    <SelectValue placeholder={t("select_employee")} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={String(e.id)} data-testid={`option-employee-${e.id}`}>
                        <div className="flex flex-col">
                          <span className="font-medium">{e.name}</span>
                          {(e.department || e.position) && (
                            <span className="text-xs text-muted-foreground">
                              {[e.department, e.position].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Period selector */}
            <div className="space-y-1">
              <Label>{t("payroll_period")}</Label>
              <Select value={selectedPeriod} onValueChange={v => { setSelectedPeriod(v); setResult(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Calculate button */}
            <div className="flex items-end">
              <Button
                className="w-full gap-2"
                disabled={!selectedUserId || calcMut.isPending}
                onClick={() => calcMut.mutate()}
                data-testid="button-calculate-payroll"
              >
                {calcMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {t("calculate")}
              </Button>
            </div>
          </div>

          {/* No salary warning */}
          {selectedEmployee && !selectedEmployee.salary && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-400/40 rounded-lg text-amber-700 dark:text-amber-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {t("no_salary_set")}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Employee info bar */}
            <div className="bg-card border border-card-border rounded-xl px-5 py-3.5 flex items-center gap-4 flex-wrap">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{result.employeeName}</p>
                <p className="text-xs text-muted-foreground">
                  {result.department && <span>{result.department} · </span>}
                  {t("base_salary")}: <span className="font-medium">{fmt(result.baseSalary)}</span>
                  {" · "}{result.workHoursPerDay}h/{t("date")}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">{result.period}</Badge>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={t("base_salary")}   value={fmt(result.baseSalary)}    icon={DollarSign}   color="blue"  sub={`${result.workingDaysInMonth} ${t("working_days")}`} />
              <StatCard label={t("overtime_bonus")} value={`+${fmt(result.overtimeBonus)}`} icon={TrendingUp}  color="green" sub={`${result.totalOvertimeHours}h`} />
              <StatCard label={t("total_deductions")} value={`−${fmt(result.totalDeductions)}`} icon={TrendingDown} color="red" sub={`${result.totalLateMinutes}min ${t("late")}`} />
              <StatCard label={t("net_salary")}     value={fmt(result.netSalary)}     icon={BarChart3}    color={result.netSalary >= result.baseSalary ? "green" : "amber"} />
            </div>

            {/* Attendance summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: t("working_days"), value: result.workingDaysInMonth, color: "text-foreground" },
                { label: t("days_present"), value: result.daysPresent,        color: "text-green-600" },
                { label: t("days_absent"),  value: result.daysAbsent,         color: "text-red-500" },
                { label: t("leave_days"),   value: result.paidLeaveDays + result.unpaidLeaveDays, color: "text-amber-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-card border border-card-border rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Detailed breakdown */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowBreakdown(o => !o)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors"
              >
                <span className="font-semibold text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  {t("salary_breakdown")}
                </span>
                {showBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {showBreakdown && (
                <div className="px-5 pb-4 border-t border-border">
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{t("earnings")}</p>
                    <Row label={t("base_salary")} value={result.baseSalary}
                      sub={`${fmt(result.dailyRate)}/${t("date")} · ${fmt(result.hourlyRate)}/${t("hour")}`} />
                    <Row label={t("overtime_bonus")} value={result.overtimeBonus} positive
                      sub={`${result.totalOvertimeHours}h × ${fmt(result.hourlyRate)} × 1.5`} />

                    {/* Admin bonuses (clickable) */}
                    {(result.bonusItems ?? []).filter((b: any) => b.type === "bonus").map((b: any) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBonusItem(b)}
                        className="w-full flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/40 rounded px-1 transition-colors group"
                      >
                        <div className="text-start">
                          <p className="text-sm flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            {isArabic ? "مكافأة" : "Bonus"}
                            {b.reason && <span className="text-muted-foreground text-xs">— {b.reason.slice(0, 30)}</span>}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums group-hover:underline">+{fmt(b.amount)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{t("deductions")}</p>
                    <Row label={t("late_penalty")} value={result.latePenalty} deduction
                      sub={`${result.totalLateMinutes} ${t("minutes")} × ${fmt(result.hourlyRate / 60)}/min`} />
                    <Row label={t("unpaid_leave_deduction")} value={result.unpaidLeaveDeduction} deduction
                      sub={`${result.unpaidLeaveDays} ${t("days")} × ${fmt(result.dailyRate)}`} />
                    <Row label={t("absence_deduction")} value={result.absentDeduction ?? 0} deduction
                      sub={`${result.daysAbsent} ${t("days")} × ${fmt(result.dailyRate)}`} />

                    {/* Admin deductions (clickable) */}
                    {(result.bonusItems ?? []).filter((b: any) => b.type === "deduction").map((b: any) => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBonusItem(b)}
                        className="w-full flex items-center justify-between py-2.5 border-b border-border last:border-0 hover:bg-muted/40 rounded px-1 transition-colors group"
                      >
                        <div className="text-start">
                          <p className="text-sm flex items-center gap-1.5">
                            <Minus className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            {isArabic ? "خصم" : "Deduction"}
                            {b.reason && <span className="text-muted-foreground text-xs">— {b.reason.slice(0, 30)}</span>}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-red-500 tabular-nums group-hover:underline">−{fmt(b.amount)}</span>
                      </button>
                    ))}
                  </div>

                  {/* Net total */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <p className="font-bold">{t("net_salary")}</p>
                    <p className={`text-lg font-bold tabular-nums ${result.netSalary >= result.baseSalary ? "text-green-600 dark:text-green-400" : "text-amber-600"}`}>
                      {fmt(result.netSalary)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Attendance log (collapsible) */}
            {result.attendanceRecords?.length > 0 && (
              <details className="bg-card border border-card-border rounded-xl overflow-hidden">
                <summary className="px-5 py-3.5 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:bg-muted/40 select-none">
                  <Clock className="w-4 h-4 text-primary" />
                  {t("attendance_log")} ({result.attendanceRecords.length})
                </summary>
                <div className="border-t border-border divide-y divide-border max-h-64 overflow-y-auto">
                  {result.attendanceRecords.map((r: any, i: number) => (
                    <div key={i} className="px-5 py-2 flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground w-20 flex-shrink-0">{r.date}</span>
                      <Badge variant={r.status === "present" ? "default" : r.status === "late" ? "secondary" : "destructive"} className="capitalize text-[10px]">{r.status}</Badge>
                      {r.hoursWorked != null && <span>{r.hoursWorked.toFixed(1)}h</span>}
                      {r.overtime > 0 && <span className="text-green-600">+{r.overtime.toFixed(1)}h OT</span>}
                      {r.lateMinutes > 0 && <span className="text-red-500">−{r.lateMinutes}min</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Export payslip */}
            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {isArabic ? "تصدير كشف الراتب" : "Export Payslip"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => handlePayrollPDF(true)}
                  disabled={pdfLoading || shareLoading}
                >
                  {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {isArabic ? "تحميل PDF احترافي" : "Download PDF"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50"
                  onClick={() => handlePayrollPDF(false)}
                  disabled={pdfLoading || shareLoading}
                >
                  {shareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  {isArabic ? "مشاركة / حفظ في الموبايل" : "Share / Save to Mobile"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50"
                  onClick={handlePayrollEmail}
                >
                  <Mail className="w-4 h-4" />
                  {isArabic ? "إرسال بالإيميل" : "Send by Email"}
                </Button>
              </div>
            </div>

            {/* Save report */}
            <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold">{t("save_report")}</p>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t("payroll_notes_placeholder")}
                rows={2}
              />
              <Button className="gap-2" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="button-save-payroll">
                {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("save_report")}
              </Button>
            </div>
          </>
        )}

        {/* Historical reports */}
        <HistoryPanel t={t} qc={qc} />
      </div>

      {/* ── Bonus/Deduction Detail Dialog ── */}
      <Dialog open={!!selectedBonusItem} onOpenChange={v => { if (!v) setSelectedBonusItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {selectedBonusItem?.type === "bonus"
                ? <Gift className="w-4 h-4 text-green-500" />
                : <Minus className="w-4 h-4 text-red-500" />}
              {selectedBonusItem?.type === "bonus"
                ? (isArabic ? "تفاصيل المكافأة" : "Bonus Details")
                : (isArabic ? "تفاصيل الخصم" : "Deduction Details")}
            </DialogTitle>
          </DialogHeader>
          {selectedBonusItem && (
            <div className="space-y-3 pb-1">
              <div className={`rounded-xl px-4 py-4 text-center ${selectedBonusItem.type === "bonus" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                <p className={`text-2xl font-bold tabular-nums ${selectedBonusItem.type === "bonus" ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {selectedBonusItem.type === "bonus" ? "+" : "−"}{fmt(selectedBonusItem.amount)}
                </p>
                <Badge variant="outline" className={`mt-1 ${selectedBonusItem.type === "bonus" ? "text-green-600 border-green-300" : "text-red-500 border-red-300"}`}>
                  {selectedBonusItem.type === "bonus" ? (isArabic ? "مكافأة" : "Bonus") : (isArabic ? "خصم" : "Deduction")}
                </Badge>
              </div>
              {selectedBonusItem.period && (
                <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">{isArabic ? "الفترة" : "Period"}</p>
                  <p className="text-sm font-medium">{selectedBonusItem.period}</p>
                </div>
              )}
              {selectedBonusItem.reason && (
                <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{isArabic ? "السبب" : "Reason"}</p>
                  <p className="text-sm leading-relaxed">{selectedBonusItem.reason}</p>
                </div>
              )}
              {selectedBonusItem.createdAt && (
                <p className="text-xs text-muted-foreground text-end">
                  🕐 {new Date(selectedBonusItem.createdAt).toLocaleString()}
                </p>
              )}
              <Button className="w-full" size="sm" onClick={() => setSelectedBonusItem(null)}>
                {isArabic ? "إغلاق" : "Close"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
