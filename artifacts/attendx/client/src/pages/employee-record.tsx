import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { InlineLoader } from "@/components/ui/spinner";
import {
  User, Calendar, FileDown, FileText, Mail, Printer,
  CheckCircle, XCircle, Clock,
} from "lucide-react";
import { format, subDays, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { exportCSV, exportExcel } from "@/lib/export";
import { shareOrSavePDF, exportProfessionalPDF, emailReportHTML } from "@/lib/pdf-export";
import { EmailReportDialog } from "@/components/EmailReportDialog";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { useToast } from "@/hooks/use-toast";

/* ── Types ───────────────────────────────────────────────────── */
export type EmpUser = {
  id: number; name: string; email: string; role: string;
  department?: string | null; position?: string | null;
  phone?: string | null; workHoursPerDay?: number | null;
  salary?: number | null;
};

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtHours(h: number): string {
  if (!h || h <= 0) return "—";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh > 0 && mm > 0 ? `${hh}h ${mm}m` : hh > 0 ? `${hh}h` : `${mm}m`;
}
function statusLabelAr(s: string) {
  return { present: "حاضر", late: "متأخر", absent: "غائب", on_leave: "إجازة", early_leave: "خروج مبكر" }[s] ?? s;
}
function statusLabelEn(s: string) {
  return { present: "Present", late: "Late", absent: "Absent", on_leave: "On Leave", early_leave: "Early Leave" }[s] ?? s;
}
function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  return ({ present: "default", late: "secondary", absent: "destructive", early_leave: "outline", on_leave: "outline" } as any)[s] ?? "outline";
}
function countWorkDays(from: string, to: string): number {
  try {
    return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).filter(d => !isWeekend(d)).length;
  } catch { return 0; }
}

const JUST_STYLE: Record<string, string> = {
  pending:  "text-amber-600 bg-amber-50 border-amber-200",
  approved: "text-green-600 bg-green-50 border-green-200",
  rejected: "text-red-600 bg-red-50 border-red-200",
};
const JUST_LABEL: Record<string, string> = {
  pending: "بانتظار الموافقة", approved: "مقبول ✓", rejected: "مرفوض ✗",
};

/* ── Component ───────────────────────────────────────────────── */
interface Props {
  user: EmpUser | null;
  onClose: () => void;
}

export default function EmployeeRecordDialog({ user, onClose }: Props) {
  const { appName, appLogo } = useAppConfig();
  const isOpen = user !== null;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthAgoStr = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [from, setFrom] = useState(monthAgoStr);
  const [to,   setTo]   = useState(todayStr);
  const [applied, setApplied] = useState({ from: monthAgoStr, to: todayStr });

  /* ── Fetch attendance records ─────── */
  const { data: records = [], isLoading } = useQuery<any[]>({
    queryKey: ["emp-records", user?.id, applied.from, applied.to],
    queryFn: async () => {
      if (!user) return [];
      const params = new URLSearchParams({
        userId: String(user.id), from: applied.from, to: applied.to,
      });
      const res = await fetch(apiUrl(`/api/attendance?${params}`), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  /* ── Fetch justifications (server-side filtered by userId via attendanceId join) ─ */
  /* We pass the list of attendanceIds from the loaded records so the server can     */
  /* scope the query — but the existing GET /justifications endpoint has no userId   */
  /* filter param, so we fetch and filter client-side while scoping the queryKey by  */
  /* userId to avoid re-using a stale all-employees cache.                           */
  const attendanceIds = useMemo(() => records.map((r: any) => r.id), [records]);

  const { data: justifications = [] } = useQuery<any[]>({
    queryKey: ["emp-justifications", user?.id, attendanceIds],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/attendance/justifications"), { headers: authHeaders() });
      if (!res.ok) return [];
      const all: any[] = await res.json();
      /* Filter to only justifications whose attendance record belongs to this employee */
      const idSet = new Set(attendanceIds);
      return all.filter(j => j.userId === user?.id || idSet.has(j.attendanceId));
    },
    enabled: isOpen && attendanceIds.length > 0,
  });

  /* justification keyed by attendanceId */
  const justMap = useMemo(() => {
    const m = new Map<number, any>();
    for (const j of justifications) m.set(j.attendanceId, j);
    return m;
  }, [justifications]);

  /* ── Stats ────────────────────────── */
  const stats = useMemo(() => {
    const workDays = countWorkDays(applied.from, applied.to);
    // Count unique dates by status (use explicit status matching, not negation,
    // so absent records that happen to exist in the table are not mis-classified)
    const PRESENT_STATUSES = new Set(["present", "late", "early_leave"]);
    const presentDays = new Set(records.filter(r => PRESENT_STATUSES.has(r.status)).map(r => r.date)).size;
    const leaveDays   = new Set(records.filter(r => r.status === "on_leave").map(r => r.date)).size;
    const lateDays    = records.filter(r => r.status === "late").length;
    const earlyLeave  = records.filter(r => r.status === "early_leave").length;
    const absentDays  = Math.max(0, workDays - presentDays - leaveDays);
    const totalHours  = records.reduce((s, r) => s + (r.hoursWorked || 0), 0);
    const overtime    = records.reduce((s, r) => s + (r.overtime    || 0), 0);
    return { workDays, presentDays, leaveDays, lateDays, earlyLeave, absentDays, totalHours, overtime };
  }, [records, applied]);

  /* ── Export helpers ───────────────── */
  const expRecords = records.map(r => ({
    date: r.date,
    checkIn:     r.checkIn  ? fmtTime(r.checkIn)  : "—",
    checkOut:    r.checkOut ? fmtTime(r.checkOut) : "—",
    normalHours: fmtHours(r.hoursWorked || 0),
    overtime:    fmtHours(r.overtime    || 0),
    status:      statusLabelEn(r.status),
  }));
  const expSummary = {
    from: applied.from, to: applied.to,
    workingDays:   stats.workDays,
    presentDays:   stats.presentDays,
    absentDays:    stats.absentDays,
    leaveDays:     stats.leaveDays,
    totalHours:    stats.totalHours,
    normalHours:   stats.totalHours,
    overtime:      stats.overtime,
    expectedHours: stats.workDays * (user?.workHoursPerDay || 8),
  };
  const CSV_LABELS = {
    date: "Date", employee: "Employee", location: "Location",
    checkIn: "Check In", checkOut: "Check Out",
    normalHours: "Work Hours", overtime: "Overtime", status: "Status",
    summaryTitle: "Summary", from: "From", to: "To",
    workingDays: "Working Days", presentDays: "Present Days",
    absentDays: "Absent Days", leaveDays: "Leave Days",
    totalHours: "Total Hours", normalHoursLabel: "Normal Hours",
    overtimeLabel: "Overtime", expectedHours: "Expected Hours",
  };

  const pdfOpts = () => ({
    appName, appLogo, isArabic: false,
    from: applied.from, to: applied.to,
    employeeName: user?.name,
    isAdmin: false,
    summary: {
      workingDays:   stats.workDays,
      presentDays:   stats.presentDays,
      absentDays:    stats.absentDays,
      leaveDays:     stats.leaveDays,
      lateDays:      stats.lateDays,
      totalHours:    stats.totalHours,
      normalHours:   stats.totalHours,
      overtime:      stats.overtime,
      expectedHours: stats.workDays * (user?.workHoursPerDay || 8),
    },
    records: expRecords.map(r => ({ ...r, lateMinutes: 0 })),
    payroll: null,
  });

  const { toast } = useToast();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleEmail = () => {
    if (!user) return;
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async (to: string) => {
    if (!user) return;
    await emailReportHTML(to, `تقرير حضور — ${user.name}`, pdfOpts() as any);
    toast({ title: "✅ تم إرسال التقرير" });
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold leading-tight">{user.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {[user.department, user.position].filter(Boolean).join(" · ")}
                {user.email ? <span className="ms-2 text-primary/70">{user.email}</span> : null}
                {user.phone ? <span className="ms-2">{user.phone}</span> : null}
              </p>
            </div>
            <Badge variant="secondary" className="capitalize flex-shrink-0 hidden sm:block">
              {user.role}
            </Badge>
          </div>
        </DialogHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Date range + export buttons */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">من</Label>
                  <Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="h-8 text-sm w-36" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">إلى</Label>
                  <Input type="date" value={to} min={from} max={todayStr} onChange={e => setTo(e.target.value)} className="h-8 text-sm w-36" />
                </div>
                <Button size="sm" className="h-8 gap-1.5" onClick={() => setApplied({ from, to })}>
                  <Calendar className="w-3.5 h-3.5" /> تطبيق
                </Button>
              </div>

              {/* Export */}
              <div className="flex gap-1.5 flex-wrap ms-auto">
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                  onClick={() => exportCSV(expRecords, expSummary, false, CSV_LABELS)}
                >
                  <FileDown className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                  onClick={() => exportExcel(expRecords, expSummary, false, { ...CSV_LABELS, recordsSheet: "Records", summarySheet: "Summary" })}
                >
                  <FileDown className="w-3.5 h-3.5" /> Excel
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                  onClick={() => shareOrSavePDF(pdfOpts())}
                >
                  <Printer className="w-3.5 h-3.5" /> طباعة / PDF
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                  onClick={() => exportProfessionalPDF(pdfOpts())}
                >
                  <FileText className="w-3.5 h-3.5" /> فتح PDF
                </Button>
                <Button
                  size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                  onClick={handleEmail}
                >
                  <Mail className="w-3.5 h-3.5" /> إيميل
                </Button>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {[
                { label: "أيام الحضور",      value: stats.presentDays,              color: "text-green-700",  bg: "bg-green-50  border-green-200"  },
                { label: "أيام الغياب",      value: stats.absentDays,               color: "text-red-700",    bg: "bg-red-50    border-red-200"    },
                { label: "التأخر",           value: stats.lateDays,                  color: "text-amber-700",  bg: "bg-amber-50  border-amber-200"  },
                { label: "الخروج المبكر",   value: stats.earlyLeave,                color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
                { label: "الإجازات",         value: stats.leaveDays,                 color: "text-blue-700",   bg: "bg-blue-50   border-blue-200"   },
                { label: "إجمالي الساعات",  value: fmtHours(stats.totalHours),     color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", small: true },
              ].map((c, i) => (
                <div key={i} className={`border rounded-xl p-3 text-center ${c.bg}`}>
                  <p className={`font-bold ${c.small ? "text-base" : "text-2xl"} ${c.color}`}>{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Attendance table */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">السجل التفصيلي</h3>
                <span className="text-xs text-muted-foreground">{records.length} سجل</span>
              </div>

              {isLoading ? (
                <InlineLoader />
              ) : records.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  لا توجد سجلات في هذه الفترة
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted">
                        {["التاريخ","الموقع","الدخول","الخروج","الساعات","الإضافي","الحالة","التبرير","ملاحظات"].map(h => (
                          <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {records.map((rec: any) => {
                        const just  = justMap.get(rec.id);
                        const jStyle = just ? JUST_STYLE[just.status] : null;
                        const jLabel = just ? JUST_LABEL[just.status] : null;
                        return (
                          <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap">{rec.date}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{rec.locationName ?? "—"}</td>
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">{rec.checkIn  ? fmtTime(rec.checkIn)  : "—"}</td>
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">{rec.checkOut ? fmtTime(rec.checkOut) : "—"}</td>
                            <td className="px-4 py-2.5 text-xs whitespace-nowrap">{fmtHours(rec.hoursWorked || 0)}</td>
                            <td className="px-4 py-2.5 text-xs text-blue-600 whitespace-nowrap">{(rec.overtime || 0) > 0 ? fmtHours(rec.overtime) : "—"}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <Badge variant={statusVariant(rec.status)} className="text-xs">
                                {statusLabelAr(rec.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 min-w-[140px]">
                              {just && jStyle && jLabel ? (
                                <div className="space-y-0.5">
                                  <span className={`text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1 ${jStyle}`}>
                                    {just.status === "approved" ? <CheckCircle className="w-2.5 h-2.5" /> :
                                     just.status === "rejected"  ? <XCircle    className="w-2.5 h-2.5" /> :
                                                                   <Clock      className="w-2.5 h-2.5" />}
                                    {jLabel}
                                  </span>
                                  {just.reason && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{just.reason}</p>
                                  )}
                                  {just.adminNote && (
                                    <p className="text-xs text-blue-600">ملاحظة: {just.adminNote}</p>
                                  )}
                                </div>
                              ) : (rec.status === "late" || rec.status === "early_leave") ? (
                                <span className="text-xs text-muted-foreground italic">لم يُقدَّم</span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">
                              {rec.notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Footer totals */}
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                          المجموع
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold">{fmtHours(stats.totalHours)}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-blue-600">{fmtHours(stats.overtime)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </DialogContent>

      <EmailReportDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        defaultEmail={user.email}
        isArabic={true}
        onSend={handleSendEmail}
      />
    </Dialog>
  );
}
