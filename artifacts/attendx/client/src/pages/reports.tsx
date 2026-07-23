import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useGetAttendanceReport, useListUsers, useGetMe, getGetAttendanceReportQueryKey, getGetMeQueryKey } from "@/lib/api-client/index";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineLoader } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart3, Clock, TrendingUp, CalendarCheck, CalendarX,
  Briefcase, Timer, FileDown, Sheet, Trash2, Loader2,
  AlertTriangle, Palmtree, CheckCircle2, Printer, FileText, Share2, Mail,
  DollarSign, TrendingDown, Wallet, ChevronDown, ChevronUp, Pencil, Check,
  Award, Banknote, ExternalLink
} from "lucide-react";
import { format, subDays } from "date-fns";
import { exportCSV, exportExcel } from "@/lib/export";
import { exportProfessionalPDF, shareOrSavePDF, emailReportHTML } from "@/lib/pdf-export";
import { EmailReportDialog } from "@/components/EmailReportDialog";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { Link } from "wouter";

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { appName, appLogo } = useAppConfig();
  const lang = i18n.language;
  const isArabic = lang === "ar";

  const today = format(new Date(), "yyyy-MM-dd");
  const monthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [userId, setUserId] = useState<string>("all");
  const [submitted, setSubmitted] = useState({ from: monthAgo, to: today, userId: "all" });

  const [confirmRec, setConfirmRec] = useState<{ id: number; date: string; userName?: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<"selected" | "all" | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState<any | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollErr, setPayrollErr] = useState<string | null>(null);
  const [payrollExpanded, setPayrollExpanded] = useState(true);
  /** Which stat card was clicked — opens a detail breakdown dialog */
  const [cardDetail, setCardDetail] = useState<"hours" | "present" | "absent" | "overtime" | "late" | "leave" | "working" | null>(null);

  /* ── Salary setup dialog ─────────────────────────────── */
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");
  const [hoursInput, setHoursInput] = useState("8");

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: users } = useListUsers(undefined, { query: { enabled: me?.role === "admin" || me?.role === "manager" } as any });

  const isAdmin = me?.role === "admin" || me?.role === "manager";

  // ── Auto-fetch payroll whenever report data arrives ─────────────────────
  const queryParams: any = { from: submitted.from, to: submitted.to };
  if (isAdmin && submitted.userId !== "all") queryParams.userId = parseInt(submitted.userId);

  const { data: report, isLoading } = useGetAttendanceReport(queryParams, {
    query: { queryKey: getGetAttendanceReportQueryKey(queryParams) }
  });

  useEffect(() => {
    if (!me || !report) { setPayrollSummary(null); setPayrollErr(null); return; }
    const uid = !isAdmin ? me.id : (submitted.userId !== "all" ? parseInt(submitted.userId) : null);
    if (!uid) { setPayrollSummary(null); setPayrollErr(null); return; }
    // Use the TO date's month so the payroll period matches where the employee's
    // records actually are (e.g. from=Jun-10 to=Jul-10 → period "2026-07").
    const period = submitted.to.slice(0, 7);
    setPayrollLoading(true);
    setPayrollErr(null);
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(apiUrl("/api/payroll/calculate"), {
      method: "POST", headers,
      body: JSON.stringify({ userId: uid, period }),
    })
      .then(r => r.json().then(j => ({ ok: r.ok, json: j })))
      .then(({ ok, json }) => {
        if (ok) { setPayrollSummary(json); setPayrollErr(null); }
        else { setPayrollSummary(null); setPayrollErr(json?.error ?? (isArabic ? t("no_salary_set2") : "No salary configured for this employee.")); }
      })
      .catch(() => { setPayrollSummary(null); setPayrollErr(isArabic ? t("cannot_fetch_salary") : "Could not load payroll data."); })
      .finally(() => setPayrollLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, me?.id, submitted.userId, submitted.to]);

  const attendanceRecords = (report?.records ?? []).filter((r: any) => !r.isLeave);
  const allIds: number[] = attendanceRecords.map((r: any) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id: number) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleRow = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/attendance/${id}`), {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetAttendanceReportQueryKey(queryParams) });
      setConfirmRec(null);
      toast({ title: isArabic ? t("record_deleted") : "Record deleted" });
    },
    onError: () => toast({ title: t("failed"), variant: "destructive" }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(apiUrl("/api/attendance/bulk"), {
        method: "DELETE",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: getGetAttendanceReportQueryKey(queryParams) });
      setConfirmBulk(null);
      setSelectedIds(new Set());
      toast({ title: isArabic ? `تم حذف ${data.deleted} سجل` : `Deleted ${data.deleted} records` });
    },
    onError: () => toast({ title: t("failed"), variant: "destructive" }),
  });

  /* ── Save salary mutation ──────────────────────────────── */
  const saveSalaryMut = useMutation({
    mutationFn: async ({ uid, salary, hours }: { uid: number; salary: number; hours: number }) => {
      const res = await fetch(apiUrl(`/api/users/${uid}`), {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ salary, workHoursPerDay: hours }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setSalaryDialogOpen(false);
      toast({ title: isArabic ? t("salary_saved_success") : "Salary saved ✓" });
      /* Re-trigger payroll calculation */
      const uid = !isAdmin ? me?.id : (submitted.userId !== "all" ? parseInt(submitted.userId) : null);
      if (!uid) return;
      const period = submitted.to.slice(0, 7);
      setPayrollLoading(true);
      setPayrollErr(null);
      const token = localStorage.getItem("auth_token");
      fetch(apiUrl("/api/payroll/calculate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: uid, period }),
      })
        .then(r => r.json().then(j => ({ ok: r.ok, json: j })))
        .then(({ ok, json }) => {
          if (ok) { setPayrollSummary(json); setPayrollErr(null); }
          else { setPayrollSummary(null); setPayrollErr(json?.error ?? "Error"); }
        })
        .catch(() => { setPayrollSummary(null); setPayrollErr("Could not load payroll data."); })
        .finally(() => setPayrollLoading(false));
    },
    onError: (err: any) => toast({ title: err.message ?? t("failed"), variant: "destructive" }),
  });

  const openSalaryDialog = () => {
    setSalaryInput(payrollSummary?.baseSalary ? String(payrollSummary.baseSalary) : "");
    setHoursInput(payrollSummary?.workHoursPerDay ? String(payrollSummary.workHoursPerDay) : "8");
    setSalaryDialogOpen(true);
  };

  const handleSalaryConfirm = () => {
    const uid = !isAdmin ? me?.id : (submitted.userId !== "all" ? parseInt(submitted.userId) : null);
    if (!uid) return;
    const salary = parseFloat(salaryInput);
    const hours = parseFloat(hoursInput);
    if (!salary || salary <= 0) { toast({ title: isArabic ? t("enter_valid_salary") : "Enter a valid salary", variant: "destructive" }); return; }
    if (!hours || hours <= 0 || hours > 24) { toast({ title: isArabic ? t("enter_valid_hours") : "Enter valid work hours", variant: "destructive" }); return; }
    saveSalaryMut.mutate({ uid, salary, hours });
  };

  const handleBulkConfirm = () => {
    if (confirmBulk === "all") bulkDeleteMut.mutate(allIds);
    else if (confirmBulk === "selected") bulkDeleteMut.mutate(Array.from(selectedIds));
  };

  const handleFilter = () => {
    setSelectedIds(new Set());
    setSubmitted({ from, to, userId });
  };

  // ── Formatters ─────────────────────────────────────────────────────────
  const fmtTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const fmtNum = (n: number, dec = 1) =>
    n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const fmtHM = (decimalHours: number) => {
    if (decimalHours <= 0) return "—";
    const total = Math.round(decimalHours * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (isArabic) return h > 0 && m > 0 ? `${h}س ${m}د` : h > 0 ? `${h}س` : `${m}د`;
    return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
  };

  const fmtLate = (minutes: number) => {
    if (!minutes || minutes <= 0) return null;
    if (isArabic) return minutes >= 60 ? `${Math.floor(minutes / 60)}س ${minutes % 60}د` : `${minutes}د`;
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  };

  const getRowHours = (rec: any): number => {
    if (rec.isLeave) return 0;
    const normal = rec.normalHours ?? Math.min(rec.hoursWorked ?? 0, 8);
    const ot = rec.overtimeCalc ?? rec.overtime ?? 0;
    return normal + ot;
  };

  const translateStatus = (s: string) => {
    const map: Record<string, string> = {
      present: isArabic ? t("present_label2") : t("present"),
      late: isArabic ? t("late_label2") : t("late"),
      absent: isArabic ? t("absent_label2") : t("absent"),
      on_leave: isArabic ? t("leave_short") : t("leave"),
      early_leave: isArabic ? t("early_leave2") : "Early Leave",
    };
    return map[s] ?? s;
  };

  const translateLeaveType = (type: string) => {
    const map: Record<string, string> = {
      annual:    isArabic ? t("annual_label")       : "Annual",
      sick:      isArabic ? t("sick_label2")       : "Sick",
      unpaid:    isArabic ? t("unpaid_label")   : "Unpaid",
      emergency: isArabic ? t("emergency_label2")       : "Emergency",
      maternity: isArabic ? t("maternity_leave")       : "Maternity",
      paternity: isArabic ? t("paternity_leave")        : "Paternity",
      casual:    isArabic ? t("style_casual")       : "Casual",
    };
    return map[type?.toLowerCase()] ?? type;
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "present") return "default";
    if (s === "late") return "secondary";
    if (s === "absent") return "destructive";
    return "outline";
  };

  // ── Export helpers ──────────────────────────────────────────────────────
  const buildExportLabels = () => ({
    date: t("date"), employee: t("employee"), location: t("location"),
    checkIn: t("check_in"), checkOut: t("check_out"),
    normalHours: t("normal_hours"), overtime: t("overtime_short"),
    status: t("status"), summaryTitle: t("summary_title"),
    from: t("from"), to: t("to"), workingDays: t("working_days"),
    presentDays: t("present_days"), absentDays: t("absent_days"),
    leaveDays: t("total_leaves"), totalHours: t("total_hours"),
    normalHoursLabel: t("normal_hours"), overtimeLabel: t("overtime_h"),
    expectedHours: t("expected_hours"), recordsSheet: t("records_sheet"),
    summarySheet: t("summary_sheet"),
  });

  const buildExportRecords = () =>
    (report?.records ?? []).map((rec: any) => ({
      date: rec.isLeave ? `${rec.leaveStartDate} → ${rec.leaveEndDate}` : rec.date,
      employee: rec.userName,
      location: rec.locationName ?? "",
      checkIn: rec.checkIn ? fmtTime(rec.checkIn) : "—",
      checkOut: rec.checkOut ? fmtTime(rec.checkOut) : "—",
      normalHours: rec.isLeave ? `${rec.leaveTotalDays}d leave` : fmtNum(rec.normalHours ?? 0, 2),
      overtime: rec.isLeave ? "—" : fmtNum(rec.overtimeCalc ?? 0, 2),
      status: rec.isLeave ? `Leave: ${translateLeaveType(rec.leaveType)}` : translateStatus(rec.status),
    }));

  const buildExportSummary = () => ({
    from: submitted.from, to: submitted.to,
    workingDays: summary?.workingDays ?? 0,
    presentDays: summary?.presentDays ?? 0,
    absentDays: summary?.absentDays ?? 0,
    leaveDays: summary?.leaveDays ?? 0,
    totalHours: summary?.totalHours ?? 0,
    normalHours: summary?.normalHours ?? 0,
    overtime: summary?.overtime ?? 0,
    expectedHours: summary?.expectedHours ?? 0,
  });

  const handleExportCSV   = () => report && exportCSV(buildExportRecords(), buildExportSummary(), isAdmin, buildExportLabels());
  const handleExportExcel = () => report && exportExcel(buildExportRecords(), buildExportSummary(), isAdmin, buildExportLabels());

  const summary = report?.summary as any;

  // ── Bonuses & Advances Report ───────────────────────────────────────────
  const bonusReportParams: any = {};
  if (isAdmin && submitted.userId !== "all") bonusReportParams.userId = submitted.userId;
  if (submitted.to) bonusReportParams.period = submitted.to.slice(0, 7);

  const { data: bonusReport } = useQuery<{ bonuses: any[]; advances: any[] }>({
    queryKey: ["report-bonuses", bonusReportParams],
    queryFn: async () => {
      const params = new URLSearchParams(bonusReportParams);
      const res = await fetch(apiUrl(`/api/reports/bonuses?${params}`), { headers: authHeaders() });
      if (!res.ok) return { bonuses: [], advances: [] };
      return res.json();
    },
    enabled: !!report,
  });

  // ── PDF export helpers ──────────────────────────────────────────────────
  const fetchPayrollForPDF = async (): Promise<{ data: any | null; error: string | null }> => {
    // Determine which user ID to use for payroll calculation
    let uid: number | null = null;
    if (!isAdmin) {
      // Employee: always use their own ID
      uid = me?.id ?? null;
    } else if (submitted.userId !== "all") {
      // Admin selected a specific employee
      uid = parseInt(submitted.userId);
    }
    // Admin viewing all employees — skip payroll
    if (!uid) return { data: null, error: null };

    const period = submitted.to.slice(0, 7); // "YYYY-MM" — use TO date so the month matches where records are
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(apiUrl("/api/payroll/calculate"), {
        method: "POST",
        headers,
        body: JSON.stringify({ userId: uid, period }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error ?? (isArabic
          ? t("salary_not_calculated")
          : "Payroll could not be calculated. Make sure the employee has a base salary set.");
        return { data: null, error: msg };
      }
      return { data: json, error: null };
    } catch {
      return { data: null, error: isArabic ? t("cannot_connect_salary") : "Could not reach the server to fetch payroll data." };
    }
  };

  const buildPdfOptions = async () => {
    const { data: payrollData, error: payrollError } = await fetchPayrollForPDF();
    // Employee name: for non-admin use their own name; for admin use selected employee
    const employeeName = !isAdmin
      ? me?.name
      : submitted.userId !== "all"
        ? users?.find(u => String(u.id) === submitted.userId)?.name
        : undefined;

    return {
      appName: appName || "Pulse",
      appLogo: appLogo || undefined,
      isArabic,
      from: submitted.from,
      to: submitted.to,
      employeeName,
      summary: buildExportSummary(),
      records: buildExportRecords(),
      payroll: payrollData
        ? {
            baseSalary:             payrollData.baseSalary,
            overtimeBonus:          payrollData.overtimeBonus,
            latePenalty:            payrollData.latePenalty,
            unpaidLeaveDeduction:   payrollData.unpaidLeaveDeduction,
            baseEarned:             payrollData.baseEarned ?? payrollData.netSalary,
            totalPaidHours:         payrollData.totalPaidHours ?? 0,
            totalNormalHours:       payrollData.totalNormalHours ?? 0,
            paidLeaveHours:         payrollData.paidLeaveHours ?? 0,
            totalDeductions:        payrollData.totalDeductions,
            netSalary:              payrollData.netSalary,
            dailyRate:              payrollData.dailyRate,
            hourlyRate:             payrollData.hourlyRate,
            totalOvertimeHours:     payrollData.totalOvertimeHours,
            totalLateMinutes:       payrollData.totalLateMinutes,
            period:                 payrollData.period,
          }
        : null,
      payrollError: payrollError,
      isAdmin,
    };
  };

  const handleExportPDF = async () => {
    if (!report) return;
    setPdfLoading(true);
    try {
      const opts = await buildPdfOptions();
      exportProfessionalPDF(opts);
    } catch (e) {
      toast({ title: isArabic ? t("export_failed") : "Export failed", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSharePDF = async () => {
    if (!report) return;
    setShareLoading(true);
    try {
      const opts = await buildPdfOptions();
      shareOrSavePDF(opts);
    } catch (e) {
      toast({ title: isArabic ? t("share_failed") : "Share failed", variant: "destructive" });
    } finally {
      setShareLoading(false);
    }
  };

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleEmailPDF = () => {
    if (!report || !summary) return;
    setEmailDialogOpen(true);
  };

  const defaultEmailRecipient = !isAdmin
    ? me?.email
    : (submitted.userId !== "all" ? users?.find((u: any) => u.id === parseInt(submitted.userId))?.email : me?.email);

  const handleSendEmail = async (to: string) => {
    const opts = await buildPdfOptions();
    const subject = isArabic
      ? `تقرير الحضور ${submitted.from} - ${submitted.to}`
      : `Attendance Report ${submitted.from} - ${submitted.to}`;
    await emailReportHTML(to, subject, opts);
    toast({ title: isArabic ? "✅ تم إرسال التقرير" : "✅ Report sent" });
  };

  // Column count for colSpan calculations
  // admin:     checkbox + date + employee + in + out + late + ot + leave + hours + total + delete = 11
  // non-admin: date + employee + in + out + late + ot + leave + hours + total = 9
  const COLS = isAdmin ? 11 : 9;

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold">{isArabic ? t("reports_label2") : t("reports")}</h1>

        {/* ── Filters ── */}
        <div className="bg-card border border-card-border rounded-xl p-5 overflow-hidden">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <div className="space-y-1 min-w-0 w-full sm:w-auto">
              <Label>{t("from")}</Label>
              <Input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full min-w-0 sm:w-[150px] text-sm px-2"
                data-testid="input-report-from"
              />
            </div>
            <div className="space-y-1 min-w-0 w-full sm:w-auto">
              <Label>{t("to")}</Label>
              <Input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full min-w-0 sm:w-[150px] text-sm px-2"
                data-testid="input-report-to"
              />
            </div>
            {isAdmin && (
              <div className="space-y-1 min-w-0 col-span-2 sm:col-span-1">
                <Label>{t("employee")}</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-full min-w-0 sm:w-44" data-testid="select-report-user">
                    <SelectValue placeholder={t("all_employees")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_employees")}</SelectItem>
                    {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleFilter} className="gap-2 col-span-2 sm:col-span-1 sm:w-auto" data-testid="button-apply-filter">
              <BarChart3 className="w-4 h-4" />
              {isArabic ? t("generate_report2") : t("generate_report")}
            </Button>
            {report && (
              <div className="flex gap-2 ms-auto flex-wrap">
                {/* ── PDF (primary) ── */}
                <Button
                  onClick={handleExportPDF}
                  disabled={pdfLoading || shareLoading}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  data-testid="button-export-pdf"
                >
                  {pdfLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <FileText className="w-4 h-4" />}
                  {isArabic ? t("export_pdf_pro") : "Export PDF"}
                </Button>

                {/* ── Share (mobile) ── */}
                <Button
                  variant="outline"
                  onClick={handleSharePDF}
                  disabled={pdfLoading || shareLoading}
                  className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50"
                  data-testid="button-share-pdf"
                >
                  {shareLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Share2 className="w-4 h-4" />}
                  {isArabic ? t("share_save") : "Share / Save"}
                </Button>

                {/* ── Email ── */}
                <Button
                  variant="outline"
                  onClick={handleEmailPDF}
                  className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50"
                  data-testid="button-email-report"
                >
                  <Mail className="w-4 h-4" />
                  {isArabic ? t("send_by_email") : "Send by Email"}
                </Button>

                {/* ── Divider ── */}
                <div className="w-px bg-border self-stretch" />

                <Button variant="outline" onClick={handleExportCSV} className="gap-2" data-testid="button-export-csv">
                  <FileDown className="w-4 h-4" /> {isArabic ? "CSV" : t("export_csv")}
                </Button>
                <Button variant="outline" onClick={handleExportExcel} className="gap-2" data-testid="button-export-excel">
                  <Sheet className="w-4 h-4" /> {isArabic ? "Excel" : t("export_excel")}
                </Button>
                <Button variant="outline" onClick={() => window.print()} className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Printer className="w-4 h-4" />
                  {isArabic ? t("print_action") : "Print"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {isLoading ? (
          <InlineLoader />
        ) : summary && (
          <>
            {/* Top 4 metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<CalendarCheck className="w-4 h-4 text-green-600" />}
                label={isArabic ? t("present_days_label") : t("present_days")}
                value={String(summary.presentDays ?? 0)}
                valueClass="text-green-600"
                bg="bg-green-50 dark:bg-green-900/10"
                onClick={() => setCardDetail("present")}
              />
              <MetricCard
                icon={<Clock className="w-4 h-4 text-primary" />}
                label={isArabic ? t("net_work_hours") : "Net Work Hours"}
                value={fmtHM(summary.normalHours ?? 0)}
                valueClass="text-primary"
                sub={isArabic ? `من ${fmtNum(summary.expectedHours ?? 0, 0)} متوقعة` : `of ${fmtNum(summary.expectedHours ?? 0, 0)} expected`}
                onClick={() => setCardDetail("hours")}
              />
              <MetricCard
                icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
                label={isArabic ? t("overtime_hours_label") : t("overtime_h")}
                value={fmtHM(summary.overtime ?? 0)}
                valueClass="text-orange-500"
                bg="bg-orange-50 dark:bg-orange-900/10"
                onClick={() => setCardDetail("overtime")}
              />
              <MetricCard
                icon={<CalendarX className="w-4 h-4 text-destructive" />}
                label={isArabic ? t("absent_days_label") : t("absent_days")}
                value={String(summary.absentDays ?? 0)}
                valueClass="text-destructive"
                bg="bg-red-50 dark:bg-red-900/10"
                onClick={() => setCardDetail("absent")}
              />
            </div>

            {/* Extended summary grid */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <h2 className="font-semibold text-sm">{isArabic ? t("report_summary2") : t("report_summary")}</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y divide-border rtl:divide-x-reverse">
                <SummaryCell
                  icon={<Briefcase className="w-4 h-4" />}
                  label={isArabic ? t("expected_work_days") : t("working_days")}
                  value={String(summary.workingDays ?? 0)}
                  sub={isArabic ? `${fmtNum(summary.expectedHours ?? 0, 0)} ساعة متوقعة` : `${fmtNum(summary.expectedHours ?? 0, 0)} hrs expected`}
                  onClick={() => setCardDetail("working")}
                />
                <SummaryCell
                  icon={<Clock className="w-4 h-4 text-primary" />}
                  label={isArabic ? t("net_work_hours") : "Net Work Hours"}
                  value={fmtHM(summary.normalHours ?? 0)}
                  valueClass="text-primary"
                  sub={isArabic ? `من ${fmtNum(summary.expectedHours ?? 0, 0)} متوقعة` : `of ${fmtNum(summary.expectedHours ?? 0, 0)} expected`}
                  onClick={() => setCardDetail("hours")}
                />
                <SummaryCell
                  icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
                  label={isArabic ? t("overtime_hours_label") : t("overtime_h")}
                  value={fmtHM(summary.overtime ?? 0)}
                  valueClass="text-orange-500"
                  onClick={() => setCardDetail("overtime")}
                />
                <SummaryCell
                  icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
                  label={isArabic ? t("present_days_label") : t("present_days")}
                  value={String(summary.presentDays ?? 0)}
                  valueClass="text-green-600"
                  onClick={() => setCardDetail("present")}
                />
                <SummaryCell
                  icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                  label={isArabic ? t("late_days_label") : "Late Days"}
                  value={String(summary.lateDays ?? 0)}
                  valueClass="text-amber-500"
                  onClick={() => setCardDetail("late")}
                />
                <SummaryCell
                  icon={<Palmtree className="w-4 h-4 text-blue-500" />}
                  label={isArabic ? t("leave_days_label") : t("total_leaves")}
                  value={String(summary.leaveDays ?? 0)}
                  valueClass="text-blue-500"
                  onClick={() => setCardDetail("leave")}
                />
              </div>
            </div>

            {/* ── Payroll guidance when admin views "all" employees ── */}
            {isAdmin && submitted.userId === "all" && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-3.5 flex items-center gap-3 text-indigo-700 dark:text-indigo-300 text-sm">
                <Wallet className="w-4 h-4 flex-shrink-0" />
                <span>{isArabic ? t("select_employee_for_salary") : "To view the salary summary, select a specific employee from the user filter above."}</span>
              </div>
            )}

            {/* ── Payroll Summary Card ── */}
            {(payrollLoading || payrollSummary || payrollErr) && (
              <div className={`rounded-xl border overflow-hidden shadow-sm transition-all ${payrollSummary ? "border-indigo-200 dark:border-indigo-800" : "border-amber-200 dark:border-amber-800"}`}>
                {/* Header */}
                <button
                  onClick={() => setPayrollExpanded(p => !p)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 gap-3 text-left rtl:text-right transition-colors ${payrollSummary ? "bg-indigo-600 hover:bg-indigo-700" : "bg-amber-500 hover:bg-amber-600"} text-white`}
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 flex-shrink-0" />
                    <span className="font-bold text-sm">
                      {isArabic ? t("salary_summary") : "Salary Summary"}
                    </span>
                    {payrollSummary && (
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                        {payrollSummary.period}
                      </span>
                    )}
                  </div>
                  {payrollLoading
                    ? <Loader2 className="w-4 h-4 animate-spin opacity-80" />
                    : payrollExpanded
                      ? <ChevronUp className="w-4 h-4 opacity-80" />
                      : <ChevronDown className="w-4 h-4 opacity-80" />
                  }
                </button>

                {/* Body */}
                {payrollExpanded && (
                  <div className="bg-card px-5 py-4">
                    {payrollLoading && (
                      <div className="flex items-center gap-3 py-3 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">{isArabic ? t("calculating_salary") : "Calculating salary…"}</span>
                      </div>
                    )}

                    {payrollErr && !payrollLoading && (
                      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 text-sm py-1">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{payrollErr}</span>
                      </div>
                    )}

                    {payrollSummary && !payrollLoading && (() => {
                      const p = payrollSummary;
                      const fmt2 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      if (p.baseSalary === 0) {
                        return (
                          <div className="space-y-3 py-1">
                            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 text-sm">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>{isArabic ? t("no_base_salary_set") : "No base salary set for this employee."}</span>
                            </div>
                            {isAdmin && submitted.userId !== "all" && (
                              <button
                                onClick={openSalaryDialog}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {isArabic ? t("set_salary_now") : "Set Salary Now"}
                              </button>
                            )}
                          </div>
                        );
                      }
                      const isGain = p.netSalary >= p.baseSalary;
                      return (
                        <>
                          {/* Net salary highlight */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">{isArabic ? t("estimated_net_salary") : "Estimated Net Salary"}</p>
                              <p className={`text-3xl font-black tabular-nums ${isGain ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                                {fmt2(p.netSalary)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {isArabic
                                  ? `الراتب الأساسي: ${fmt2(p.baseSalary)} · يومي: ${fmt2(p.dailyRate)} · ساعي: ${fmt2(p.hourlyRate)}`
                                  : `Base: ${fmt2(p.baseSalary)} · Daily: ${fmt2(p.dailyRate)} · Hourly: ${fmt2(p.hourlyRate)}`}
                              </p>
                            </div>
                            <div className={`flex flex-col items-end gap-1`}>
                              {isGain ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                                  <TrendingUp className="w-4 h-4" />
                                  <span>{isArabic ? `+${fmt2(p.netSalary - p.baseSalary)} مكافأة` : `+${fmt2(p.netSalary - p.baseSalary)} bonus`}</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    <span>{isArabic ? `${p.daysPresent} من ${p.workingDaysInMonth} يوم عمل` : `${p.daysPresent} of ${p.workingDaysInMonth} working days`}</span>
                                  </div>
                                  {(p.totalDeductions ?? 0) > 0 && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                      <TrendingDown className="w-3.5 h-3.5" />
                                      <span>{isArabic ? `−${fmt2(p.totalDeductions)} خصومات` : `−${fmt2(p.totalDeductions)} deductions`}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Breakdown grid — hourly build-up model */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {[
                              {
                                icon: <Clock className="w-3.5 h-3.5" />,
                                label: isArabic
                                  ? `ساعات مدفوعة (${(p.totalPaidHours ?? 0).toFixed(2)}س)`
                                  : `Paid Hours (${(p.totalPaidHours ?? 0).toFixed(2)}h)`,
                                value: fmt2(p.baseEarned ?? p.baseSalary),
                                color: "text-indigo-600 dark:text-indigo-400",
                                bg: "bg-indigo-50 dark:bg-indigo-900/20",
                              },
                              {
                                icon: <TrendingUp className="w-3.5 h-3.5" />,
                                label: isArabic ? `إضافي (${p.totalOvertimeHours}س)` : `Overtime (${p.totalOvertimeHours}h)`,
                                value: `+${fmt2(p.overtimeBonus)}`,
                                color: "text-green-600 dark:text-green-400",
                                bg: "bg-green-50 dark:bg-green-900/20",
                              },
                              {
                                icon: <Clock className="w-3.5 h-3.5" />,
                                label: isArabic ? `تأخر (${p.totalLateMinutes}د)` : `Late (${p.totalLateMinutes}m)`,
                                value: `−${fmt2(p.latePenalty)}`,
                                color: "text-red-600 dark:text-red-400",
                                bg: "bg-red-50 dark:bg-red-900/20",
                              },
                              {
                                icon: <Palmtree className="w-3.5 h-3.5" />,
                                label: isArabic ? t("leave_deduction") : "Unpaid Leave",
                                value: `−${fmt2(p.unpaidLeaveDeduction)}`,
                                color: "text-orange-600 dark:text-orange-400",
                                bg: "bg-orange-50 dark:bg-orange-900/20",
                              },
                              {
                                icon: <DollarSign className="w-3.5 h-3.5" />,
                                label: isArabic ? "الراتب الأساسي (مرجع)" : "Base Salary (ref)",
                                value: fmt2(p.baseSalary),
                                color: "text-slate-500 dark:text-slate-400",
                                bg: "bg-slate-50 dark:bg-slate-800/40",
                              },
                            ].map((item, i) => (
                              <div key={i} className={`${item.bg} rounded-lg p-3`}>
                                <div className={`flex items-center gap-1 ${item.color} mb-1.5`}>
                                  {item.icon}
                                  <span className="text-xs font-medium truncate">{item.label}</span>
                                </div>
                                <p className={`text-base font-black tabular-nums ${item.color}`}>{item.value}</p>
                              </div>
                            ))}
                          </div>

                          <p className="text-xs text-muted-foreground mt-3 text-center">
                            {isArabic
                              ? `* هذا تقدير تلقائي بناءً على بيانات شهر ${p.period} — قد يختلف عن الراتب الفعلي`
                              : `* Auto-calculated estimate for ${p.period} — may differ from final payroll`}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Attendance Log Table ── */}
        {report?.records && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
            {/* Table Header Bar */}
            <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h2 className="font-semibold text-sm">
                  {isArabic ? t("full_attendance_record") : "Full Attendance Log"}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {report.records.length} {isArabic ? t("record_label") : "records"}
                </span>
              </div>

              {isAdmin && attendanceRecords.length > 0 && (
                <div className="flex items-center gap-2 ms-auto flex-wrap">
                  {someSelected && (
                    <Button size="sm" variant="destructive"
                      onClick={() => setConfirmBulk("selected")}
                      disabled={bulkDeleteMut.isPending}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isArabic ? `حذف المحدد (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                    </Button>
                  )}
                  <Button size="sm" variant="outline"
                    onClick={() => setConfirmBulk("all")}
                    disabled={bulkDeleteMut.isPending || attendanceRecords.length === 0}
                    className="gap-1.5 h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isArabic ? `حذف الكل (${attendanceRecords.length})` : `Delete All (${attendanceRecords.length})`}
                  </Button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" dir={isArabic ? "rtl" : "ltr"}>
                <thead>
                  <tr className="border-b-2 border-border bg-muted/40">
                    {isAdmin && (
                      <th className="px-3 py-3.5 w-10">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll}
                          className="w-4 h-4 accent-primary cursor-pointer"
                          title={isArabic ? t("select_all2") : "Select all"} />
                      </th>
                    )}
                    <TH>{isArabic ? t("date_label2") : t("date")}</TH>
                    <TH>{isArabic ? t("employee_label2") : t("employee")}</TH>
                    <TH>{isArabic ? t("check_in3") : t("check_in")}</TH>
                    <TH>{isArabic ? t("check_out2") : t("check_out")}</TH>
                    <TH>{isArabic ? t("lateness_label") : "Late"}</TH>
                    <TH>{isArabic ? t("overtime_label2") : "Overtime"}</TH>
                    <TH>{isArabic ? t("leave_label2") : "Leave"}</TH>
                    <TH>{isArabic ? t("work_hours_label") : "Work Hours"}</TH>
                    <TH className="text-primary">{isArabic ? t("running_total") : "Running Total"}</TH>
                    {isAdmin && <TH center>{isArabic ? t("delete_action2") : t("delete")}</TH>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(() => {
                    let runningTotal = 0;
                    if (!report.records.length) {
                      return (
                        <tr>
                          <td colSpan={COLS} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <BarChart3 className="w-8 h-8 opacity-30" />
                              <p className="text-sm">{t("no_records")}</p>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return report.records.map((rec: any, idx: number) => {
                      const isChecked = !rec.isLeave && selectedIds.has(rec.id);
                      const rowHours = getRowHours(rec);
                      runningTotal += rowHours;
                      const isEven = idx % 2 === 0;
                      const lateStr = fmtLate(rec.lateMinutes ?? 0);
                      const otHours = rec.isLeave ? 0 : (rec.overtimeCalc ?? rec.overtime ?? 0);
                      const normalH = rec.isLeave ? 0 : (rec.normalHours ?? Math.min(rec.hoursWorked ?? 0, 8));

                      if (rec.isLeave) {
                        // ── Leave Row ──────────────────────────────────────────
                        return (
                          <tr key={`leave-${rec.id}`}
                            className="bg-blue-50/60 dark:bg-blue-900/10 border-s-4 border-blue-400 dark:border-blue-500"
                          >
                            {isAdmin && <td className="px-3 py-3" />}
                            {/* Date */}
                            <td className="px-4 py-3">
                              <span className="font-semibold text-xs tabular-nums text-blue-700 dark:text-blue-300">
                                {rec.leaveStartDate}
                                {rec.leaveEndDate && rec.leaveEndDate !== rec.leaveStartDate && (
                                  <span className="text-muted-foreground"> → {rec.leaveEndDate}</span>
                                )}
                              </span>
                            </td>
                            {/* Employee */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                                  {(rec.userName ?? "?").charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-sm">{rec.userName ?? "—"}</span>
                              </div>
                            </td>
                            {/* Check-in / out — */}
                            <td className="px-4 py-3"><span className="text-muted-foreground text-xs">—</span></td>
                            <td className="px-4 py-3"><span className="text-muted-foreground text-xs">—</span></td>
                            {/* Late — */}
                            <td className="px-4 py-3"><span className="text-muted-foreground text-xs">—</span></td>
                            {/* Overtime — */}
                            <td className="px-4 py-3"><span className="text-muted-foreground text-xs">—</span></td>
                            {/* Leave type + reason */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 font-semibold text-xs bg-blue-100 dark:bg-blue-800/40 px-2 py-0.5 rounded-full w-fit">
                                  <Palmtree className="w-3 h-3 flex-shrink-0" />
                                  {translateLeaveType(rec.leaveType)}
                                  {rec.leaveTotalDays > 0 && ` · ${rec.leaveTotalDays}${isArabic ? t("letter_y_placeholder") : "d"}`}
                                </span>
                                {rec.leaveReason && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={rec.leaveReason}>
                                    {rec.leaveReason}
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Work hours — */}
                            <td className="px-4 py-3"><span className="text-muted-foreground text-xs">—</span></td>
                            {/* Running total (unchanged for leave) */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 font-bold text-xs tabular-nums text-primary">
                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                                {fmtHM(runningTotal)}
                              </span>
                            </td>
                            {isAdmin && <td className="px-4 py-3" />}
                          </tr>
                        );
                      }

                      // ── Attendance Row ─────────────────────────────────────
                      return (
                        <tr key={rec.id}
                          className={`hover:bg-primary/5 transition-colors group ${isChecked ? "bg-destructive/5" : isEven ? "" : "bg-muted/20"}`}
                          data-testid={`row-report-${rec.id}`}
                        >
                          {isAdmin && (
                            <td className="px-3 py-3.5 text-center">
                              <input type="checkbox" checked={isChecked} onChange={() => toggleRow(rec.id)}
                                className="w-4 h-4 accent-primary cursor-pointer" />
                            </td>
                          )}
                          {/* Date */}
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-foreground text-xs tabular-nums">{rec.date}</span>
                          </td>
                          {/* Employee */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                {(rec.userName ?? "?").charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-sm">{rec.userName ?? "—"}</span>
                            </div>
                          </td>
                          {/* Check-in */}
                          <td className="px-4 py-3.5">
                            {rec.checkIn ? (
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-semibold text-xs tabular-nums bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                {fmtTime(rec.checkIn)}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          {/* Check-out */}
                          <td className="px-4 py-3.5">
                            {rec.checkOut ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold text-xs tabular-nums bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                {fmtTime(rec.checkOut)}
                              </span>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          {/* Late */}
                          <td className="px-4 py-3.5">
                            {lateStr ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold text-xs tabular-nums bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                {lateStr}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          {/* Overtime */}
                          <td className="px-4 py-3.5">
                            {otHours > 0 ? (
                              <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400 font-semibold text-xs tabular-nums bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-md">
                                <TrendingUp className="w-3 h-3 flex-shrink-0" />
                                {fmtHM(otHours)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          {/* Leave column — empty for attendance rows */}
                          <td className="px-4 py-3.5">
                            <Badge variant={statusVariant(rec.status)} className="text-xs font-semibold px-2.5 py-0.5">
                              {translateStatus(rec.status)}
                            </Badge>
                          </td>
                          {/* Work Hours */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-xs tabular-nums">
                                <Timer className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                {fmtHM(normalH)}
                              </span>
                            </div>
                          </td>
                          {/* Running Total */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 font-bold text-xs tabular-nums text-primary">
                              <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" />
                              {fmtHM(runningTotal)}
                            </span>
                          </td>
                          {/* Delete */}
                          {isAdmin && (
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => setConfirmRec({ id: rec.id, date: rec.date, userName: rec.userName })}
                                disabled={deleteMut.isPending || bulkDeleteMut.isPending}
                                title={isArabic ? t("delete_record") : "Delete record"}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>

                {/* ── Grand Total Footer ── */}
                {report.records.length > 0 && (() => {
                  const grandTotal     = report.records.reduce((s: number, r: any) => s + getRowHours(r), 0);
                  const grandNormal    = attendanceRecords.reduce((s: number, r: any) => s + (r.normalHours ?? Math.min(r.hoursWorked ?? 0, 8)), 0);
                  const grandOvertime  = attendanceRecords.reduce((s: number, r: any) => s + (r.overtimeCalc ?? r.overtime ?? 0), 0);
                  return (
                    <tfoot>
                      <tr className="border-t-2 border-primary/30 bg-primary/5">
                        {isAdmin && <td />}
                        <td className="px-4 py-3.5" colSpan={2}>
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            {isArabic ? t("grand_total") : "Grand Total"}
                          </span>
                        </td>
                        <td colSpan={2} />
                        {/* Late total */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-amber-600 tabular-nums">
                            {summary?.lateDays ? `${summary.lateDays} ${isArabic ? t("days_label") : "days"}` : "—"}
                          </span>
                        </td>
                        {/* Overtime total */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 font-bold text-xs tabular-nums text-orange-600">
                            {grandOvertime > 0 ? fmtHM(grandOvertime) : "—"}
                          </span>
                        </td>
                        <td />
                        {/* Net hours total */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 font-bold text-sm tabular-nums text-primary">
                            <Timer className="w-4 h-4 flex-shrink-0" />
                            {fmtHM(grandNormal)}
                          </span>
                        </td>
                        {/* Running total */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 font-bold text-sm tabular-nums text-primary">
                            <TrendingUp className="w-4 h-4 flex-shrink-0" />
                            {fmtHM(grandTotal)}
                          </span>
                        </td>
                        {isAdmin && <td />}
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>
        )}

        {/* ── Bonuses & Advances Section ── */}
        {report && (bonusReport?.bonuses?.length ?? 0) + (bonusReport?.advances?.length ?? 0) > 0 && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">{isArabic ? "المكافآت والخصومات والسلف" : "Bonuses, Deductions & Advances"}</h2>
              </div>
              <div className="flex gap-2">
                <Link href="/bonuses">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                    <ExternalLink className="w-3 h-3" />
                    {isArabic ? "فتح المكافآت" : "Open Bonuses"}
                  </Button>
                </Link>
                <Link href="/salary-advances">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                    <ExternalLink className="w-3 h-3" />
                    {isArabic ? "فتح السلف" : "Open Advances"}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="divide-y divide-border">
              {/* Bonuses & Deductions */}
              {(bonusReport?.bonuses ?? []).map((b: any) => (
                <div key={`b-${b.id}`} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${b.type === "bonus" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                    {b.type === "bonus" ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdmin && <span className="text-sm font-medium">{b.userName}</span>}
                      <Badge variant={b.type === "bonus" ? "default" : "destructive"} className="text-xs">
                        {b.type === "bonus" ? (isArabic ? "مكافأة" : "Bonus") : (isArabic ? "خصم" : "Deduction")}
                      </Badge>
                      {b.period && <span className="text-xs text-muted-foreground">{b.period}</span>}
                    </div>
                    {b.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.reason}</p>}
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className={`font-bold tabular-nums ${b.type === "bonus" ? "text-green-600" : "text-red-600"}`}>
                      {b.type === "bonus" ? "+" : "-"}{b.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString(isArabic ? "ar-SY" : "en-US")}</p>
                  </div>
                </div>
              ))}
              {/* Salary Advances */}
              {(bonusReport?.advances ?? []).map((a: any) => (
                <div key={`a-${a.id}`} className="flex items-center gap-4 px-5 py-3 bg-amber-50/40 dark:bg-amber-900/10">
                  <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Banknote className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdmin && <span className="text-sm font-medium">{a.userName}</span>}
                      <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                        {isArabic ? "سلفة" : "Advance"}
                      </Badge>
                      <Badge
                        className={`text-xs ${a.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30" : a.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {a.status === "approved" ? (isArabic ? "مقبولة" : "Approved") : a.status === "rejected" ? (isArabic ? "مرفوضة" : "Rejected") : (isArabic ? "بانتظار" : "Pending")}
                      </Badge>
                      {a.deductedPeriod && <span className="text-xs text-muted-foreground">{a.deductedPeriod}</span>}
                    </div>
                    {a.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.reason}</p>}
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="font-bold text-amber-600 tabular-nums">-{a.amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString(isArabic ? "ar-SY" : "en-US")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Navigation ── */}
        {report && (
          <div className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {isArabic ? "روابط سريعة" : "Quick Links"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/attendance">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  {isArabic ? "الحضور" : "Attendance"}
                </Button>
              </Link>
              <Link href="/bonuses">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Award className="w-3.5 h-3.5" />
                  {isArabic ? "المكافآت والخصومات" : "Bonuses & Deductions"}
                </Button>
              </Link>
              <Link href="/salary-advances">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Banknote className="w-3.5 h-3.5" />
                  {isArabic ? "السلف" : "Salary Advances"}
                </Button>
              </Link>
              <Link href="/leave">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Palmtree className="w-3.5 h-3.5" />
                  {isArabic ? "الإجازات" : "Leave"}
                </Button>
              </Link>
              <Link href="/payroll">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Wallet className="w-3.5 h-3.5" />
                  {isArabic ? "الرواتب" : "Payroll"}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Card Detail Dialog ── */}
      {(() => {
        const records: any[] = report?.records ?? [];
        const attRows = records.filter(r => !r.isLeave);
        const leaveRows = records.filter(r => r.isLeave);

        const fmtT = (iso: string | null) => {
          if (!iso) return "—";
          const d = new Date(iso);
          return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
        };
        const fmtH = (h: number) => {
          if (!h) return "0:00";
          const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
          return `${hh}:${String(mm).padStart(2,"0")}`;
        };

        type View = { title: string; rows: any[]; render: (r: any, i: number) => React.ReactNode; footer?: React.ReactNode };

        let view: View | null = null;
        if (cardDetail === "hours") {
          const totalActual = attRows.reduce((s, r) => s + (r.normalHours ?? 0) + (r.overtimeCalc ?? 0), 0);
          view = {
            title: isArabic ? "تفاصيل ساعات العمل" : "Work Hours Breakdown",
            rows: attRows.filter(r => (r.checkIn || r.hoursWorked)),
            render: (r: any) => (
              <div key={r.id} className="grid grid-cols-4 gap-2 py-2.5 border-b border-border last:border-0 text-xs">
                <span className="font-medium">{r.date}</span>
                <span className="text-muted-foreground">{fmtT(r.checkIn)} → {fmtT(r.checkOut)}</span>
                <span className="text-primary font-bold text-end">{fmtH((r.normalHours ?? 0) + (r.overtimeCalc ?? 0))}h</span>
                <span className="text-muted-foreground text-end">/ 8:00h</span>
              </div>
            ),
            footer: (
              <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{isArabic ? "الإجمالي" : "Total"}</span>
                <div className="text-end">
                  <span className="font-bold text-primary">{fmtH(totalActual)}h</span>
                  <span className="text-xs text-muted-foreground ms-1">/ {summary?.expectedHours ?? 0}h {isArabic ? "مقدرة" : "expected"}</span>
                </div>
              </div>
            ),
          };
        } else if (cardDetail === "present") {
          view = {
            title: isArabic ? "أيام الحضور" : "Present Days",
            rows: attRows.filter(r => ["present","late","early_leave"].includes(r.status)),
            render: (r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.date}</p>
                  <p className="text-xs text-muted-foreground">{fmtT(r.checkIn)} — {fmtT(r.checkOut)}</p>
                </div>
                <div className="text-end">
                  <Badge variant={r.status === "late" ? "outline" : "default"} className={`text-xs ${r.status === "late" ? "border-amber-400 text-amber-600" : "bg-green-100 text-green-700 dark:bg-green-900/30"}`}>
                    {r.status === "late" ? (isArabic ? "متأخر" : "Late") : (isArabic ? "حاضر" : "Present")}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtH((r.normalHours ?? 0) + (r.overtimeCalc ?? 0))}h</p>
                </div>
              </div>
            ),
          };
        } else if (cardDetail === "absent") {
          view = {
            title: isArabic ? "أيام الغياب" : "Absent Days",
            rows: attRows.filter(r => r.status === "absent"),
            render: (r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <p className="text-sm font-medium">{r.date}</p>
                <Badge variant="destructive" className="text-xs">{isArabic ? "غائب" : "Absent"}</Badge>
              </div>
            ),
          };
        } else if (cardDetail === "overtime") {
          view = {
            title: isArabic ? "ساعات الإضافي" : "Overtime Hours",
            rows: attRows.filter(r => (r.overtimeCalc ?? 0) > 0),
            render: (r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.date}</p>
                  <p className="text-xs text-muted-foreground">{fmtT(r.checkIn)} — {fmtT(r.checkOut)}</p>
                </div>
                <span className="font-bold text-orange-600 text-sm">+{fmtH(r.overtimeCalc ?? 0)}h</span>
              </div>
            ),
          };
        } else if (cardDetail === "late") {
          view = {
            title: isArabic ? "أيام التأخر" : "Late Days",
            rows: attRows.filter(r => r.status === "late"),
            render: (r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{r.date}</p>
                  <p className="text-xs text-muted-foreground">{isArabic ? "دخول:" : "In:"} {fmtT(r.checkIn)}</p>
                </div>
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
                  {isArabic ? `تأخر ${r.lateMinutes ?? 0} دقيقة` : `${r.lateMinutes ?? 0} min late`}
                </Badge>
              </div>
            ),
          };
        } else if (cardDetail === "leave") {
          view = {
            title: isArabic ? "أيام الإجازة" : "Leave Days",
            rows: leaveRows,
            render: (r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium capitalize">{r.leaveType ?? r.type}</p>
                  <p className="text-xs text-muted-foreground">{r.leaveStartDate} → {r.leaveEndDate}</p>
                </div>
                <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">
                  {r.leaveTotalDays} {isArabic ? "يوم" : "days"}
                </Badge>
              </div>
            ),
          };
        } else if (cardDetail === "working") {
          view = {
            title: isArabic ? "أيام العمل المقدرة" : "Expected Working Days",
            rows: [],
            render: () => null,
            footer: (
              <div className="space-y-3 py-2">
                <div className="bg-muted/30 rounded-xl p-4 text-center space-y-1">
                  <p className="text-3xl font-bold text-foreground">{summary?.workingDays ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{isArabic ? "يوم عمل في الفترة المحددة" : "working days in selected period"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-primary">{summary?.expectedHours ?? 0}h</p>
                    <p className="text-xs text-muted-foreground">{isArabic ? "ساعات مقدرة" : "Expected hrs"}</p>
                  </div>
                  <div className="bg-muted/20 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-green-600">{fmtH(summary?.normalHours ?? 0)}h</p>
                    <p className="text-xs text-muted-foreground">{isArabic ? "ساعات فعلية" : "Actual hrs"}</p>
                  </div>
                </div>
              </div>
            ),
          };
        }

        if (!view) return null;
        return (
          <Dialog open={cardDetail !== null} onOpenChange={v => { if (!v) setCardDetail(null); }}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-base">{view.title}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
                {view.rows.length > 0
                  ? view.rows.map((r: any, i: number) => view!.render(r, i))
                  : cardDetail !== "working" && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {isArabic ? "لا توجد بيانات" : "No data found"}
                    </p>
                  )
                }
                {view.footer}
              </div>
              <div className="pt-3 border-t border-border">
                <Button className="w-full" size="sm" variant="outline" onClick={() => setCardDetail(null)}>
                  {isArabic ? "إغلاق" : "Close"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Delete Single ── */}
      <Dialog open={confirmRec !== null} onOpenChange={v => { if (!v && !deleteMut.isPending) setConfirmRec(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5 flex-shrink-0" />
              {isArabic ? t("delete_record") : t("delete_record")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-center">{isArabic ? t("confirm_delete_record") : "Are you sure you want to delete this record?"}</p>
            {confirmRec && (
              <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-center space-y-0.5">
                {confirmRec.userName && <p className="text-sm font-semibold">{confirmRec.userName}</p>}
                <p className="text-xs text-muted-foreground">{confirmRec.date}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {isArabic ? t("action_cannot_be_undone") : (t("action_cannot_be_undone") ?? "This action cannot be undone.")}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmRec(null)} disabled={deleteMut.isPending}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => confirmRec && deleteMut.mutate(confirmRec.id)} disabled={deleteMut.isPending} className="gap-2">
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Delete ── */}
      <Dialog open={confirmBulk !== null} onOpenChange={v => { if (!v && !bulkDeleteMut.isPending) setConfirmBulk(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5 flex-shrink-0" />
              {confirmBulk === "all"
                ? (isArabic ? t("delete_all_records") : "Delete All Records")
                : (isArabic ? t("delete_selected_records") : "Delete Selected")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-center">
              {confirmBulk === "all"
                ? (isArabic ? `حذف جميع السجلات (${allIds.length})?` : `Delete all ${allIds.length} records?`)
                : (isArabic ? `حذف السجلات المحددة (${selectedIds.size})?` : `Delete ${selectedIds.size} selected records?`)}
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2.5 text-center">
              <p className="text-xs font-semibold text-destructive">
                ⚠️ {isArabic ? t("action_cannot_be_undone") : (t("action_cannot_be_undone") ?? "This action cannot be undone.")}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmBulk(null)} disabled={bulkDeleteMut.isPending}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleBulkConfirm} disabled={bulkDeleteMut.isPending} className="gap-2">
              {bulkDeleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isArabic ? t("yes_delete") : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Hidden Print Layout ── rendered off-screen, shown only by @media print ── */}
      {report && (
        <div id="print-report" style={{ display: "none" }} dir={isArabic ? "rtl" : "ltr"}>

          {/* Header */}
          <div className="print-header">
            <div className="print-header-left">
              {appLogo
                ? <img src={appLogo} alt="logo" className="print-logo" />
                : <div className="print-logo-placeholder">{(appName || "A").charAt(0).toUpperCase()}</div>
              }
              <div>
                <div className="print-app-name">{appName || "Pulse"}</div>
                <div className="print-app-sub">{isArabic ? t("attendance_management_system") : "Attendance Management System"}</div>
              </div>
            </div>
            <div className="print-header-right">
              <div className="print-title">{isArabic ? t("attendance_checkinout_report") : "Attendance Report"}</div>
              <div className="print-date">
                {isArabic ? t("period_colon") : "Period:"} {submitted.from} → {submitted.to}
              </div>
              <div className="print-date">
                {isArabic ? t("issue_date_colon") : "Generated:"} {new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="print-summary-grid">
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? t("present_days_label") : "Present Days"}</div>
                <div className="print-summary-value green">{summary.presentDays ?? 0}</div>
                <div className="print-summary-sub">{isArabic ? `من أصل ${summary.workingDays ?? 0} يوم` : `of ${summary.workingDays ?? 0} working days`}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? t("net_work_hours") : "Net Work Hours"}</div>
                <div className="print-summary-value blue">{fmtHM(summary.totalHours ?? 0)}</div>
                <div className="print-summary-sub">{isArabic ? `متوقع: ${fmtHM(summary.expectedHours ?? 0)}` : `Expected: ${fmtHM(summary.expectedHours ?? 0)}`}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? t("overtime_hours_label") : "Overtime Hours"}</div>
                <div className="print-summary-value orange">{fmtHM(summary.overtime ?? 0)}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? t("absent_days_label") : "Absent Days"}</div>
                <div className="print-summary-value red">{summary.absentDays ?? 0}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? t("late_days_label") : "Late Days"}</div>
                <div className="print-summary-value amber">{summary.lateDays ?? 0}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? t("leave_days_label") : "Leave Days"}</div>
                <div className="print-summary-value default">{summary.leaveDays ?? 0}</div>
              </div>
            </div>
          )}

          {/* Records Table */}
          <div className="print-table-wrap">
            <div className="print-table-title">
              {isArabic ? t("full_attendance_record") : "Full Attendance Log"} ({report.records.length} {isArabic ? t("record_label") : "records"})
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>{isArabic ? t("date_label2") : "Date"}</th>
                  {isAdmin && <th>{isArabic ? t("employee_label2") : "Employee"}</th>}
                  <th>{isArabic ? t("status_label2") : "Status"}</th>
                  <th>{isArabic ? t("check_in3") : "Check-in"}</th>
                  <th>{isArabic ? t("check_out2") : "Check-out"}</th>
                  <th>{isArabic ? t("lateness_label") : "Late"}</th>
                  <th>{isArabic ? t("overtime_label2") : "Overtime"}</th>
                  <th>{isArabic ? t("leave_label2") : "Leave"}</th>
                  <th>{isArabic ? t("work_hours_label") : "Work Hours"}</th>
                  <th>{isArabic ? t("cumulative_total") : "Running Total"}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let runningTotal = 0;
                  return (report.records as any[]).map((rec: any, idx: number) => {
                    const rowHours = getRowHours(rec);
                    runningTotal += rowHours;
                    const lateStr = fmtLate(rec.lateMinutes);
                    const otStr   = rec.isLeave ? null : fmtHM(rec.overtimeCalc ?? rec.overtime ?? 0);
                    const normalStr = rec.isLeave ? null : fmtHM(rec.normalHours ?? Math.min(rec.hoursWorked ?? 0, 8));
                    return (
                      <tr key={idx} className={rec.isLeave ? "leave-row" : ""}>
                        <td>{rec.isLeave ? `${rec.leaveStartDate} → ${rec.leaveEndDate}` : rec.date}</td>
                        {isAdmin && <td>{rec.userName ?? "—"}</td>}
                        <td>
                          {rec.isLeave
                            ? <span className="print-badge badge-on_leave">{isArabic ? t("leave_short") : "Leave"}</span>
                            : rec.status === "present"
                              ? <span className="print-badge badge-present">{isArabic ? t("present_label2") : "Present"}</span>
                              : rec.status === "absent"
                                ? <span className="print-badge badge-absent">{isArabic ? t("absent_label2") : "Absent"}</span>
                                : rec.status === "late"
                                  ? <span className="print-badge badge-status-late">{isArabic ? t("late_label2") : "Late"}</span>
                                  : <span>{rec.status}</span>
                          }
                        </td>
                        <td>
                          {rec.checkIn
                            ? <span className="print-badge badge-in">{fmtTime(rec.checkIn)}</span>
                            : "—"}
                        </td>
                        <td>
                          {rec.checkOut
                            ? <span className="print-badge badge-out">{fmtTime(rec.checkOut)}</span>
                            : "—"}
                        </td>
                        <td>
                          {lateStr
                            ? <span className="print-badge badge-late">{lateStr}</span>
                            : "—"}
                        </td>
                        <td>
                          {otStr && (rec.overtimeCalc ?? rec.overtime ?? 0) > 0
                            ? <span className="print-badge badge-ot">{otStr}</span>
                            : "—"}
                        </td>
                        <td>
                          {rec.isLeave
                            ? <span className="print-badge badge-leave">{translateLeaveType(rec.leaveType)}{rec.leaveReason ? ` — ${rec.leaveReason}` : ""}</span>
                            : "—"}
                        </td>
                        <td>{rec.isLeave ? `${rec.leaveTotalDays}d` : (normalStr ?? "—")}</td>
                        <td style={{ fontWeight: 700 }}>{fmtHM(runningTotal)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              {summary && (
                <tfoot>
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: "end" }}>
                      {isArabic ? t("grand_total") : "Grand Total"}
                    </td>
                    <td>{fmtHM(summary.totalHours ?? 0)}</td>
                    <td style={{ color: "#2563eb" }}>{fmtHM(summary.totalHours ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Footer */}
          <div className="print-footer">
            <span>{appName || "Pulse"} — {isArabic ? t("attendance_management_system") : "Attendance Management System"}</span>
            <span>{isArabic ? t("confidential_company") : "Confidential — Internal Use Only"}</span>
          </div>
        </div>
      )}
      {/* ── Salary Setup Dialog ─────────────────────────────── */}
      <Dialog open={salaryDialogOpen} onOpenChange={v => { if (!v) setSalaryDialogOpen(false); }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              {isArabic ? t("set_employee_salary") : "Set Employee Salary"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Employee name */}
            {payrollSummary?.employeeName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-lg text-sm font-medium">
                <span className="text-muted-foreground">{isArabic ? t("employee_colon") : "Employee:"}</span>
                <span>{payrollSummary.employeeName}</span>
              </div>
            )}

            {/* Salary field */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isArabic ? t("monthly_base_salary") : "Monthly Base Salary"}
              </Label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salaryInput}
                  onChange={e => setSalaryInput(e.target.value)}
                  placeholder={isArabic ? t("example_5000") : "e.g. 5000"}
                  className="ps-9"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleSalaryConfirm()}
                />
              </div>
            </div>

            {/* Hours per day */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isArabic ? t("daily_working_hours") : "Work Hours Per Day"}
              </Label>
              <div className="relative">
                <Clock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={hoursInput}
                  onChange={e => setHoursInput(e.target.value)}
                  placeholder="8"
                  className="ps-9"
                  onKeyDown={e => e.key === "Enter" && handleSalaryConfirm()}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isArabic ? t("used_hourly_salary_calc") : "Used to calculate hourly rate and late deductions"}
              </p>
            </div>

            {/* Live preview */}
            {salaryInput && parseFloat(salaryInput) > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg px-4 py-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1.5">
                  {isArabic ? t("quick_preview_22days") : "Quick preview (22 working days)"}
                </p>
                {(() => {
                  const s = parseFloat(salaryInput) || 0;
                  const h = parseFloat(hoursInput) || 8;
                  const daily = s / 22;
                  const hourly = daily / h;
                  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <div className="grid grid-cols-2 gap-1 text-xs text-indigo-800 dark:text-indigo-300">
                      <span>{isArabic ? t("daily_colon") : "Daily:"}</span><span className="font-semibold">{fmtP(daily)}</span>
                      <span>{isArabic ? t("hourly_colon") : "Hourly:"}</span><span className="font-semibold">{fmtP(hourly)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setSalaryDialogOpen(false)} disabled={saveSalaryMut.isPending}>
              {isArabic ? t("cancel_action2") : "Cancel"}
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSalaryConfirm} disabled={saveSalaryMut.isPending}>
              {saveSalaryMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Check className="w-4 h-4" />}
              {isArabic ? t("save_salary") : "Save Salary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailReportDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        defaultEmail={defaultEmailRecipient}
        isArabic={isArabic}
        onSend={handleSendEmail}
      />
    </Layout>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────

function TH({ children, center, className }: { children: React.ReactNode; center?: boolean; className?: string }) {
  return (
    <th className={`px-4 py-3.5 text-xs font-bold text-foreground/70 uppercase tracking-wide whitespace-nowrap ${center ? "text-center" : "text-start"} ${className ?? ""}`}>
      {children}
    </th>
  );
}

function MetricCard({ icon, label, value, valueClass = "", sub, bg = "", onClick }: {
  icon: React.ReactNode; label: string; value: string;
  valueClass?: string; sub?: string; bg?: string; onClick?: () => void;
}) {
  return (
    <div
      className={`border border-card-border rounded-xl p-4 space-y-1 ${bg || "bg-card"} ${onClick ? "cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.98] transition-all select-none" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">{icon} {label}</div>
        {onClick && <span className="text-[10px] text-primary opacity-60">↗</span>}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SummaryCell({ icon, label, value, valueClass = "", sub, onClick }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string; sub?: string; onClick?: () => void;
}) {
  return (
    <div
      className={`p-4 space-y-1 ${onClick ? "cursor-pointer hover:bg-muted/40 active:scale-[0.99] transition-all select-none" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">{icon} {label}</div>
        {onClick && <span className="text-[10px] text-primary opacity-60">↗</span>}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
