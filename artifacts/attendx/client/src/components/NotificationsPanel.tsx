import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";
import {
  Bell, CheckCheck, ExternalLink, UserPlus, Calendar, Clock,
  AlertTriangle, FileText, Camera, Maximize2, X, CheckCircle, XCircle,
  Gift, Minus, Loader2, MapPin, Timer, BadgeCheck, ShieldAlert, MessageSquare, ShoppingBag,
  Banknote, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { useGetMe } from "@/lib/api-client/index";
import { useToast } from "@/hooks/use-toast";

const TYPE_ICON: Record<string, React.ElementType> = {
  REGISTRATION:       UserPlus,
  LEAVE_REQUEST:      Calendar,
  LATE_CHECKIN:       Clock,
  LATE_JUSTIFICATION: FileText,
  EARLY_LEAVE:        Timer,
  OVERTIME_DECISION:  Timer,
  PAYROLL_AUTO_SENT:  Bell,
  SYSTEM_ALERT:       AlertTriangle,
};

const TYPE_COLOR: Record<string, string> = {
  REGISTRATION:       "text-blue-500",
  LEAVE_REQUEST:      "text-amber-500",
  LATE_CHECKIN:       "text-orange-500",
  LATE_JUSTIFICATION: "text-violet-500",
  EARLY_LEAVE:        "text-rose-500",
  OVERTIME_DECISION:  "text-cyan-600",
  PAYROLL_AUTO_SENT:  "text-green-600",
  SYSTEM_ALERT:       "text-red-500",
};

const TYPE_BG: Record<string, string> = {
  REGISTRATION:       "bg-blue-500/10",
  LEAVE_REQUEST:      "bg-amber-500/10",
  LATE_CHECKIN:       "bg-orange-500/10",
  LATE_JUSTIFICATION: "bg-violet-500/10",
  EARLY_LEAVE:        "bg-rose-500/10",
  OVERTIME_DECISION:  "bg-cyan-500/10",
  PAYROLL_AUTO_SENT:  "bg-green-500/10",
  SYSTEM_ALERT:       "bg-red-500/10",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "سنوية", sick: "مرضية", unpaid: "بدون راتب",
  emergency: "طارئة", maternity: "أمومة", other: "أخرى",
};

const STATUS_COLOR: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_AR: Record<string, string> = {
  pending: "بانتظار الموافقة", approved: "مقبول", rejected: "مرفوض",
};

const ATTEND_STATUS_AR: Record<string, string> = {
  present: "حاضر", late: "متأخر", absent: "غائب", excused: "معذور",
};
const ATTEND_STATUS_COLOR: Record<string, string> = {
  present: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  late:    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  absent:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  excused: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const [selectedNotif, setSelectedNotif]       = useState<any | null>(null);
  const [relatedData, setRelatedData]           = useState<any | null>(null);
  const [loadingRelated, setLoadingRelated]     = useState(false);
  const [fullImg, setFullImg]                   = useState<string | null>(null);
  /** Justification associated with an EARLY_LEAVE attendance notification (fetched separately) */
  const [earlyLeaveJustif, setEarlyLeaveJustif] = useState<any | null>(null);

  /* ── Salary advance review form (for notification panel approval) ── */
  const [advanceForm, setAdvanceForm] = useState({
    installments: "1",
    deductionUnit: "month" as "month" | "day",
    deductedPeriod: "",
    deductionStartDate: "",
  });

  /* Period options for monthly deduction (next 12 months) */
  const advancePeriods = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value, label: d.toLocaleString("ar-SY", { month: "long", year: "numeric" }) });
    }
    return opts;
  }, []);

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications-panel"],
    queryFn: async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(apiUrl("/api/notifications"), { headers: authHeaders(), signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return [];
        return res.json();
      } catch { clearTimeout(t); return []; }
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
    gcTime: 120_000,
  });

  const recent = notifications.slice(0, 8);
  const unreadCount = notifications.filter((n: any) => n.status === "unread").length;

  async function markAllRead() {
    await fetch(apiUrl("/api/notifications/mark-all-read"), { method: "POST", headers: authHeaders() });
    qc.invalidateQueries({ queryKey: ["notifications-panel"] });
    qc.invalidateQueries({ queryKey: ["notifications-count"] });
  }

  async function markRead(id: number) {
    await fetch(apiUrl(`/api/notifications/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "read" }),
    });
    qc.invalidateQueries({ queryKey: ["notifications-panel"] });
    qc.invalidateQueries({ queryKey: ["notifications-count"] });
  }

  async function fetchRelated(notif: any) {
    const { relatedType, relatedId } = notif;
    if (!relatedId) return;
    setLoadingRelated(true);
    try {
      let url = "";
      if (relatedType === "leave")              url = `/api/leave/${relatedId}`;
      else if (relatedType === "bonus")         url = `/api/bonuses/${relatedId}`;
      else if (relatedType === "work_report")   url = `/api/work-reports/${relatedId}`;
      else if (relatedType === "request")       url = `/api/requests/${relatedId}`;
      else if (relatedType === "salary_advance") url = `/api/salary-advances/${relatedId}`;
      else if (relatedType === "user")          url = `/api/users/${relatedId}`;
      else if (relatedType === "attendance")    url = `/api/attendance/${relatedId}`;
      else if (relatedType === "late_justification") url = `/api/attendance/justifications/${relatedId}`;
      else if (relatedType === "purchase")            url = `/api/purchases/${relatedId}`;
      if (!url) return;
      const res = await fetch(apiUrl(url), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRelatedData(data);
        // For EARLY_LEAVE attendance notifications, also fetch the employee's justification (if any)
        if (notif.type === "EARLY_LEAVE" && relatedType === "attendance") {
          try {
            const jRes = await fetch(
              apiUrl(`/api/attendance/justifications?attendanceId=${relatedId}&type=early_leave`),
              { headers: authHeaders() }
            );
            if (jRes.ok) {
              const rows = await jRes.json();
              setEarlyLeaveJustif(rows[0] ?? null);
            }
          } catch { /* ignore */ }
        }
        // Pre-fill advance form with the employee's requested installments
        if (relatedType === "salary_advance") {
          setAdvanceForm(f => ({
            ...f,
            installments: String(data.installments ?? 1),
            deductionUnit: data.deductionUnit ?? "month",
            deductedPeriod: data.deductedPeriod ?? "",
            deductionStartDate: data.deductionStartDate ?? "",
          }));
        }
      }
    } catch { /* ignore */ } finally {
      setLoadingRelated(false);
    }
  }

  async function handleNotifClick(n: any) {
    if (n.status === "unread") markRead(n.id);
    setSelectedNotif(n);
    setRelatedData(null);
    setEarlyLeaveJustif(null);
    // Reset salary advance form when opening a new advance notification
    if (n.relatedType === "salary_advance") {
      setAdvanceForm({ installments: "1", deductionUnit: "month", deductedPeriod: "", deductionStartDate: "" });
    }
    fetchRelated(n);
  }

  const [justifAdminNote, setJustifAdminNote] = useState("");

  /* ── Leave approve/reject ── */
  const reviewMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const res = await fetch(apiUrl(`/api/leave/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (updated) => {
      setRelatedData(updated);
      qc.invalidateQueries({ queryKey: ["notifications-panel"] });
      qc.invalidateQueries({ queryKey: ["leave"] });
      toast({ title: updated.status === "approved" ? "✅ تمت الموافقة" : "❌ تم الرفض" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Overtime approve/reject (admin) ── */
  const [overtimeAdminNote, setOvertimeAdminNote] = useState("");
  const overtimeMut = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: "approved" | "rejected"; adminNote?: string }) => {
      const res = await fetch(apiUrl(`/api/attendance/${id}/overtime-approve`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status, adminNote: adminNote?.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "فشلت العملية");
      return res.json();
    },
    onSuccess: (updated) => {
      setRelatedData(updated);
      setOvertimeAdminNote("");
      qc.invalidateQueries({ queryKey: ["notifications-panel"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      toast({ title: updated.overtimeStatus === "approved" ? "✅ تمت الموافقة على الوقت الإضافي" : "❌ تم رفض الوقت الإضافي" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Late Justification approve/reject ── */
  const justifMut = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: "approved" | "rejected"; adminNote?: string }) => {
      const res = await fetch(apiUrl(`/api/attendance/justifications/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status, adminNote: adminNote?.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "فشلت العملية");
      return res.json();
    },
    onSuccess: (updated) => {
      // When reviewing from attendance panel (EARLY_LEAVE), update earlyLeaveJustif; otherwise update relatedData
      if (selectedNotif?.relatedType === "attendance") {
        setEarlyLeaveJustif(updated);
      } else {
        setRelatedData(updated);
      }
      setJustifAdminNote("");
      qc.invalidateQueries({ queryKey: ["notifications-panel"] });
      qc.invalidateQueries({ queryKey: ["admin-justifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      qc.invalidateQueries({ queryKey: ["my-justifications"] });
      toast({ title: updated.status === "approved" ? "✅ تمت الموافقة على التبرير" : "❌ تم رفض التبرير" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  /* ── Salary advance approve/reject (admin) ── */
  const advanceMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const payload: Record<string, any> = { status };
      if (status === "approved") {
        payload.installments  = parseInt(advanceForm.installments) || 1;
        payload.deductionUnit = advanceForm.deductionUnit;
        if (advanceForm.deductionUnit === "month")
          // Default to current month if manager didn't pick one
          payload.deductedPeriod = advanceForm.deductedPeriod || new Date().toISOString().slice(0, 7);
        else if (advanceForm.deductionUnit === "day" && advanceForm.deductionStartDate)
          payload.deductionStartDate = advanceForm.deductionStartDate;
      }
      const res = await fetch(apiUrl(`/api/salary-advances/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "فشلت العملية");
      return res.json();
    },
    onSuccess: (updated) => {
      setRelatedData(updated);
      qc.invalidateQueries({ queryKey: ["notifications-panel"] });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      qc.invalidateQueries({ queryKey: ["notifications-all"] });
      toast({ title: updated.status === "approved" ? "✅ تمت الموافقة على السلفة" : "❌ تم رفض السلفة" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  function getIcon(n: any) {
    if (n.relatedType === "work_report") return Camera;
    if (n.relatedType === "bonus")       return n.type === "SYSTEM_ALERT" ? Gift : AlertTriangle;
    return TYPE_ICON[n.type] ?? Bell;
  }

  function getColor(n: any) {
    if (n.relatedType === "work_report") return "text-primary";
    if (n.relatedType === "bonus")       return "text-purple-500";
    return TYPE_COLOR[n.type] ?? "text-muted-foreground";
  }

  function getDetailIcon(n: any) {
    if (n.relatedType === "work_report")        return Camera;
    if (n.relatedType === "bonus")              return Gift;
    if (n.relatedType === "leave")              return Calendar;
    if (n.relatedType === "attendance")         return Clock;
    if (n.relatedType === "late_justification") return FileText;
    if (n.relatedType === "purchase")           return ShoppingBag;
    if (n.relatedType === "salary_advance")     return Banknote;
    return TYPE_ICON[n.type] ?? Bell;
  }

  function getDetailColor(n: any) {
    if (n.relatedType === "work_report")        return { color: "text-primary",       bg: "bg-primary/10" };
    if (n.relatedType === "bonus")              return { color: "text-purple-500",    bg: "bg-purple-500/10" };
    if (n.relatedType === "leave")              return { color: "text-amber-500",     bg: "bg-amber-500/10" };
    if (n.relatedType === "attendance")         return { color: "text-orange-500",    bg: "bg-orange-500/10" };
    if (n.relatedType === "late_justification") return { color: "text-violet-500",   bg: "bg-violet-500/10" };
    if (n.relatedType === "purchase")           return { color: "text-purple-600",   bg: "bg-purple-500/10" };
    if (n.relatedType === "salary_advance")     return { color: "text-green-600",    bg: "bg-green-500/10" };
    return { color: TYPE_COLOR[n.type] ?? "text-muted-foreground", bg: TYPE_BG[n.type] ?? "bg-muted" };
  }

  const typeLabel = (type: string) =>
    t(`notif_type_label_${type}` as any) || type.replace(/_/g, " ");

  const fmt = (n: any) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" }) : "—";

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("ar-SY", { year: "numeric", month: "long", day: "numeric" }) : "—";

  const KNOWN_DETAIL_TYPES = ["leave", "bonus", "work_report", "attendance", "late_justification", "purchase", "salary_advance"];

  return (
    <>
      <div className="flex flex-col max-h-[520px]">
        {/* ── Redesigned gradient header ── */}
        <div className="relative overflow-hidden px-4 py-3.5 bg-gradient-to-br from-primary/90 to-violet-600 text-white">
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
          <div className="relative flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-bounce">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-none">{t("notifications")}</p>
              <p className="text-xs text-white/70 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} ${t("unread") || "unread"}` : t("no_notifications_short") || "All caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-white hover:bg-white/20 hover:text-white border-0 flex-shrink-0"
                onClick={markAllRead}
              >
                <CheckCheck className="w-3 h-3" /> {t("mark_all_read")}
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {recent.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
              {t("no_notifications")}
            </div>
          ) : (
            recent.map((n: any) => {
              const Icon = getIcon(n);
              const colorClass = getColor(n);
              const isClickable = !!n.relatedId;
              return (
                <button
                  key={n.id}
                  className={cn(
                    "w-full text-start px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors flex gap-3",
                    n.status === "unread" && "bg-primary/5"
                  )}
                  onClick={() => handleNotifClick(n)}
                >
                  <div className={cn("mt-0.5 flex-shrink-0", colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    {isClickable && (
                      <p className="text-xs text-primary mt-0.5">📋 اضغط لعرض التفاصيل الكاملة</p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(n.createdAt).toLocaleString("ar-SY")}
                    </p>
                  </div>
                  {n.status === "unread" && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {isAdmin && (
          <div className="px-4 py-2.5 border-t border-border">
            <Link href="/action-center" onClick={onClose}>
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-primary hover:text-primary">
                <ExternalLink className="w-3.5 h-3.5" />
                {t("open_action_center")}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* ── Notification Detail Dialog ── */}
      <Dialog open={!!selectedNotif} onOpenChange={v => { if (!v) { setSelectedNotif(null); setRelatedData(null); } }}>
        <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-base">
              {selectedNotif && (() => {
                const Icon = getDetailIcon(selectedNotif);
                const { color, bg } = getDetailColor(selectedNotif);
                return (
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", bg, color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                );
              })()}
              <span className="leading-snug">{selectedNotif?.title}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedNotif && (
            <div className="space-y-3 pb-2">

              {/* ── Notification message (always shown) ── */}
              {selectedNotif.message && (
                <div className="bg-muted/40 rounded-xl px-4 py-3">
                  <p className="text-sm leading-relaxed text-foreground/90">{selectedNotif.message}</p>
                </div>
              )}

              {/* ═══ LEAVE REQUEST ═══ */}
              {selectedNotif.relatedType === "leave" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      {/* Status + type */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs", STATUS_COLOR[relatedData.status])}>
                          {STATUS_AR[relatedData.status] ?? relatedData.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs text-amber-600">
                          {LEAVE_TYPE_LABELS[relatedData.type] ?? relatedData.type}
                        </Badge>
                      </div>

                      {/* Employee */}
                      {relatedData.userName && (
                        <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <UserPlus className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الموظف</p>
                            <p className="text-sm font-semibold">{relatedData.userName}</p>
                          </div>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="bg-muted/40 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">من</p>
                          <p className="text-sm font-medium">{relatedData.startDate}</p>
                        </div>
                        <div className="border-x border-border">
                          <p className="text-xs text-muted-foreground mb-1">إلى</p>
                          <p className="text-sm font-medium">{relatedData.endDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">الأيام</p>
                          <p className="text-base font-bold text-primary">{relatedData.totalDays}</p>
                        </div>
                      </div>

                      {/* Reason */}
                      {relatedData.reason && (
                        <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1.5">سبب الإجازة</p>
                          <p className="text-sm leading-relaxed">{relatedData.reason}</p>
                        </div>
                      )}

                      {/* Admin buttons */}
                      {isAdmin && relatedData.status === "pending" && (
                        <div className="flex gap-2 pt-1">
                          <Button
                            className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                            disabled={reviewMut.isPending}
                            onClick={() => reviewMut.mutate({ id: relatedData.id, status: "approved" })}
                          >
                            {reviewMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            موافق
                          </Button>
                          <Button
                            className="flex-1 gap-1.5"
                            size="sm"
                            variant="destructive"
                            disabled={reviewMut.isPending}
                            onClick={() => reviewMut.mutate({ id: relatedData.id, status: "rejected" })}
                          >
                            {reviewMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            رفض
                          </Button>
                        </div>
                      )}

                      {relatedData.status !== "pending" && (
                        <div className={cn("rounded-xl px-4 py-2.5 text-center text-sm font-medium", STATUS_COLOR[relatedData.status])}>
                          {STATUS_AR[relatedData.status]}
                          {relatedData.reviewedAt && (
                            <span className="block text-xs font-normal mt-0.5 opacity-75">
                              {new Date(relatedData.reviewedAt).toLocaleString("ar-SY")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ ATTENDANCE (LATE CHECK-IN) ═══ */}
              {selectedNotif.relatedType === "attendance" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      {/* Status badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs", ATTEND_STATUS_COLOR[relatedData.status])}>
                          {ATTEND_STATUS_AR[relatedData.status] ?? relatedData.status}
                        </Badge>
                        {relatedData.biometricVerified && (
                          <Badge variant="outline" className="text-xs text-green-600 gap-1">
                            <BadgeCheck className="w-3 h-3" /> مصادق بيومتري
                          </Badge>
                        )}
                      </div>

                      {/* Employee */}
                      {relatedData.userName && (
                        <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                            <UserPlus className="w-4 h-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الموظف</p>
                            <p className="text-sm font-semibold">{relatedData.userName}</p>
                          </div>
                        </div>
                      )}

                      {/* Date + times */}
                      <div className="bg-muted/40 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">التاريخ</p>
                          <p className="text-sm font-medium">{relatedData.date}</p>
                        </div>
                        <div className="border-x border-border">
                          <p className="text-xs text-muted-foreground mb-1">الدخول</p>
                          <p className="text-sm font-semibold text-orange-500">{fmtTime(relatedData.checkIn)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">الخروج</p>
                          <p className="text-sm font-medium">{relatedData.checkOut ? fmtTime(relatedData.checkOut) : "—"}</p>
                        </div>
                      </div>

                      {/* Hours + location */}
                      <div className="grid grid-cols-2 gap-2">
                        {relatedData.hoursWorked != null && (
                          <div className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                            <Timer className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">ساعات العمل</p>
                              <p className="text-sm font-semibold">{relatedData.hoursWorked} س</p>
                            </div>
                          </div>
                        )}
                        {relatedData.locationName && (
                          <div className="bg-muted/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground">الموقع</p>
                              <p className="text-sm font-semibold truncate">{relatedData.locationName}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* GPS location card */}
                      {(relatedData.gpsLat != null && relatedData.gpsLng != null) && (
                        <a
                          href={`https://www.google.com/maps?q=${relatedData.gpsLat},${relatedData.gpsLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 hover:bg-blue-500/15 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4 text-blue-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">الموقع الجغرافي عند التسجيل</p>
                            {relatedData.gpsAddress && !/^[\d\s.,،:]+$/.test(relatedData.gpsAddress.replace(/^إحداثيات[:\s]*/,'')) ? (
                              <p className="text-sm font-medium leading-snug text-blue-600 dark:text-blue-400 line-clamp-2">{relatedData.gpsAddress}</p>
                            ) : (
                              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">📍 اضغط لعرض الموقع على الخريطة</p>
                            )}
                            <p className="text-xs text-blue-500/70 mt-0.5">اضغط لفتح في خرائط جوجل ←</p>
                          </div>
                        </a>
                      )}

                      {relatedData.notes && (
                        <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                          <p className="text-sm leading-relaxed">{relatedData.notes}</p>
                        </div>
                      )}

                      {/* ── Early Leave Justification section (only for EARLY_LEAVE notifications) ── */}
                      {selectedNotif.type === "EARLY_LEAVE" && (
                        <div className="bg-orange-500/5 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-orange-600" />
                            <p className="text-sm font-medium text-orange-700 dark:text-orange-300">تبرير الخروج المبكر</p>
                          </div>

                          {earlyLeaveJustif ? (
                            <>
                              {/* Status badge */}
                              <div className="flex items-center gap-2">
                                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[earlyLeaveJustif.status])}>
                                  {STATUS_AR[earlyLeaveJustif.status] ?? earlyLeaveJustif.status}
                                </span>
                              </div>

                              {/* Justification reason */}
                              <div className="bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2">
                                <p className="text-xs text-muted-foreground mb-1">السبب</p>
                                <p className="text-sm leading-relaxed">{earlyLeaveJustif.reason}</p>
                              </div>

                              {/* Admin note if already reviewed */}
                              {earlyLeaveJustif.adminNote && earlyLeaveJustif.status !== "pending" && (
                                <div className="bg-muted/20 rounded-lg px-3 py-2">
                                  <p className="text-xs text-muted-foreground mb-1">ملاحظة المدير</p>
                                  <p className="text-sm">{earlyLeaveJustif.adminNote}</p>
                                </div>
                              )}

                              {/* Approve / Reject (admin, pending only) */}
                              {isAdmin && earlyLeaveJustif.status === "pending" && (
                                <div className="space-y-2 pt-1 border-t border-orange-200 dark:border-orange-800">
                                  <p className="text-xs text-muted-foreground">هل توافق على تبرير الخروج المبكر؟</p>
                                  <div className="relative">
                                    <MessageSquare className="absolute start-3 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                    <Textarea
                                      placeholder="ملاحظة للموظف (اختياري)..."
                                      value={justifAdminNote}
                                      onChange={e => setJustifAdminNote(e.target.value)}
                                      rows={2}
                                      className="resize-none text-sm ps-9"
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                                      size="sm"
                                      disabled={justifMut.isPending}
                                      onClick={() => justifMut.mutate({ id: earlyLeaveJustif.id, status: "approved", adminNote: justifAdminNote })}
                                    >
                                      {justifMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                      موافقة (اعتبار كامل)
                                    </Button>
                                    <Button
                                      className="flex-1 gap-1.5"
                                      size="sm"
                                      variant="destructive"
                                      disabled={justifMut.isPending}
                                      onClick={() => justifMut.mutate({ id: earlyLeaveJustif.id, status: "rejected", adminNote: justifAdminNote })}
                                    >
                                      {justifMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                      رفض
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {earlyLeaveJustif.status !== "pending" && (
                                <div className={cn("rounded-lg px-3 py-2 text-center text-sm font-medium", STATUS_COLOR[earlyLeaveJustif.status])}>
                                  {STATUS_AR[earlyLeaveJustif.status]}
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">لم يتقدم الموظف بتبرير بعد.</p>
                          )}
                        </div>
                      )}

                      {/* ── Overtime section (only for OVERTIME_DECISION notifications) ── */}
                      {selectedNotif.type === "OVERTIME_DECISION" && relatedData.overtime != null && (
                        <div className="bg-cyan-500/5 border border-cyan-200 dark:border-cyan-800 rounded-xl px-4 py-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-cyan-600" />
                            <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                              وقت إضافي: <span className="font-bold">{relatedData.overtime} ساعة</span>
                            </p>
                            {relatedData.overtimeStatus && relatedData.overtimeStatus !== "pending" && (
                              <Badge className={cn("text-xs ms-auto", STATUS_COLOR[relatedData.overtimeStatus])}>
                                {relatedData.overtimeStatus === "approved" ? "✅ موافق عليه" : "❌ مرفوض"}
                              </Badge>
                            )}
                          </div>

                          {/* Admin approve/reject (only when pending) */}
                          {isAdmin && relatedData.overtimeStatus === "pending" && (
                            <div className="space-y-2 pt-1 border-t border-cyan-200 dark:border-cyan-800">
                              <p className="text-xs text-muted-foreground">هل توافق على احتساب هذا الوقت الإضافي؟</p>
                              <div className="relative">
                                <MessageSquare className="absolute start-3 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Textarea
                                  placeholder="ملاحظة للموظف (اختياري)..."
                                  value={overtimeAdminNote}
                                  onChange={e => setOvertimeAdminNote(e.target.value)}
                                  rows={2}
                                  className="resize-none text-sm ps-9"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                                  size="sm"
                                  disabled={overtimeMut.isPending}
                                  onClick={() => overtimeMut.mutate({ id: relatedData.id, status: "approved", adminNote: overtimeAdminNote })}
                                >
                                  {overtimeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                  موافقة على الإضافي
                                </Button>
                                <Button
                                  className="flex-1 gap-1.5"
                                  size="sm"
                                  variant="destructive"
                                  disabled={overtimeMut.isPending}
                                  onClick={() => overtimeMut.mutate({ id: relatedData.id, status: "rejected", adminNote: overtimeAdminNote })}
                                >
                                  {overtimeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                  رفض
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ LATE JUSTIFICATION ═══ */}
              {selectedNotif.relatedType === "late_justification" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      {/* Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs", STATUS_COLOR[relatedData.status])}>
                          {STATUS_AR[relatedData.status] ?? relatedData.status}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${relatedData.type === "early_leave" ? "text-orange-600" : "text-violet-600"}`}>
                          {relatedData.type === "early_leave" ? "تبرير خروج مبكر" : "تبرير تأخر"}
                        </Badge>
                      </div>

                      {/* Employee */}
                      {relatedData.employeeName && (
                        <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${relatedData.type === "early_leave" ? "bg-orange-500/10" : "bg-violet-500/10"}`}>
                            <UserPlus className={`w-4 h-4 ${relatedData.type === "early_leave" ? "text-orange-500" : "text-violet-500"}`} />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الموظف</p>
                            <p className="text-sm font-semibold">{relatedData.employeeName}</p>
                          </div>
                        </div>
                      )}

                      {/* Date + time */}
                      <div className="bg-muted/40 rounded-xl px-4 py-3 grid grid-cols-2 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {relatedData.type === "early_leave" ? "تاريخ الخروج المبكر" : "تاريخ التأخر"}
                          </p>
                          <p className="text-sm font-medium">{relatedData.date}</p>
                        </div>
                        <div className="border-s border-border">
                          <p className="text-xs text-muted-foreground mb-1">
                            {relatedData.type === "early_leave" ? "وقت الخروج" : "وقت الدخول"}
                          </p>
                          <p className="text-sm font-semibold text-orange-500">
                            {relatedData.type === "early_leave"
                              ? fmtTime(relatedData.checkOut)
                              : fmtTime(relatedData.checkIn)}
                          </p>
                        </div>
                      </div>

                      {/* Justification reason */}
                      <div className={`border rounded-xl px-4 py-3 ${relatedData.type === "early_leave" ? "bg-orange-500/5 border-orange-200 dark:border-orange-800" : "bg-violet-500/5 border-violet-200 dark:border-violet-800"}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <FileText className={`w-3.5 h-3.5 ${relatedData.type === "early_leave" ? "text-orange-500" : "text-violet-500"}`} />
                          <p className={`text-xs font-medium ${relatedData.type === "early_leave" ? "text-orange-600 dark:text-orange-400" : "text-violet-600 dark:text-violet-400"}`}>
                            {relatedData.type === "early_leave" ? "سبب الخروج المبكر" : "سبب التأخر"}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed">{relatedData.reason}</p>
                      </div>

                      {/* Admin note (already reviewed) */}
                      {relatedData.adminNote && relatedData.status !== "pending" && (
                        <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">ملاحظة المدير</p>
                          <p className="text-sm leading-relaxed">{relatedData.adminNote}</p>
                        </div>
                      )}

                      {relatedData.reviewedAt && relatedData.status !== "pending" && (
                        <p className="text-xs text-muted-foreground">
                          تمت المراجعة: {new Date(relatedData.reviewedAt).toLocaleString("ar-SY")}
                        </p>
                      )}

                      {/* ── Admin actions for pending justifications ── */}
                      {isAdmin && relatedData.status === "pending" && (
                        <div className="space-y-2 pt-1">
                          <div className="relative">
                            <MessageSquare className="absolute start-3 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                            <Textarea
                              placeholder="ملاحظة للموظف (اختياري)..."
                              value={justifAdminNote}
                              onChange={e => setJustifAdminNote(e.target.value)}
                              rows={2}
                              className="resize-none text-sm ps-9"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                              disabled={justifMut.isPending}
                              onClick={() => justifMut.mutate({ id: relatedData.id, status: "approved", adminNote: justifAdminNote })}
                            >
                              {justifMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              موافقة (اعتبار كامل)
                            </Button>
                            <Button
                              className="flex-1 gap-1.5"
                              size="sm"
                              variant="destructive"
                              disabled={justifMut.isPending}
                              onClick={() => justifMut.mutate({ id: relatedData.id, status: "rejected", adminNote: justifAdminNote })}
                            >
                              {justifMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                              رفض
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Status badge when already resolved */}
                      {relatedData.status !== "pending" && (
                        <div className={cn("rounded-xl px-4 py-2.5 text-center text-sm font-medium", STATUS_COLOR[relatedData.status])}>
                          {STATUS_AR[relatedData.status]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ PURCHASE ═══ */}
              {selectedNotif.relatedType === "purchase" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      <div className="bg-purple-500/10 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-4 text-center">
                        <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                          {Number(relatedData.amount ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">المبلغ</p>
                      </div>
                      {[
                        { label: "الصنف",   value: relatedData.item },
                        { label: "الفئة",   value: relatedData.category },
                        { label: "الفترة",  value: relatedData.period },
                        { label: "الموظف",  value: relatedData.userName },
                      ].filter(r => r.value).map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-sm bg-muted/40 rounded-xl px-4 py-2.5">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                      {relatedData.notes && (
                        <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                          <p className="text-sm leading-relaxed">{relatedData.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ BONUS / DEDUCTION ═══ */}
              {selectedNotif.relatedType === "bonus" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      <div className={cn("rounded-xl px-4 py-5 text-center", relatedData.type === "bonus" ? "bg-green-500/10" : "bg-red-500/10")}>
                        <div className="flex items-center justify-center gap-2 mb-1.5">
                          {relatedData.type === "bonus"
                            ? <Gift className="w-6 h-6 text-green-600" />
                            : <Minus className="w-6 h-6 text-red-500" />}
                          <span className={cn("font-bold text-2xl", relatedData.type === "bonus" ? "text-green-600" : "text-red-500")}>
                            {relatedData.type === "bonus" ? "+" : "−"}{fmt(relatedData.amount)}
                          </span>
                        </div>
                        <Badge variant="outline" className={relatedData.type === "bonus" ? "text-green-600 border-green-300" : "text-red-500 border-red-300"}>
                          {relatedData.type === "bonus" ? "مكافأة" : "خصم"}
                        </Badge>
                      </div>

                      {relatedData.userName && (
                        <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
                          <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <UserPlus className="w-4 h-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الموظف</p>
                            <p className="text-sm font-semibold">{relatedData.userName}</p>
                          </div>
                        </div>
                      )}

                      {relatedData.period && (
                        <div className="bg-muted/40 rounded-xl px-4 py-2.5">
                          <p className="text-xs text-muted-foreground">الفترة</p>
                          <p className="text-sm font-medium">{relatedData.period}</p>
                        </div>
                      )}

                      {relatedData.reason && (
                        <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1.5">السبب</p>
                          <p className="text-sm leading-relaxed">{relatedData.reason}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ WORK REPORT (PHOTO) ═══ */}
              {selectedNotif.relatedType === "work_report" && (
                <>
                  {loadingRelated ? (
                    <div className="aspect-video rounded-xl bg-muted animate-pulse flex items-center justify-center">
                      <Camera className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  ) : relatedData?.imageUrl ? (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden border border-border group cursor-pointer" onClick={() => setFullImg(relatedData.imageUrl)}>
                        <img src={relatedData.imageUrl} alt={relatedData.note ?? "work report"} className="w-full object-cover max-h-72 group-hover:scale-105 transition-transform duration-200" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2.5">
                            <Maximize2 className="w-5 h-5" />
                          </div>
                        </div>
                        {relatedData.note && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <p className="text-white text-xs">{relatedData.note}</p>
                          </div>
                        )}
                        {relatedData.employeeName && (
                          <div className="absolute top-2 start-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                            {relatedData.employeeName}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-center text-muted-foreground">اضغط على الصورة لعرضها بالحجم الكامل</p>
                    </div>
                  ) : (
                    <div className="aspect-video rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm gap-2">
                      <Camera className="w-5 h-5" />
                      الصورة غير متاحة
                    </div>
                  )}
                </>
              )}

              {/* ═══ REGISTRATION / USER ═══ */}
              {selectedNotif.relatedType === "user" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-blue-500/5 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <UserPlus className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{relatedData.name}</p>
                          <p className="text-xs text-muted-foreground">{relatedData.email}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {relatedData.department && (
                          <div className="bg-muted/40 rounded-xl px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">القسم</p>
                            <p className="text-sm font-medium">{relatedData.department}</p>
                          </div>
                        )}
                        {relatedData.position && (
                          <div className="bg-muted/40 rounded-xl px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">المسمى الوظيفي</p>
                            <p className="text-sm font-medium">{relatedData.position}</p>
                          </div>
                        )}
                        {relatedData.phone && (
                          <div className="bg-muted/40 rounded-xl px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">الهاتف</p>
                            <p className="text-sm font-medium">{relatedData.phone}</p>
                          </div>
                        )}
                        {relatedData.role && (
                          <div className="bg-muted/40 rounded-xl px-3 py-2.5">
                            <p className="text-xs text-muted-foreground">الدور</p>
                            <p className="text-sm font-medium capitalize">{relatedData.role}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ SALARY ADVANCE ═══ */}
              {selectedNotif.relatedType === "salary_advance" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <div className="space-y-3">
                      {/* Status + installments badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs", STATUS_COLOR[relatedData.status])}>
                          {STATUS_AR[relatedData.status] ?? relatedData.status}
                        </Badge>
                        {(relatedData.installments ?? 1) > 1 && (
                          <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-300">
                            <CalendarClock className="w-3 h-3" />
                            {relatedData.installments} دفعات شهرية
                          </Badge>
                        )}
                      </div>

                      {/* Employee + Amount */}
                      <div className="flex items-center gap-3 bg-green-500/5 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <Banknote className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">الموظف</p>
                          <p className="text-sm font-semibold">{relatedData.userName}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-muted-foreground">المبلغ</p>
                          <p className="text-xl font-bold text-green-600">{fmt(relatedData.amount)}</p>
                        </div>
                      </div>

                      {/* Requested installments (employee's wish) */}
                      {(relatedData.installments ?? 1) > 1 && relatedData.status === "pending" && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5" />
                            الموظف طلب التقسيم على {relatedData.installments} دفعات شهرية
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                            كل دفعة: {fmt(relatedData.amount / relatedData.installments)}
                          </p>
                        </div>
                      )}

                      {/* Reason */}
                      {relatedData.reason && (
                        <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">السبب</p>
                          <p className="text-sm leading-relaxed">{relatedData.reason}</p>
                        </div>
                      )}

                      {/* ─── Admin review UI (pending only) ─── */}
                      {isAdmin && relatedData.status === "pending" && (
                        <div className="space-y-3 border-t border-border pt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">مراجعة الطلب</p>

                          {/* Deduction unit toggle */}
                          <div className="flex gap-2">
                            <Button size="sm"
                              className={cn("flex-1 text-xs", advanceForm.deductionUnit === "month" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                              onClick={() => setAdvanceForm(f => ({ ...f, deductionUnit: "month" }))}>
                              شهري
                            </Button>
                            <Button size="sm"
                              className={cn("flex-1 text-xs", advanceForm.deductionUnit === "day" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                              onClick={() => setAdvanceForm(f => ({ ...f, deductionUnit: "day" }))}>
                              يومي
                            </Button>
                          </div>

                          {/* Number of installments */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {advanceForm.deductionUnit === "day" ? "عدد الأيام" : "عدد الدفعات"}
                            </p>
                            <Select value={advanceForm.installments} onValueChange={v => setAdvanceForm(f => ({ ...f, installments: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(advanceForm.deductionUnit === "day"
                                  ? [1,3,5,7,10,14,15,20,25,30,45,60,90]
                                  : [1,2,3,4,5,6,7,8,9,10,12,18,24]
                                ).map(n => (
                                  <SelectItem key={n} value={String(n)} className="text-xs">
                                    {n === 1 && advanceForm.deductionUnit === "month"
                                      ? "دفعة واحدة (خصم كامل)"
                                      : `${n} ${advanceForm.deductionUnit === "day" ? "يوم" : "دفعات شهرية"}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {parseInt(advanceForm.installments) > 1 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                كل {advanceForm.deductionUnit === "day" ? "يوم" : "دفعة"}: {fmt(relatedData.amount / parseInt(advanceForm.installments))}
                              </p>
                            )}
                          </div>

                          {/* Start period / start date */}
                          {advanceForm.deductionUnit === "month" ? (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">شهر بدء الخصم</p>
                              <Select value={advanceForm.deductedPeriod} onValueChange={v => setAdvanceForm(f => ({ ...f, deductedPeriod: v }))}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="اختر الشهر..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {advancePeriods.map(p => (
                                    <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">تاريخ بدء الخصم</p>
                              <Input
                                type="date"
                                value={advanceForm.deductionStartDate}
                                onChange={e => setAdvanceForm(f => ({ ...f, deductionStartDate: e.target.value }))}
                                className="h-8 text-xs"
                              />
                            </div>
                          )}

                          {/* Approve / Reject */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                              disabled={advanceMut.isPending}
                              onClick={() => advanceMut.mutate({ id: relatedData.id, status: "approved" })}
                            >
                              {advanceMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              موافق
                            </Button>
                            <Button
                              className="flex-1 gap-1.5"
                              size="sm"
                              variant="destructive"
                              disabled={advanceMut.isPending}
                              onClick={() => advanceMut.mutate({ id: relatedData.id, status: "rejected" })}
                            >
                              {advanceMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                              رفض
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Already reviewed */}
                      {relatedData.status !== "pending" && (
                        <div className="space-y-2">
                          <div className={cn("rounded-xl px-4 py-2.5 text-center text-sm font-medium", STATUS_COLOR[relatedData.status])}>
                            {STATUS_AR[relatedData.status]}
                            {relatedData.reviewedAt && (
                              <span className="block text-xs font-normal mt-0.5 opacity-75">
                                {new Date(relatedData.reviewedAt).toLocaleString("ar-SY")}
                              </span>
                            )}
                          </div>
                          {(relatedData.installments ?? 1) > 1 && (
                            <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs space-y-0.5">
                              <p className="font-semibold flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                                جدول السداد
                              </p>
                              <p className="text-muted-foreground">
                                {relatedData.installments} {relatedData.deductionUnit === "day" ? "أيام" : "دفعات شهرية"} × {fmt(relatedData.amount / relatedData.installments)}
                              </p>
                            </div>
                          )}
                          {relatedData.adminNote && (
                            <div className="bg-muted/20 border border-border rounded-xl px-4 py-3">
                              <p className="text-xs text-muted-foreground mb-1">ملاحظة المدير</p>
                              <p className="text-sm">{relatedData.adminNote}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ DEFAULT / GENERIC ═══ */}
              {!KNOWN_DETAIL_TYPES.includes(selectedNotif.relatedType) && selectedNotif.relatedType !== "user" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs", TYPE_COLOR[selectedNotif.type])}>
                      {typeLabel(selectedNotif.type)}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", selectedNotif.status === "unread" ? "text-primary border-primary/40" : "text-muted-foreground")}>
                      {selectedNotif.status === "unread" ? "● جديد" : "مقروء"}
                    </Badge>
                  </div>

                  {loadingRelated && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  )}

                  {!loadingRelated && relatedData && (
                    <div className="bg-muted/20 border border-border rounded-xl px-4 py-3 space-y-2">
                      {[
                        { label: t("employee") || "الموظف", value: relatedData.userName || relatedData.name },
                        { label: "البريد", value: relatedData.email },
                        { label: t("date") || "التاريخ", value: relatedData.date },
                        { label: t("check_in") || "تسجيل الدخول", value: relatedData.checkIn ? fmtTime(relatedData.checkIn) : null },
                        { label: t("status") || "الحالة", value: relatedData.status },
                        { label: t("location") || "الموقع", value: relatedData.locationName },
                      ].filter(x => x.value).map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                      {relatedData.reason && (
                        <div className="pt-1.5 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-0.5">السبب</p>
                          <p className="text-xs">{relatedData.reason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Timestamp */}
              <p className="text-xs text-muted-foreground text-end pt-1">
                🕐 {new Date(selectedNotif.createdAt).toLocaleString("ar-SY")}
              </p>

              <Button className="w-full" size="sm" onClick={() => { setSelectedNotif(null); setRelatedData(null); }}>
                {t("close")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Full Screen Image Viewer ── */}
      <Dialog open={!!fullImg} onOpenChange={v => { if (!v) setFullImg(null); }}>
        <DialogContent className="max-w-3xl p-2 bg-black border-0">
          <button onClick={() => setFullImg(null)} className="absolute top-3 end-3 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white">
            <X className="w-4 h-4" />
          </button>
          {fullImg && <img src={fullImg} alt="full" className="w-full rounded object-contain max-h-[85vh]" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
