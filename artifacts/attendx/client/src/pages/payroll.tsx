import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InlineLoader } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, Calculator, Save, Clock, TrendingUp, TrendingDown,
  FileText, ChevronDown, ChevronUp, ChevronRight, Trash2, Loader2, AlertCircle, User,
  Briefcase, BarChart3, UserX, RefreshCw, Share2, Mail, Gift, Minus, X, ShoppingBag,
  Send, CalendarRange, Home, Car,
} from "lucide-react";
import { exportProfessionalPDF, shareOrSavePDF, emailReportHTML, type PdfReportOptions } from "@/lib/pdf-export";
import { EmailReportDialog } from "@/components/EmailReportDialog";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useTranslation as useI18n } from "react-i18next";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { useSettings } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format-currency";

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

function StatCard({ label, value, sub, color, icon: Icon, onClick }: {
  label: string; value: string; sub?: string;
  color: "blue" | "green" | "red" | "amber"; icon: React.ElementType;
  onClick?: () => void;
}) {
  const cls = {
    blue:  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    red:   "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[color];
  return (
    <div
      className={`bg-card border border-card-border rounded-xl p-4 flex items-start gap-3 ${onClick ? "cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.98] transition-all select-none" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {onClick && <span className="text-[10px] text-primary opacity-60 flex-shrink-0">↗</span>}
        </div>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Breakdown row ──────────────────────────────────────── */

function Row({ label, value, sub, positive, deduction, currency }: {
  label: string; value: number; sub?: string; positive?: boolean; deduction?: boolean; currency?: import("@/lib/format-currency").Currency;
}) {
  const fmt = (n: number) => formatCurrency(n, currency ?? "USD");
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

const HISTORY_PAGE_SIZE = 20;

function HistoryPanel({ t, qc }: { t: (k: string) => string; qc: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const { toast } = useToast();

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["payroll-reports"],
    queryFn: () => apiGet("/payroll/reports"),
    staleTime: 2 * 60 * 1000, // 2 minutes — payroll history rarely changes mid-session
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

  const { currency } = useSettings();
  const fmt = (n: number) => formatCurrency(n, currency);

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
              <InlineLoader />
            ) : reports.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t("no_payroll_reports")}</p>
            ) : (
              <div className="divide-y divide-border">
                {reports.slice(0, visibleCount).map((r: any) => (
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
                {reports.length > visibleCount && (
                  <div className="px-5 py-3 text-center">
                    <button
                      onClick={() => setVisibleCount(c => c + HISTORY_PAGE_SIZE)}
                      className="text-xs text-primary hover:underline"
                    >
                      {`عرض المزيد (${reports.length - visibleCount} متبقي)`}
                    </button>
                  </div>
                )}
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
  const { currency } = useSettings();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { appName, appLogo } = useAppConfig();
  const { i18n } = useI18n();
  const isArabic = i18n.language === "ar";
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [selectedBonusItem, setSelectedBonusItem] = useState<any | null>(null);
  const [statCardDetail, setStatCardDetail] = useState<"base" | "overtime" | "deductions" | "net" | null>(null);
  const [breakdownItem, setBreakdownItem] = useState<string | null>(null);
  const [sendPeriod, setSendPeriod] = useState<string>(currentPeriod());
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendTargetUserId, setSendTargetUserId] = useState<string>("all");

  const sendMonthlyMut = useMutation({
    mutationFn: ({ period, userId }: { period: string; userId?: number }) =>
      apiPost("/payroll/send-monthly", { period, ...(userId ? { userId } : {}) }),
    onSuccess: (data: any) => {
      const targetLabel = sendTargetUserId === "all"
        ? (isArabic ? "جميع الموظفين" : "all employees")
        : (rawUsers ?? []).find((u: any) => String(u.id) === sendTargetUserId)?.name ?? "";
      toast({
        title: isArabic ? "✅ تم الإرسال بنجاح" : "✅ Reports sent",
        description: isArabic
          ? `تم إرسال ${data.sent ?? ""} تقرير${data.sent !== 1 ? "اً" : ""} لـ ${targetLabel} عن ${sendPeriod}`
          : `Sent ${data.sent ?? ""} report(s) to ${targetLabel} for ${sendPeriod}`,
      });
      setSendConfirmOpen(false);
    },
    onError: (err: any) => {
      const msg: string = err.message ?? "";
      if (msg === "RESEND_DOMAIN_UNVERIFIED" || msg.includes("verify a domain") || msg.includes("testing emails")) {
        toast({
          title: isArabic ? "⚠️ يجب توثيق الدومين في Resend" : "⚠️ Resend domain not verified",
          description: isArabic
            ? "الخطة المجانية تسمح فقط بالإرسال لإيميلك الشخصي. لإرسال لأي موظف: افتح resend.com/domains وأضف دومينك، ثم غيّر عنوان From في إعدادات Resend."
            : "Free plan only allows sending to your own email. To send to others: go to resend.com/domains, add your domain, then update the From address in Resend settings.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({ title: isArabic ? "فشل الإرسال" : "Send failed", description: msg, variant: "destructive" });
      }
    },
  });

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
  const [selectedPeriod, setSelectedPeriod]  = useState<string>(currentPeriod()); // kept for legacy saves
  const [notes, setNotes]                    = useState("");
  const [result, setResult]                  = useState<any | null>(null);
  const [showBreakdown, setShowBreakdown]    = useState(true);

  // Custom date range — default to FULL current month so the admin always
  // sees the same salary figure that the employee receives in their email report.
  const firstOfMonth = `${currentPeriod()}-01`;
  const endOfCurrentMonth = (() => {
    const p = currentPeriod();
    const [y, m] = p.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of month
  })();
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth);
  const [dateTo,   setDateTo]   = useState<string>(endOfCurrentMonth);

  const periods = useMemo(() => periodOptions(), []);
  const fmt = (n: number) => formatCurrency(n, currency);

  const fmtHM = (h: number) => {
    if (h <= 0) return "—";
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    if (isArabic) return hh > 0 && mm > 0 ? `${hh}س ${mm}د` : hh > 0 ? `${hh}س` : `${mm}د`;
    return hh > 0 && mm > 0 ? `${hh}h ${mm}m` : hh > 0 ? `${hh}h` : `${mm}m`;
  };

  const buildPayrollPdfOpts = (): PdfReportOptions => {
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
    return {
      appName: appName || "Pulse",
      appLogo: appLogo || undefined,
      isArabic,
      from: result.dateFrom ?? `${result.period}-01`,
      to:   result.dateTo   ?? `${result.period}-${new Date(parseInt(result.period.slice(0,4)), parseInt(result.period.slice(5,7)), 0).getDate()}`,
      employeeName: result.employeeName,
      summary: {
        workingDays: result.workingDaysInMonth ?? 0,
        presentDays: result.daysPresent ?? 0,
        absentDays: result.daysAbsent ?? 0,
        leaveDays: (result.paidLeaveDays ?? 0) + (result.unpaidLeaveDays ?? 0),
        lateDays: result.lateDays ?? 0,
        totalHours: result.totalNormalHours ?? result.totalWorkHours ?? 0,
        normalHours: result.totalNormalHours ?? result.totalWorkHours ?? 0,
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
        bonusItems: result.bonusItems ?? [],
        totalNormalHours: result.totalNormalHours ?? 0,
        workHoursPerDay: result.workHoursPerDay ?? 8,
        contractType: result.contractType ?? "monthly",
        daysPresent: result.daysPresent ?? 0,
      },
      isAdmin: true,
    };
  };

  const handlePayrollPDF = async (download: boolean) => {
    if (!result) return;
    download ? setPdfLoading(true) : setShareLoading(true);
    try {
      const opts = buildPayrollPdfOpts();
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

  const [payrollEmailDialogOpen, setPayrollEmailDialogOpen] = useState(false);

  const handlePayrollEmail = () => {
    if (!result) return;
    setPayrollEmailDialogOpen(true);
  };

  const handleSendPayrollEmail = async (to: string) => {
    const subject = isArabic
      ? `كشف راتب — ${result.employeeName} — ${result.period}`
      : `Payslip — ${result.employeeName} — ${result.period}`;
    await emailReportHTML(to, subject, buildPayrollPdfOpts());
    toast({ title: isArabic ? "✅ تم إرسال كشف الراتب" : "✅ Payslip sent" });
  };

  /* Calculate mutation */
  const calcMut = useMutation({
    mutationFn: () => apiPost("/payroll/calculate", { userId: parseInt(selectedUserId), dateFrom, dateTo }),
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

        {/* ── Send Monthly Reports Card ── */}
        <div className="bg-gradient-to-r from-blue-500/10 to-sky-500/5 border border-blue-400/30 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {isArabic ? "إرسال التقارير الشهرية للموظفين" : "Send Monthly Reports to Employees"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isArabic
                  ? "يُرسل تقرير حضور وراتب شامل عبر البريد الإلكتروني"
                  : "Sends a full attendance & payroll report by email"}
              </p>
            </div>
          </div>

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Period */}
            <div className="flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Select value={sendPeriod} onValueChange={setSendPeriod}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee picker */}
            <Select value={sendTargetUserId} onValueChange={setSendTargetUserId}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder={isArabic ? "اختر موظفاً" : "Select employee"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {isArabic ? "👥 جميع الموظفين" : "👥 All Employees"}
                </SelectItem>
                {(employees ?? []).map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setSendConfirmOpen(true)}
              disabled={sendMonthlyMut.isPending}
            >
              {sendMonthlyMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {isArabic ? "إرسال الآن" : "Send Now"}
            </Button>
          </div>
        </div>

        {/* Calculator card */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-5 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

            {/* Employee selector */}
            <div className="space-y-1 min-w-0">
              <Label>{t("employee")}</Label>

              {/* Loading */}
              {usersLoading && <InlineLoader />}

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

            {/* From date */}
            <div className="space-y-1 min-w-0">
              <Label>{isArabic ? "من تاريخ" : "From Date"}</Label>
              <div dir="ltr" className="w-full overflow-hidden">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setResult(null); }}
                  className="w-full"
                />
              </div>
            </div>

            {/* To date */}
            <div className="space-y-1 min-w-0">
              <Label>{isArabic ? "إلى تاريخ" : "To Date"}</Label>
              <div dir="ltr" className="w-full overflow-hidden">
                <Input
                  type="date"
                  value={dateTo}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => { setDateTo(e.target.value); setResult(null); }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Calculate button */}
            <div className="flex items-end min-w-0">
              <Button
                className="w-full gap-2"
                disabled={!selectedUserId || !dateFrom || !dateTo || calcMut.isPending}
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
              <StatCard label={t("base_salary")}   value={fmt(result.baseSalary)}    icon={DollarSign}   color="blue"  sub={`${result.workingDaysInMonth} ${t("working_days")}`}  onClick={() => setStatCardDetail("base")} />
              <StatCard label={t("overtime_bonus")} value={`+${fmt(result.overtimeBonus)}`} icon={TrendingUp}  color="green" sub={`${result.totalOvertimeHours}h`} onClick={() => setStatCardDetail("overtime")} />
              <StatCard label={t("total_deductions")} value={`−${fmt(result.totalDeductions)}`} icon={TrendingDown} color="red" sub={`${result.totalLateMinutes}min ${t("late")}`} onClick={() => setStatCardDetail("deductions")} />
              <StatCard label={t("net_salary")}     value={fmt(result.netSalary)}     icon={BarChart3}    color={result.netSalary >= result.baseSalary ? "green" : "amber"} onClick={() => setStatCardDetail("net")} />
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

            {/* ── ساعات العمل الفعلية (للعقد اليومي وللشهري) ── */}
            <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded-xl px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {isArabic ? "ساعات العمل الفعلية" : "Actual Work Hours"}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="tabular-nums font-bold text-blue-700 dark:text-blue-300">
                  {fmtHM(result.totalNormalHours ?? 0)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isArabic ? "من أصل" : "of"} {fmtHM(result.workHoursPerDay * result.daysPresent)} {isArabic ? "متوقع" : "expected"}
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {fmt(result.hourlyRate)}/{isArabic ? "ساعة" : "hr"}
                </span>
                {result.contractType === "daily" && (
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {isArabic ? "يومي" : "Daily"}
                  </span>
                )}
              </div>
            </div>

            {/* Detailed breakdown */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowBreakdown(o => !o)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
              >
                <span className="font-bold text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  {t("salary_breakdown")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {isArabic ? "اضغط للتفاصيل" : "Tap for details"}
                  </span>
                  {showBreakdown
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {showBreakdown && (
                <div className="border-t border-border divide-y divide-border/50">

                  {/* ══ ADDITIONS SECTION ══ */}
                  <div>
                    {/* Section header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-green-50/80 dark:bg-green-950/25">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center">
                          <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400">
                          {isArabic ? "الإضافات" : "Earnings"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                        +{fmt(result.totalAdditions)}
                      </span>
                    </div>

                    {/* Addition rows — each row clickable for full calculation detail */}
                    <div className="divide-y divide-border/40">

                      {/* Full working days */}
                      {result.fullDaysWorked > 0 && (
                        <button
                          onClick={() => setBreakdownItem("full_days")}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <CalendarRange className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{isArabic ? "أيام عمل كاملة" : "Full Working Days"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {result.fullDaysWorked} {isArabic ? "يوم" : "days"}
                                {result.contractType === "daily"
                                  ? ` · ${fmtHM(result.fullDaysWorked * result.workHoursPerDay)} × ${fmt(result.hourlyRate)}/${isArabic ? "ساعة" : "hr"}`
                                  : ` × ${fmt(result.dailyRate)}`}
                                {result.paidLeaveDays > 0 && (
                                  <span className="ms-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                    +{result.paidLeaveDays} {isArabic ? "إجازة مدفوعة" : "paid leave"}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                              +{fmt(result.fullDaysEarned ?? result.fullDaysWorked * (result.contractType === "daily" ? result.workHoursPerDay * result.hourlyRate : result.dailyRate))}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      )}

                      {/* Partial hours */}
                      {result.remainingHours > 0 && (
                        <button
                          onClick={() => setBreakdownItem("partial_hours")}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <Clock className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                {isArabic ? "ساعات عمل" : "Work Hours"}
                                {result.contractType === "daily" && result.fullDaysWorked === 0 && (
                                  <span className="ms-1.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold px-1.5 py-0.5 rounded-full">
                                    {isArabic ? "يوم غير مكتمل" : "Partial day"}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {fmtHM(result.remainingHours)} × {fmt(result.hourlyRate)}/{isArabic ? "ساعة" : "hr"}
                                {result.contractType === "daily" && (
                                  <span className="ms-1.5 text-[10px] text-amber-600">
                                    ({isArabic ? `من أصل ${fmtHM(result.workHoursPerDay)}` : `of ${fmtHM(result.workHoursPerDay)} shift`})
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                              +{fmt(result.partialHoursEarned ?? result.remainingHours * result.hourlyRate)}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      )}

                      {/* Fallback base salary (no hours recorded) */}
                      {result.fullDaysWorked === 0 && result.remainingHours === 0 && (
                        <button
                          onClick={() => setBreakdownItem("base_salary")}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <DollarSign className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{t("base_salary")}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {fmt(result.dailyRate)}/{t("date")} · {fmt(result.hourlyRate)}/{t("hour")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                              +{fmt(result.baseSalary)}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      )}

                      {/* Overtime */}
                      {result.overtimeBonus > 0 && (
                        <button
                          onClick={() => setBreakdownItem("overtime")}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                              <TrendingUp className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{isArabic ? "بدل إضافي" : "Overtime Bonus"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {fmtHM(result.totalOvertimeHours)} × {fmt(result.hourlyRate)} × 1.0
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-amber-600 tabular-nums">
                              +{fmt(result.overtimeBonus)}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      )}

                      {/* Transport allowance */}
                      {result.transportAllowance > 0 && (
                        <button
                          onClick={() => setBreakdownItem("transport")}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                              <Car className="w-4 h-4 text-sky-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{isArabic ? "بدل نقل" : "Transport Allowance"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? "بدل ثابت شهري" : "Fixed monthly"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-sky-600 tabular-nums">+{fmt(result.transportAllowance)}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      )}

                      {/* Housing allowance */}
                      {result.housingAllowance > 0 && (
                        <button
                          onClick={() => setBreakdownItem("housing")}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0">
                              <Home className="w-4 h-4 text-sky-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{isArabic ? "بدل سكن" : "Housing Allowance"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? "بدل ثابت شهري" : "Fixed monthly"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-sky-600 tabular-nums">+{fmt(result.housingAllowance)}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      )}

                      {/* Admin bonuses */}
                      {(result.bonusItems ?? []).filter((b: any) => b.type === "bonus" && b.source !== "purchase").map((b: any) => (
                        <button
                          key={b.id}
                          onClick={() => setSelectedBonusItem(b)}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                              <Gift className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{isArabic ? "مكافأة" : "Bonus"}</p>
                              {b.reason && <p className="text-xs text-muted-foreground mt-0.5">{b.reason.slice(0, 40)}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{fmt(b.amount)}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      ))}

                      {/* Purchases */}
                      {(result.bonusItems ?? []).filter((b: any) => b.source === "purchase").map((b: any) => (
                        <button
                          key={`pur-${b.id}`}
                          onClick={() => setSelectedBonusItem(b)}
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors text-start"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag className="w-4 h-4 text-teal-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{b.reason?.split(" — ")[0] ?? (isArabic ? "مشتريات" : "Purchase")}</p>
                              {b.reason?.includes(" — ") && <p className="text-xs text-muted-foreground mt-0.5">{b.reason.split(" — ").slice(1).join(" — ").slice(0, 40)}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-teal-600 dark:text-teal-400 tabular-nums">+{fmt(b.amount)}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ══ DEDUCTIONS SECTION ══ */}
                  {/* Only show if there are actual deductions */}
                  {(result.totalDeductions > 0 || (result.bonusItems ?? []).some((b: any) => b.type === "deduction")) && (
                    <div>
                      {/* Section header */}
                      <div className="flex items-center justify-between px-5 py-3 bg-red-50/80 dark:bg-red-950/25">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center">
                            <TrendingDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          </div>
                          <span className="text-sm font-bold text-red-700 dark:text-red-400">
                            {isArabic ? "الخصومات" : "Deductions"}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-red-500 tabular-nums">
                          −{fmt(result.totalDeductions)}
                        </span>
                      </div>

                      {/* Deduction rows — each clickable for full calculation detail */}
                      <div className="divide-y divide-border/40">

                        {/* Late penalty */}
                        {result.latePenalty > 0 && (
                          <button
                            onClick={() => setBreakdownItem("late")}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <Clock className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{isArabic ? "غرامة التأخير" : "Late Penalty"}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {result.totalLateMinutes} {isArabic ? "دقيقة" : "min"} × {fmt(result.hourlyRate / 60)}/{isArabic ? "د" : "min"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-red-500 tabular-nums">−{fmt(result.latePenalty)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        )}

                        {/* Unpaid leave */}
                        {result.unpaidLeaveDeduction > 0 && (
                          <button
                            onClick={() => setBreakdownItem("unpaid_leave")}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <UserX className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{isArabic ? "خصم إجازة غير مدفوعة" : "Unpaid Leave"}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {result.unpaidLeaveDays} {isArabic ? "يوم" : "days"} × {fmt(result.dailyRate)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-red-500 tabular-nums">−{fmt(result.unpaidLeaveDeduction)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        )}

                        {/* Absence */}
                        {(result.absentDeduction ?? 0) > 0 && (
                          <button
                            onClick={() => setBreakdownItem("absence")}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <X className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{isArabic ? "خصم الغياب" : "Absence Deduction"}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {result.daysAbsent} {isArabic ? "يوم" : "days"} × {fmt(result.dailyRate)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-red-500 tabular-nums">−{fmt(result.absentDeduction ?? 0)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        )}

                        {/* Salary advance deductions */}
                        {(result.bonusItems ?? []).filter((b: any) => b.type === "deduction" && b.source === "advance").map((b: any) => (
                          <button
                            key={`adv-${b.id}`}
                            onClick={() => setSelectedBonusItem(b)}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors text-start"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                <Minus className="w-4 h-4 text-orange-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{isArabic ? "خصم سلفة" : "Salary Advance"}</p>
                                {b.reason && <p className="text-xs text-muted-foreground mt-0.5">{b.reason.slice(0, 50)}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-orange-500 tabular-nums">−{fmt(b.amount)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        ))}

                        {/* Admin deductions */}
                        {(result.bonusItems ?? []).filter((b: any) => b.type === "deduction" && b.source !== "advance").map((b: any) => (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBonusItem(b)}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors text-start"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <Minus className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{isArabic ? "خصم إداري" : "Admin Deduction"}</p>
                                {b.reason && <p className="text-xs text-muted-foreground mt-0.5">{b.reason.slice(0, 40)}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-red-500 tabular-nums">−{fmt(b.amount)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ══ NET SALARY FOOTER ══ */}
                  <div className={`p-5 ${result.netSalary >= result.baseSalary ? "bg-green-50/60 dark:bg-green-950/20" : "bg-amber-50/60 dark:bg-amber-950/20"}`}>
                    {/* Equation strip */}
                    <div className={`flex items-center justify-center gap-2 text-xs mb-4 flex-wrap px-2 py-2 rounded-lg ${result.netSalary >= result.baseSalary ? "bg-green-100/60 dark:bg-green-900/20" : "bg-amber-100/60 dark:bg-amber-900/20"}`}>
                      <span className="flex items-center gap-1 font-semibold text-green-700 dark:text-green-400">
                        <TrendingUp className="w-3 h-3" />
                        {fmt(result.totalAdditions)}
                      </span>
                      <span className="text-muted-foreground font-bold">−</span>
                      <span className="flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
                        <TrendingDown className="w-3 h-3" />
                        {fmt(result.totalDeductions)}
                      </span>
                      <span className="text-muted-foreground font-bold">=</span>
                      <span className={`font-black text-sm ${result.netSalary >= result.baseSalary ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {fmt(result.netSalary)}
                      </span>
                    </div>

                    {/* Net salary big display */}
                    <div className={`rounded-xl border-2 px-5 py-4 flex items-center justify-between ${result.netSalary >= result.baseSalary ? "border-green-400/50 dark:border-green-700/50 bg-white dark:bg-green-950/30" : "border-amber-400/50 dark:border-amber-700/50 bg-white dark:bg-amber-950/30"}`}>
                      <div>
                        <p className="text-xs text-muted-foreground">{isArabic ? "صافي الراتب" : "Net Salary"}</p>
                        <p className={`text-[10px] mt-0.5 ${result.netSalary >= result.baseSalary ? "text-green-600 dark:text-green-400" : "text-amber-600"}`}>
                          {result.netSalary >= result.baseSalary
                            ? (isArabic ? "بعد الإضافات والخصومات" : "After additions & deductions")
                            : (isArabic ? "بعد الخصومات" : "After deductions")}
                        </p>
                      </div>
                      <p className={`text-3xl font-black tabular-nums ${result.netSalary >= result.baseSalary ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {fmt(result.netSalary)}
                      </p>
                    </div>
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

      {/* ══ Breakdown Row Detail Dialog ══ */}
      <Dialog open={breakdownItem !== null} onOpenChange={v => { if (!v) setBreakdownItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              {breakdownItem === "full_days"     && <><CalendarRange className="w-4 h-4 text-green-600" />{isArabic ? "تفاصيل أيام العمل" : "Working Days Detail"}</>}
              {breakdownItem === "partial_hours" && <><Clock className="w-4 h-4 text-green-600" />{isArabic ? "تفاصيل الساعات الجزئية" : "Partial Hours Detail"}</>}
              {breakdownItem === "base_salary"   && <><DollarSign className="w-4 h-4 text-green-600" />{isArabic ? "تفاصيل الراتب الأساسي" : "Base Salary Detail"}</>}
              {breakdownItem === "overtime"      && <><TrendingUp className="w-4 h-4 text-amber-600" />{isArabic ? "تفاصيل بدل الإضافي" : "Overtime Detail"}</>}
              {breakdownItem === "transport"     && <><Car className="w-4 h-4 text-sky-600" />{isArabic ? "بدل النقل" : "Transport Allowance"}</>}
              {breakdownItem === "housing"       && <><Home className="w-4 h-4 text-sky-600" />{isArabic ? "بدل السكن" : "Housing Allowance"}</>}
              {breakdownItem === "late"          && <><Clock className="w-4 h-4 text-red-600" />{isArabic ? "تفاصيل غرامة التأخير" : "Late Penalty Detail"}</>}
              {breakdownItem === "unpaid_leave"  && <><UserX className="w-4 h-4 text-red-600" />{isArabic ? "تفاصيل الإجازة غير المدفوعة" : "Unpaid Leave Detail"}</>}
              {breakdownItem === "absence"       && <><X className="w-4 h-4 text-red-600" />{isArabic ? "تفاصيل خصم الغياب" : "Absence Deduction Detail"}</>}
            </DialogTitle>
          </DialogHeader>

          {/* ─── أيام عمل كاملة + إجازة مدفوعة ─── */}
          {result && breakdownItem === "full_days" && (
            <div className="space-y-3 pb-1">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">+{fmt(result.fullDaysEarned ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "إجمالي مكتسب أيام العمل" : "Total working days earned"}</p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden text-sm divide-y divide-border">
                {result.fullDaysWorked > 0 && (
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                      {isArabic ? "أيام الحضور الكاملة" : "Full attendance days"}
                    </p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "عدد الأيام" : "Days"}</span>
                      <span className="font-semibold">{result.fullDaysWorked} {isArabic ? "يوم" : "days"}</span>
                    </div>
                    {result.contractType === "daily" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{isArabic ? "ساعات الوردية" : "Shift hours"}</span>
                          <span className="font-semibold">{fmtHM(result.workHoursPerDay)}/{isArabic ? "يوم" : "day"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{isArabic ? "إجمالي الساعات" : "Total hours"}</span>
                          <span className="font-semibold">{fmtHM(result.fullDaysWorked * result.workHoursPerDay)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{isArabic ? "× معدل الساعة" : "× Hourly rate"}</span>
                          <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 font-bold border-t border-border pt-1.5">
                          <span>{fmtHM(result.fullDaysWorked * result.workHoursPerDay)} × {fmt(result.hourlyRate)}</span>
                          <span>= {fmt(result.fullDaysWorked * result.workHoursPerDay * result.hourlyRate)}</span>
                        </div>
                      </>
                    )}
                    {result.contractType !== "daily" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{isArabic ? "× معدل اليوم الفعلي" : "× Effective daily rate"}</span>
                          <span className="font-semibold">{fmt(result.dailyRate)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 font-bold border-t border-border pt-1.5">
                          <span>{result.fullDaysWorked} × {fmt(result.dailyRate)}</span>
                          <span>= {fmt(result.fullDaysWorked * result.dailyRate)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {result.paidLeaveDays > 0 && (
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                      {isArabic ? "الإجازة المدفوعة" : "Paid leave"}
                    </p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "أيام الإجازة المدفوعة" : "Paid leave days"}</span>
                      <span className="font-semibold">{result.paidLeaveDays} {isArabic ? "يوم" : "days"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "ساعات الإجازة المعتمدة" : "Approved leave hours"}</span>
                      <span className="font-semibold">{fmtHM(result.paidLeaveHours)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "× معدل الساعة" : "× Hourly rate"}</span>
                      <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-bold border-t border-border pt-1.5">
                      <span>{fmtHM(result.paidLeaveHours)} × {fmt(result.hourlyRate)}</span>
                      <span>= {fmt(result.paidLeaveHours * result.hourlyRate)}</span>
                    </div>
                  </div>
                )}
                <div className="px-4 py-3 flex justify-between font-black text-base text-green-600 bg-green-50/60 dark:bg-green-950/20">
                  <span>{isArabic ? "المجموع" : "Total"}</span>
                  <span>+{fmt(result.fullDaysEarned ?? 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── ساعات جزئية / يوم غير مكتمل ─── */}
          {result && breakdownItem === "partial_hours" && (
            <div className="space-y-3 pb-1">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">+{fmt(result.partialHoursEarned ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isArabic ? "مكتسب ساعات العمل" : "Work hours earned"}
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden text-sm divide-y divide-border">
                <div className="px-4 py-3 space-y-1.5">
                  {result.contractType === "daily" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isArabic ? "ساعات الوردية الكاملة" : "Full shift hours"}</span>
                        <span className="font-semibold">{fmtHM(result.workHoursPerDay)}</span>
                      </div>
                      <div className="flex justify-between text-amber-600">
                        <span className="text-muted-foreground">{isArabic ? "ساعات العمل الفعلية" : "Actual hours worked"}</span>
                        <span className="font-semibold text-amber-600">{fmtHM(result.remainingHours)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{isArabic ? "نسبة الإنجاز" : "Completion"}</span>
                        <span>{result.workHoursPerDay > 0 ? Math.round((result.remainingHours / result.workHoursPerDay) * 100) : 0}%</span>
                      </div>
                    </>
                  )}
                  {result.contractType !== "daily" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isArabic ? "الوقت الجزئي المتبقي" : "Remaining partial time"}</span>
                      <span className="font-semibold">{fmtHM(result.remainingHours)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "× معدل الساعة" : "× Hourly rate"}</span>
                    <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                  </div>
                </div>
                <div className="px-4 py-3 flex justify-between font-black text-base text-green-600 bg-green-50/60 dark:bg-green-950/20">
                  <span>{fmtHM(result.remainingHours)} × {fmt(result.hourlyRate)}</span>
                  <span>= +{fmt(result.partialHoursEarned ?? 0)}</span>
                </div>
              </div>
              {result.contractType === "daily" && result.fullDaysWorked === 0 && (
                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-lg px-3 py-2.5">
                  <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {isArabic
                      ? `الموظف لم يكمل وردية كاملة (${fmtHM(result.workHoursPerDay)}). تم احتساب ${fmtHM(result.remainingHours)} فقط.`
                      : `Employee did not complete a full shift (${fmtHM(result.workHoursPerDay)}). Only ${fmtHM(result.remainingHours)} counted.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── راتب أساسي (fallback) ─── */}
          {result && breakdownItem === "base_salary" && (
            <div className="space-y-3 pb-1">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">+{fmt(result.baseSalary)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "الراتب الأساسي الشهري" : "Monthly base salary"}</p>
              </div>
              <div className="bg-muted/30 rounded-xl text-sm divide-y divide-border overflow-hidden">
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "الراتب الشهري" : "Monthly salary"}</span>
                    <span className="font-semibold">{fmt(result.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "أيام العمل بالشهر" : "Working days/month"}</span>
                    <span className="font-semibold">{result.workingDaysInMonth} {isArabic ? "يوم" : "days"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "معدل اليوم" : "Daily rate"}</span>
                    <span className="font-semibold">{fmt(result.dailyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "معدل الساعة" : "Hourly rate"}</span>
                    <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "ساعات العمل اليومية" : "Work hours/day"}</span>
                    <span className="font-semibold">{result.workHoursPerDay}h</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── بدل إضافي ─── */}
          {result && breakdownItem === "overtime" && (
            <div className="space-y-3 pb-1">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">+{fmt(result.overtimeBonus)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "مكافأة الإضافي" : "Overtime bonus"}</p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden text-sm divide-y divide-border">
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "ساعات الإضافي المعتمدة" : "Approved OT hours"}</span>
                    <span className="font-semibold text-amber-600">{fmtHM(result.totalOvertimeHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "معدل الساعة الأساسي" : "Base hourly rate"}</span>
                    <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "معامل الإضافي" : "OT multiplier"}</span>
                    <span className="font-bold text-amber-600">× 1.0</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="text-muted-foreground">{isArabic ? "معدل ساعة الإضافي الفعلي" : "Effective OT rate/hr"}</span>
                    <span className="font-semibold">{fmt(result.hourlyRate * 1.0)}</span>
                  </div>
                </div>
                <div className="px-4 py-3 flex justify-between font-black text-base text-amber-600 bg-amber-50/60 dark:bg-amber-950/20">
                  <span>{fmtHM(result.totalOvertimeHours)} × {fmt(result.hourlyRate * 1.0)}</span>
                  <span>= +{fmt(result.overtimeBonus)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── بدل نقل أو سكن ─── */}
          {result && (breakdownItem === "transport" || breakdownItem === "housing") && (
            <div className="space-y-3 pb-1">
              <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-sky-600">
                  +{fmt(breakdownItem === "transport" ? result.transportAllowance : result.housingAllowance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {breakdownItem === "transport"
                    ? (isArabic ? "بدل النقل الشهري" : "Monthly transport allowance")
                    : (isArabic ? "بدل السكن الشهري" : "Monthly housing allowance")}
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl text-sm divide-y divide-border overflow-hidden">
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "نوع البدل" : "Allowance type"}</span>
                    <span className="font-semibold">{isArabic ? "ثابت شهري" : "Fixed monthly"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "المبلغ الشهري" : "Monthly amount"}</span>
                    <span className="font-bold text-sky-600">
                      {fmt(breakdownItem === "transport" ? result.transportAllowance : result.housingAllowance)}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {isArabic
                      ? "يُضاف هذا البدل الثابت للراتب الشهري حسب شروط العقد"
                      : "This fixed allowance is added to the monthly salary per contract terms"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── غرامة التأخير ─── */}
          {result && breakdownItem === "late" && (
            <div className="space-y-3 pb-1">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">−{fmt(result.latePenalty)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "غرامة التأخير" : "Late penalty"}</p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden text-sm divide-y divide-border">
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "إجمالي دقائق التأخير" : "Total late minutes"}</span>
                    <span className="font-semibold text-red-500">{result.totalLateMinutes} {isArabic ? "دقيقة" : "min"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "معدل الساعة" : "Hourly rate"}</span>
                    <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "÷ 60 دقيقة" : "÷ 60 minutes"}</span>
                    <span className="font-semibold text-red-500">{fmt(result.hourlyRate / 60)}/{isArabic ? "دقيقة" : "min"}</span>
                  </div>
                </div>
                <div className="px-4 py-3 flex justify-between font-black text-base text-red-600 bg-red-50/60 dark:bg-red-950/20">
                  <span>{result.totalLateMinutes}{isArabic ? "د" : "m"} × {fmt(result.hourlyRate / 60)}</span>
                  <span>= −{fmt(result.latePenalty)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {isArabic ? "📋 راجع سجل الحضور أدناه لتفاصيل التأخير يومياً" : "📋 See the attendance log below for daily late details"}
              </p>
            </div>
          )}

          {/* ─── خصم إجازة غير مدفوعة ─── */}
          {result && breakdownItem === "unpaid_leave" && (
            <div className="space-y-3 pb-1">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">−{fmt(result.unpaidLeaveDeduction)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "خصم الإجازة غير المدفوعة" : "Unpaid leave deduction"}</p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden text-sm divide-y divide-border">
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "أيام الإجازة غير المدفوعة" : "Unpaid leave days"}</span>
                    <span className="font-semibold text-red-500">{result.unpaidLeaveDays} {isArabic ? "يوم" : "days"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "× معدل اليوم" : "× Daily rate"}</span>
                    <span className="font-semibold">{fmt(result.dailyRate)}</span>
                  </div>
                </div>
                <div className="px-4 py-3 flex justify-between font-black text-base text-red-600 bg-red-50/60 dark:bg-red-950/20">
                  <span>{result.unpaidLeaveDays} × {fmt(result.dailyRate)}</span>
                  <span>= −{fmt(result.unpaidLeaveDeduction)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── خصم الغياب ─── */}
          {result && breakdownItem === "absence" && (
            <div className="space-y-3 pb-1">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">−{fmt(result.absentDeduction ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "خصم الغياب" : "Absence deduction"}</p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden text-sm divide-y divide-border">
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "أيام الغياب" : "Absent days"}</span>
                    <span className="font-semibold text-red-500">{result.daysAbsent} {isArabic ? "يوم" : "days"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "إجمالي أيام العمل بالشهر" : "Working days in month"}</span>
                    <span className="font-semibold">{result.workingDaysInMonth} {isArabic ? "يوم" : "days"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isArabic ? "× معدل اليوم" : "× Daily rate"}</span>
                    <span className="font-semibold">{fmt(result.dailyRate)}</span>
                  </div>
                </div>
                <div className="px-4 py-3 flex justify-between font-black text-base text-red-600 bg-red-50/60 dark:bg-red-950/20">
                  <span>{result.daysAbsent} × {fmt(result.dailyRate)}</span>
                  <span>= −{fmt(result.absentDeduction ?? 0)}</span>
                </div>
              </div>
            </div>
          )}

          <Button className="w-full mt-1" size="sm" variant="outline" onClick={() => setBreakdownItem(null)}>
            {isArabic ? "إغلاق" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Stat Card Detail Dialog ── */}
      <Dialog open={statCardDetail !== null} onOpenChange={v => { if (!v) setStatCardDetail(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {statCardDetail === "base"       && (isArabic ? "تفاصيل الراتب الأساسي"    : "Base Salary Details")}
              {statCardDetail === "overtime"   && (isArabic ? "تفاصيل مكافأة الإضافي"   : "Overtime Bonus Details")}
              {statCardDetail === "deductions" && (isArabic ? "تفاصيل الخصومات"          : "Deductions Breakdown")}
              {statCardDetail === "net"        && (isArabic ? "ملخص صافي الراتب"         : "Net Salary Summary")}
            </DialogTitle>
          </DialogHeader>
          {result && statCardDetail === "base" && (
            <div className="space-y-3 pb-1">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{fmt(result.baseSalary)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "الراتب الأساسي" : "Base Salary"}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isArabic ? "أيام العمل بالشهر" : "Working days/month"}</span>
                  <span className="font-semibold">{result.workingDaysInMonth} {isArabic ? "يوم" : "days"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isArabic ? "معدل اليوم" : "Daily rate"}</span>
                  <span className="font-semibold">{fmt(result.dailyRate)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isArabic ? "معدل الساعة" : "Hourly rate"}</span>
                  <span className="font-semibold">{fmt(result.hourlyRate)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">{isArabic ? "ساعات عمل/يوم" : "Hours/day"}</span>
                  <span className="font-semibold">{result.workHoursPerDay}h</span>
                </div>
              </div>
            </div>
          )}
          {result && statCardDetail === "overtime" && (
            <div className="space-y-3 pb-1">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">+{fmt(result.overtimeBonus)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "مكافأة الإضافي" : "Overtime Bonus"}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isArabic ? "إجمالي ساعات الإضافي" : "Total overtime hours"}</span>
                  <span className="font-semibold text-green-600">{result.totalOvertimeHours}h</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isArabic ? "معدل الساعة الإضافية" : "Overtime rate (×1.0)"}</span>
                  <span className="font-semibold">{fmt(result.hourlyRate * 1.0)}/h</span>
                </div>
                <div className="flex justify-between py-2 text-xs text-muted-foreground">
                  <span>{result.totalOvertimeHours}h × {fmt(result.hourlyRate)} × 1.0</span>
                  <span className="font-bold text-green-600">= {fmt(result.overtimeBonus)}</span>
                </div>
              </div>
            </div>
          )}
          {result && statCardDetail === "deductions" && (
            <div className="space-y-3 pb-1">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">−{fmt(result.totalDeductions)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "إجمالي الخصومات" : "Total Deductions"}</p>
              </div>
              <div className="space-y-1 text-sm">
                {result.latePenalty > 0 && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <div>
                      <p>{isArabic ? "خصم التأخر" : "Late penalty"}</p>
                      <p className="text-xs text-muted-foreground">{result.totalLateMinutes} {isArabic ? "دقيقة" : "min"}</p>
                    </div>
                    <span className="font-semibold text-red-500">−{fmt(result.latePenalty)}</span>
                  </div>
                )}
                {result.unpaidLeaveDeduction > 0 && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <div>
                      <p>{isArabic ? "إجازة غير مدفوعة" : "Unpaid leave"}</p>
                      <p className="text-xs text-muted-foreground">{result.unpaidLeaveDays} {isArabic ? "يوم" : "days"}</p>
                    </div>
                    <span className="font-semibold text-red-500">−{fmt(result.unpaidLeaveDeduction)}</span>
                  </div>
                )}
                {result.absenceDeduction > 0 && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <div>
                      <p>{isArabic ? "خصم الغياب" : "Absence deduction"}</p>
                      <p className="text-xs text-muted-foreground">{result.daysAbsent} {isArabic ? "يوم" : "days"}</p>
                    </div>
                    <span className="font-semibold text-red-500">−{fmt(result.absenceDeduction)}</span>
                  </div>
                )}
                {(result.bonusItems ?? []).filter((b: any) => b.type !== "bonus").map((b: any) => (
                  <div key={b.id} className="flex justify-between py-2 border-b border-border">
                    <div>
                      <p>{isArabic ? "خصم إداري" : "Admin deduction"}</p>
                      {b.reason && <p className="text-xs text-muted-foreground">{b.reason.slice(0, 40)}</p>}
                    </div>
                    <span className="font-semibold text-red-500">−{fmt(b.amount)}</span>
                  </div>
                ))}
                {(result.salaryAdvanceDeduction ?? 0) > 0 && (
                  <div className="flex justify-between py-2">
                    <p>{isArabic ? "سلفة مستحقة" : "Salary advance"}</p>
                    <span className="font-semibold text-red-500">−{fmt(result.salaryAdvanceDeduction)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {result && statCardDetail === "net" && (
            <div className="space-y-3 pb-1">
              <div className={`rounded-xl p-4 text-center ${result.netSalary >= result.baseSalary ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                <p className={`text-2xl font-bold ${result.netSalary >= result.baseSalary ? "text-green-600" : "text-amber-600"}`}>{fmt(result.netSalary)}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "صافي الراتب" : "Net Salary"}</p>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">{isArabic ? "الراتب الأساسي" : "Base salary"}</span>
                  <span className="font-semibold">{fmt(result.baseSalary)}</span>
                </div>
                {result.overtimeBonus > 0 && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{isArabic ? "+ مكافأة إضافي" : "+ Overtime bonus"}</span>
                    <span className="font-semibold text-green-600">+{fmt(result.overtimeBonus)}</span>
                  </div>
                )}
                {(result.bonusItems ?? []).filter((b: any) => b.type === "bonus").map((b: any) => (
                  <div key={b.id} className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">+ {isArabic ? "مكافأة" : "Bonus"}</span>
                    <span className="font-semibold text-green-600">+{fmt(b.amount)}</span>
                  </div>
                ))}
                {result.totalDeductions > 0 && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{isArabic ? "− إجمالي الخصومات" : "− Total deductions"}</span>
                    <span className="font-semibold text-red-500">−{fmt(result.totalDeductions)}</span>
                  </div>
                )}
                <div className={`flex justify-between py-2 font-bold text-base ${result.netSalary >= result.baseSalary ? "text-green-600" : "text-amber-600"}`}>
                  <span>{isArabic ? "= صافي الراتب" : "= Net salary"}</span>
                  <span>{fmt(result.netSalary)}</span>
                </div>
              </div>
            </div>
          )}
          <Button className="w-full mt-1" size="sm" variant="outline" onClick={() => setStatCardDetail(null)}>
            {isArabic ? "إغلاق" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Send Monthly Reports Confirmation Dialog ── */}
      <Dialog open={sendConfirmOpen} onOpenChange={v => { if (!v && !sendMonthlyMut.isPending) setSendConfirmOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Send className="w-5 h-5 flex-shrink-0" />
              {isArabic ? "تأكيد إرسال التقارير" : "Confirm Send Reports"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl px-4 py-3 text-center space-y-1.5">
              <p className="text-sm font-semibold">
                {sendTargetUserId === "all"
                  ? (isArabic ? "سيتم إرسال تقرير شامل لجميع الموظفين" : "A full report will be sent to every employee")
                  : (isArabic ? "سيتم إرسال تقرير لـ:" : "A report will be sent to:")}
              </p>
              {sendTargetUserId !== "all" && (
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {(rawUsers ?? []).find((u: any) => String(u.id) === sendTargetUserId)?.name ?? "—"}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {isArabic ? "الشهر:" : "Period:"} <span className="font-medium text-foreground">{sendPeriod}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {sendTargetUserId === "all"
                ? (isArabic
                    ? "سيصل كل موظف بريداً إلكترونياً يحتوي على ملخص حضوره وراتبه."
                    : "Each employee will receive an email with their attendance & salary summary.")
                : (isArabic
                    ? "سيصل الموظف بريداً إلكترونياً يحتوي على ملخص حضوره وراتبه."
                    : "The employee will receive an email with their attendance & salary summary.")}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSendConfirmOpen(false)}
              disabled={sendMonthlyMut.isPending}
            >
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => sendMonthlyMut.mutate({
                period: sendPeriod,
                userId: sendTargetUserId !== "all" ? parseInt(sendTargetUserId) : undefined,
              })}
              disabled={sendMonthlyMut.isPending}
            >
              {sendMonthlyMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              {isArabic ? "إرسال الآن" : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <EmailReportDialog
        open={payrollEmailDialogOpen}
        onOpenChange={setPayrollEmailDialogOpen}
        defaultEmail={selectedEmployee?.email}
        isArabic={isArabic}
        onSend={handleSendPayrollEmail}
      />
    </Layout>
  );
}
