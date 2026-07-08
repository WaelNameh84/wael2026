import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useGetAttendanceReport, useListUsers, useGetMe, getGetAttendanceReportQueryKey, getGetMeQueryKey } from "@/lib/api-client/index";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart3, Clock, TrendingUp, CalendarCheck, CalendarX,
  Briefcase, Timer, FileDown, Sheet, Trash2, Loader2,
  AlertTriangle, Palmtree, CheckCircle2, Printer, FileText, Share2, Mail,
  DollarSign, TrendingDown, Wallet, ChevronDown, ChevronUp, Pencil, Check
} from "lucide-react";
import { format, subDays } from "date-fns";
import { exportCSV, exportExcel } from "@/lib/export";
import { exportProfessionalPDF, shareOrSavePDF, emailReport } from "@/lib/pdf-export";
import { useToast } from "@/hooks/use-toast";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { apiUrl, authHeaders } from "@/lib/api-url";

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

  /* ── Salary setup dialog ─────────────────────────────── */
  const [salaryDialogOpen, setSalaryDialogOpen] = useState(false);
  const [salaryInput, setSalaryInput] = useState("");
  const [hoursInput, setHoursInput] = useState("8");

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: users } = useListUsers(undefined, { query: { enabled: me?.role === "admin" } as any });

  const isAdmin = me?.role === "admin";

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
    const period = submitted.from.slice(0, 7);
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
        else { setPayrollSummary(null); setPayrollErr(json?.error ?? (isArabic ? "لم يتم تحديد راتب لهذا الموظف." : "No salary configured for this employee.")); }
      })
      .catch(() => { setPayrollSummary(null); setPayrollErr(isArabic ? "تعذّر جلب بيانات الراتب." : "Could not load payroll data."); })
      .finally(() => setPayrollLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, me?.id, submitted.userId, submitted.from]);

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
      toast({ title: isArabic ? "تم حذف السجل" : "Record deleted" });
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
      toast({ title: isArabic ? "تم حفظ الراتب بنجاح ✓" : "Salary saved ✓" });
      /* Re-trigger payroll calculation */
      const uid = !isAdmin ? me?.id : (submitted.userId !== "all" ? parseInt(submitted.userId) : null);
      if (!uid) return;
      const period = submitted.from.slice(0, 7);
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
    if (!salary || salary <= 0) { toast({ title: isArabic ? "أدخل راتباً صحيحاً" : "Enter a valid salary", variant: "destructive" }); return; }
    if (!hours || hours <= 0 || hours > 24) { toast({ title: isArabic ? "أدخل ساعات عمل صحيحة" : "Enter valid work hours", variant: "destructive" }); return; }
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
      present: isArabic ? "حاضر" : t("present"),
      late: isArabic ? "متأخر" : t("late"),
      absent: isArabic ? "غائب" : t("absent"),
      on_leave: isArabic ? "إجازة" : t("leave"),
      early_leave: isArabic ? "خروج مبكر" : "Early Leave",
    };
    return map[s] ?? s;
  };

  const translateLeaveType = (type: string) => {
    const map: Record<string, string> = {
      annual:    isArabic ? "سنوية"       : "Annual",
      sick:      isArabic ? "مرضية"       : "Sick",
      unpaid:    isArabic ? "بدون راتب"   : "Unpaid",
      emergency: isArabic ? "طارئة"       : "Emergency",
      maternity: isArabic ? "أمومة"       : "Maternity",
      paternity: isArabic ? "أبوة"        : "Paternity",
      casual:    isArabic ? "عارضة"       : "Casual",
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

    const period = submitted.from.slice(0, 7); // "YYYY-MM"
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
          ? "لم يتم احتساب الراتب. تأكد من تحديد الراتب الأساسي للموظف في إعدادات المستخدمين."
          : "Payroll could not be calculated. Make sure the employee has a base salary set.");
        return { data: null, error: msg };
      }
      return { data: json, error: null };
    } catch {
      return { data: null, error: isArabic ? "تعذّر الاتصال بالخادم لجلب بيانات الراتب." : "Could not reach the server to fetch payroll data." };
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
      appName: appName || "AttendX",
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
            absentDeduction:        payrollData.absentDeduction ?? 0,
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
      toast({ title: isArabic ? "فشل التصدير" : "Export failed", variant: "destructive" });
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
      toast({ title: isArabic ? "فشلت المشاركة" : "Share failed", variant: "destructive" });
    } finally {
      setShareLoading(false);
    }
  };

  const handleEmailPDF = () => {
    if (!report || !summary) return;
    const subject = isArabic
      ? `تقرير الحضور ${submitted.from} - ${submitted.to}`
      : `Attendance Report ${submitted.from} - ${submitted.to}`;
    const body = isArabic
      ? `السلام عليكم،\n\nمرفق ملخص تقرير الحضور للفترة من ${submitted.from} إلى ${submitted.to}:\n\n• أيام الحضور: ${summary.presentDays ?? 0}\n• أيام الغياب: ${summary.absentDays ?? 0}\n• ساعات العمل: ${summary.normalHours ?? 0} ساعة\n• ساعات إضافية: ${summary.overtime ?? 0} ساعة\n• أيام الإجازة: ${summary.leaveDays ?? 0}\n\nيمكن الاطلاع على التقرير المفصل عبر نظام الحضور.\n\nمع التحية`
      : `Hello,\n\nHere is the attendance report summary for the period ${submitted.from} to ${submitted.to}:\n\n• Present Days: ${summary.presentDays ?? 0}\n• Absent Days: ${summary.absentDays ?? 0}\n• Work Hours: ${summary.normalHours ?? 0} hrs\n• Overtime: ${summary.overtime ?? 0} hrs\n• Leave Days: ${summary.leaveDays ?? 0}\n\nPlease refer to the attendance system for the full detailed report.\n\nBest regards`;
    emailReport(subject, body);
  };

  // Column count for colSpan calculations
  // admin:     checkbox + date + employee + in + out + late + ot + leave + hours + total + delete = 11
  // non-admin: date + employee + in + out + late + ot + leave + hours + total = 9
  const COLS = isAdmin ? 11 : 9;

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl">
        <h1 className="text-2xl font-bold">{isArabic ? "التقارير" : t("reports")}</h1>

        {/* ── Filters ── */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>{t("from")}</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" data-testid="input-report-from" />
            </div>
            <div className="space-y-1">
              <Label>{t("to")}</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" data-testid="input-report-to" />
            </div>
            {isAdmin && (
              <div className="space-y-1">
                <Label>{t("employee")}</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-44" data-testid="select-report-user">
                    <SelectValue placeholder={t("all_employees")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_employees")}</SelectItem>
                    {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleFilter} className="gap-2" data-testid="button-apply-filter">
              <BarChart3 className="w-4 h-4" />
              {isArabic ? "إنشاء التقرير" : t("generate_report")}
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
                  {isArabic ? "تصدير PDF احترافي" : "Export PDF"}
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
                  {isArabic ? "مشاركة / حفظ" : "Share / Save"}
                </Button>

                {/* ── Email ── */}
                <Button
                  variant="outline"
                  onClick={handleEmailPDF}
                  className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50"
                  data-testid="button-email-report"
                >
                  <Mail className="w-4 h-4" />
                  {isArabic ? "إرسال بالإيميل" : "Send by Email"}
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
                  {isArabic ? "طباعة" : "Print"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : summary && (
          <>
            {/* Top 4 metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<CalendarCheck className="w-4 h-4 text-green-600" />}
                label={isArabic ? "أيام الحضور" : t("present_days")}
                value={String(summary.presentDays ?? 0)}
                valueClass="text-green-600"
                bg="bg-green-50 dark:bg-green-900/10"
              />
              <MetricCard
                icon={<Clock className="w-4 h-4 text-primary" />}
                label={isArabic ? "صافي ساعات العمل" : "Net Work Hours"}
                value={fmtHM(summary.normalHours ?? 0)}
                valueClass="text-primary"
                sub={isArabic ? `من ${fmtNum(summary.expectedHours ?? 0, 0)} متوقعة` : `of ${fmtNum(summary.expectedHours ?? 0, 0)} expected`}
              />
              <MetricCard
                icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
                label={isArabic ? "ساعات الإضافي" : t("overtime_h")}
                value={fmtHM(summary.overtime ?? 0)}
                valueClass="text-orange-500"
                bg="bg-orange-50 dark:bg-orange-900/10"
              />
              <MetricCard
                icon={<CalendarX className="w-4 h-4 text-destructive" />}
                label={isArabic ? "أيام الغياب" : t("absent_days")}
                value={String(summary.absentDays ?? 0)}
                valueClass="text-destructive"
                bg="bg-red-50 dark:bg-red-900/10"
              />
            </div>

            {/* Extended summary grid */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <h2 className="font-semibold text-sm">{isArabic ? "ملخص التقرير" : t("report_summary")}</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y divide-border rtl:divide-x-reverse">
                <SummaryCell
                  icon={<Briefcase className="w-4 h-4" />}
                  label={isArabic ? "أيام العمل المتوقعة" : t("working_days")}
                  value={String(summary.workingDays ?? 0)}
                  sub={isArabic ? `${fmtNum(summary.expectedHours ?? 0, 0)} ساعة متوقعة` : `${fmtNum(summary.expectedHours ?? 0, 0)} hrs expected`}
                />
                <SummaryCell
                  icon={<Clock className="w-4 h-4 text-primary" />}
                  label={isArabic ? "صافي ساعات العمل" : "Net Work Hours"}
                  value={fmtHM(summary.normalHours ?? 0)}
                  valueClass="text-primary"
                  sub={isArabic ? `من ${fmtNum(summary.expectedHours ?? 0, 0)} متوقعة` : `of ${fmtNum(summary.expectedHours ?? 0, 0)} expected`}
                />
                <SummaryCell
                  icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
                  label={isArabic ? "ساعات الإضافي" : t("overtime_h")}
                  value={fmtHM(summary.overtime ?? 0)}
                  valueClass="text-orange-500"
                />
                <SummaryCell
                  icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
                  label={isArabic ? "أيام الحضور" : t("present_days")}
                  value={String(summary.presentDays ?? 0)}
                  valueClass="text-green-600"
                />
                <SummaryCell
                  icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                  label={isArabic ? "أيام التأخر" : "Late Days"}
                  value={String(summary.lateDays ?? 0)}
                  valueClass="text-amber-500"
                />
                <SummaryCell
                  icon={<Palmtree className="w-4 h-4 text-blue-500" />}
                  label={isArabic ? "أيام الإجازة" : t("total_leaves")}
                  value={String(summary.leaveDays ?? 0)}
                  valueClass="text-blue-500"
                />
              </div>
            </div>

            {/* ── Payroll guidance when admin views "all" employees ── */}
            {isAdmin && submitted.userId === "all" && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-3.5 flex items-center gap-3 text-indigo-700 dark:text-indigo-300 text-sm">
                <Wallet className="w-4 h-4 flex-shrink-0" />
                <span>{isArabic ? "لعرض ملخص الراتب، اختر موظفاً محدداً من فلتر المستخدم أعلاه." : "To view the salary summary, select a specific employee from the user filter above."}</span>
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
                      {isArabic ? "ملخص الراتب" : "Salary Summary"}
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
                        <span className="text-sm">{isArabic ? "جاري حساب الراتب…" : "Calculating salary…"}</span>
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
                              <span>{isArabic ? "لم يتم تحديد راتب أساسي لهذا الموظف." : "No base salary set for this employee."}</span>
                            </div>
                            {isAdmin && submitted.userId !== "all" && (
                              <button
                                onClick={openSalaryDialog}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {isArabic ? "تعيين الراتب الآن" : "Set Salary Now"}
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
                              <p className="text-xs text-muted-foreground mb-1">{isArabic ? "صافي الراتب المُقدَّر" : "Estimated Net Salary"}</p>
                              <p className={`text-3xl font-black tabular-nums ${isGain ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                                {fmt2(p.netSalary)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {isArabic
                                  ? `الراتب الأساسي: ${fmt2(p.baseSalary)} · يومي: ${fmt2(p.dailyRate)} · ساعي: ${fmt2(p.hourlyRate)}`
                                  : `Base: ${fmt2(p.baseSalary)} · Daily: ${fmt2(p.dailyRate)} · Hourly: ${fmt2(p.hourlyRate)}`}
                              </p>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${isGain ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>
                              {isGain
                                ? <TrendingUp className="w-4 h-4" />
                                : <TrendingDown className="w-4 h-4" />}
                              <span>
                                {isGain
                                  ? (isArabic ? `+${fmt2(p.netSalary - p.baseSalary)} مكافأة` : `+${fmt2(p.netSalary - p.baseSalary)} bonus`)
                                  : (isArabic ? `${fmt2(p.baseSalary - p.netSalary)} خصومات` : `${fmt2(p.baseSalary - p.netSalary)} deductions`)}
                              </span>
                            </div>
                          </div>

                          {/* Breakdown grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {[
                              {
                                icon: <DollarSign className="w-3.5 h-3.5" />,
                                label: isArabic ? "الراتب الأساسي" : "Base Salary",
                                value: fmt2(p.baseSalary),
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
                                label: isArabic ? "خصم إجازة" : "Leave Deduction",
                                value: `−${fmt2(p.unpaidLeaveDeduction)}`,
                                color: "text-orange-600 dark:text-orange-400",
                                bg: "bg-orange-50 dark:bg-orange-900/20",
                              },
                              {
                                icon: <CalendarX className="w-3.5 h-3.5" />,
                                label: isArabic ? "خصم غياب" : "Absence Deduction",
                                value: `−${fmt2(p.absentDeduction ?? 0)}`,
                                color: "text-rose-600 dark:text-rose-400",
                                bg: "bg-rose-50 dark:bg-rose-900/20",
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
                  {isArabic ? "سجل الحضور الكامل" : "Full Attendance Log"}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {report.records.length} {isArabic ? "سجل" : "records"}
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
                          title={isArabic ? "تحديد الكل" : "Select all"} />
                      </th>
                    )}
                    <TH>{isArabic ? "التاريخ" : t("date")}</TH>
                    <TH>{isArabic ? "الموظف" : t("employee")}</TH>
                    <TH>{isArabic ? "تسجيل الدخول" : t("check_in")}</TH>
                    <TH>{isArabic ? "تسجيل الخروج" : t("check_out")}</TH>
                    <TH>{isArabic ? "التأخر" : "Late"}</TH>
                    <TH>{isArabic ? "الإضافي" : "Overtime"}</TH>
                    <TH>{isArabic ? "الإجازة" : "Leave"}</TH>
                    <TH>{isArabic ? "ساعات العمل" : "Work Hours"}</TH>
                    <TH className="text-primary">{isArabic ? "مجموع تراكمي" : "Running Total"}</TH>
                    {isAdmin && <TH center>{isArabic ? "حذف" : t("delete")}</TH>}
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
                                  {rec.leaveTotalDays > 0 && ` · ${rec.leaveTotalDays}${isArabic ? "ي" : "d"}`}
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
                                title={isArabic ? "حذف السجل" : "Delete record"}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
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
                            {isArabic ? "الإجمالي الكلي" : "Grand Total"}
                          </span>
                        </td>
                        <td colSpan={2} />
                        {/* Late total */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-amber-600 tabular-nums">
                            {summary?.lateDays ? `${summary.lateDays} ${isArabic ? "أيام" : "days"}` : "—"}
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
      </div>

      {/* ── Delete Single ── */}
      <Dialog open={confirmRec !== null} onOpenChange={v => { if (!v && !deleteMut.isPending) setConfirmRec(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5 flex-shrink-0" />
              {isArabic ? "حذف السجل" : t("delete_record")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-center">{isArabic ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?"}</p>
            {confirmRec && (
              <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-center space-y-0.5">
                {confirmRec.userName && <p className="text-sm font-semibold">{confirmRec.userName}</p>}
                <p className="text-xs text-muted-foreground">{confirmRec.date}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {isArabic ? "لا يمكن التراجع عن هذا الإجراء." : (t("action_cannot_be_undone") ?? "This action cannot be undone.")}
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
                ? (isArabic ? "حذف جميع السجلات" : "Delete All Records")
                : (isArabic ? "حذف السجلات المحددة" : "Delete Selected")}
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
                ⚠️ {isArabic ? "لا يمكن التراجع عن هذا الإجراء." : (t("action_cannot_be_undone") ?? "This action cannot be undone.")}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmBulk(null)} disabled={bulkDeleteMut.isPending}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleBulkConfirm} disabled={bulkDeleteMut.isPending} className="gap-2">
              {bulkDeleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isArabic ? "نعم، احذف" : "Delete"}
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
                <div className="print-app-name">{appName || "AttendX"}</div>
                <div className="print-app-sub">{isArabic ? "نظام إدارة الحضور" : "Attendance Management System"}</div>
              </div>
            </div>
            <div className="print-header-right">
              <div className="print-title">{isArabic ? "تقرير الحضور والانصراف" : "Attendance Report"}</div>
              <div className="print-date">
                {isArabic ? "الفترة:" : "Period:"} {submitted.from} → {submitted.to}
              </div>
              <div className="print-date">
                {isArabic ? "تاريخ الإصدار:" : "Generated:"} {new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="print-summary-grid">
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? "أيام الحضور" : "Present Days"}</div>
                <div className="print-summary-value green">{summary.presentDays ?? 0}</div>
                <div className="print-summary-sub">{isArabic ? `من أصل ${summary.workingDays ?? 0} يوم` : `of ${summary.workingDays ?? 0} working days`}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? "صافي ساعات العمل" : "Net Work Hours"}</div>
                <div className="print-summary-value blue">{fmtHM(summary.totalHours ?? 0)}</div>
                <div className="print-summary-sub">{isArabic ? `متوقع: ${fmtHM(summary.expectedHours ?? 0)}` : `Expected: ${fmtHM(summary.expectedHours ?? 0)}`}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? "ساعات الإضافي" : "Overtime Hours"}</div>
                <div className="print-summary-value orange">{fmtHM(summary.overtime ?? 0)}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? "أيام الغياب" : "Absent Days"}</div>
                <div className="print-summary-value red">{summary.absentDays ?? 0}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? "أيام التأخر" : "Late Days"}</div>
                <div className="print-summary-value amber">{summary.lateDays ?? 0}</div>
              </div>
              <div className="print-summary-card">
                <div className="print-summary-label">{isArabic ? "أيام الإجازة" : "Leave Days"}</div>
                <div className="print-summary-value default">{summary.leaveDays ?? 0}</div>
              </div>
            </div>
          )}

          {/* Records Table */}
          <div className="print-table-wrap">
            <div className="print-table-title">
              {isArabic ? "سجل الحضور الكامل" : "Full Attendance Log"} ({report.records.length} {isArabic ? "سجل" : "records"})
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>{isArabic ? "التاريخ" : "Date"}</th>
                  {isAdmin && <th>{isArabic ? "الموظف" : "Employee"}</th>}
                  <th>{isArabic ? "الحالة" : "Status"}</th>
                  <th>{isArabic ? "تسجيل الدخول" : "Check-in"}</th>
                  <th>{isArabic ? "تسجيل الخروج" : "Check-out"}</th>
                  <th>{isArabic ? "التأخر" : "Late"}</th>
                  <th>{isArabic ? "الإضافي" : "Overtime"}</th>
                  <th>{isArabic ? "الإجازة" : "Leave"}</th>
                  <th>{isArabic ? "ساعات العمل" : "Work Hours"}</th>
                  <th>{isArabic ? "المجموع التراكمي" : "Running Total"}</th>
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
                            ? <span className="print-badge badge-on_leave">{isArabic ? "إجازة" : "Leave"}</span>
                            : rec.status === "present"
                              ? <span className="print-badge badge-present">{isArabic ? "حاضر" : "Present"}</span>
                              : rec.status === "absent"
                                ? <span className="print-badge badge-absent">{isArabic ? "غائب" : "Absent"}</span>
                                : rec.status === "late"
                                  ? <span className="print-badge badge-status-late">{isArabic ? "متأخر" : "Late"}</span>
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
                      {isArabic ? "الإجمالي الكلي" : "Grand Total"}
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
            <span>{appName || "AttendX"} — {isArabic ? "نظام إدارة الحضور" : "Attendance Management System"}</span>
            <span>{isArabic ? "سري وخاص بالشركة" : "Confidential — Internal Use Only"}</span>
          </div>
        </div>
      )}
      {/* ── Salary Setup Dialog ─────────────────────────────── */}
      <Dialog open={salaryDialogOpen} onOpenChange={v => { if (!v) setSalaryDialogOpen(false); }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              {isArabic ? "تعيين راتب الموظف" : "Set Employee Salary"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Employee name */}
            {payrollSummary?.employeeName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 rounded-lg text-sm font-medium">
                <span className="text-muted-foreground">{isArabic ? "الموظف:" : "Employee:"}</span>
                <span>{payrollSummary.employeeName}</span>
              </div>
            )}

            {/* Salary field */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isArabic ? "الراتب الأساسي الشهري" : "Monthly Base Salary"}
              </Label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salaryInput}
                  onChange={e => setSalaryInput(e.target.value)}
                  placeholder={isArabic ? "مثال: 5000" : "e.g. 5000"}
                  className="ps-9"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleSalaryConfirm()}
                />
              </div>
            </div>

            {/* Hours per day */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isArabic ? "ساعات العمل اليومية" : "Work Hours Per Day"}
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
                {isArabic ? "يُستخدم لحساب الراتب الساعي وخصم التأخر" : "Used to calculate hourly rate and late deductions"}
              </p>
            </div>

            {/* Live preview */}
            {salaryInput && parseFloat(salaryInput) > 0 && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg px-4 py-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1.5">
                  {isArabic ? "معاينة سريعة (22 يوم عمل)" : "Quick preview (22 working days)"}
                </p>
                {(() => {
                  const s = parseFloat(salaryInput) || 0;
                  const h = parseFloat(hoursInput) || 8;
                  const daily = s / 22;
                  const hourly = daily / h;
                  const fmtP = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <div className="grid grid-cols-2 gap-1 text-xs text-indigo-800 dark:text-indigo-300">
                      <span>{isArabic ? "يومي:" : "Daily:"}</span><span className="font-semibold">{fmtP(daily)}</span>
                      <span>{isArabic ? "ساعي:" : "Hourly:"}</span><span className="font-semibold">{fmtP(hourly)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setSalaryDialogOpen(false)} disabled={saveSalaryMut.isPending}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button className="flex-1 gap-2" onClick={handleSalaryConfirm} disabled={saveSalaryMut.isPending}>
              {saveSalaryMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Check className="w-4 h-4" />}
              {isArabic ? "حفظ الراتب" : "Save Salary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function MetricCard({ icon, label, value, valueClass = "", sub, bg = "" }: {
  icon: React.ReactNode; label: string; value: string;
  valueClass?: string; sub?: string; bg?: string;
}) {
  return (
    <div className={`border border-card-border rounded-xl p-4 space-y-1 ${bg || "bg-card"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">{icon} {label}</div>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SummaryCell({ icon, label, value, valueClass = "", sub }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string; sub?: string;
}) {
  return (
    <div className="p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">{icon} {label}</div>
      <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
