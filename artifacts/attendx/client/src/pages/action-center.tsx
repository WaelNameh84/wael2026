import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@/lib/api-client/index";
import { Redirect } from "wouter";
import {
  Bell, UserPlus, Calendar, Clock, AlertTriangle,
  CheckCircle, XCircle, CheckCheck, Trash2, Filter, RefreshCw,
  FileText, Loader2, Banknote, Timer, Camera, ShoppingBag,
  MapPin, DollarSign, LogOut,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiUrl, authHeaders } from "@/lib/api-url";

function periodOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -1; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: d.toLocaleString("default", { month: "long", year: "numeric" }) });
  }
  return opts;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  REGISTRATION:       UserPlus,
  LEAVE_REQUEST:      Calendar,
  LATE_CHECKIN:       Clock,
  LATE_JUSTIFICATION: FileText,
  EARLY_LEAVE:        LogOut,
  OVERTIME_DECISION:  Timer,
  PAYROLL_AUTO_SENT:  DollarSign,
  SYSTEM_ALERT:       AlertTriangle,
};

const TYPE_COLOR: Record<string, string> = {
  REGISTRATION:       "text-blue-500 bg-blue-500/10",
  LEAVE_REQUEST:      "text-amber-500 bg-amber-500/10",
  LATE_CHECKIN:       "text-orange-500 bg-orange-500/10",
  LATE_JUSTIFICATION: "text-violet-500 bg-violet-500/10",
  EARLY_LEAVE:        "text-rose-500 bg-rose-500/10",
  OVERTIME_DECISION:  "text-cyan-600 bg-cyan-500/10",
  PAYROLL_AUTO_SENT:  "text-green-600 bg-green-500/10",
  SYSTEM_ALERT:       "text-red-500 bg-red-500/10",
};

type FilterTab = "all" | "unread" | "REGISTRATION" | "LEAVE_REQUEST" | "LATE_CHECKIN" | "LATE_JUSTIFICATION";

export default function ActionCenterPage() {
  const { data: me } = useGetMe();
  if (me && me.role !== "admin" && me.role !== "manager") return <Redirect to="/dashboard" />;

  return (
    <Layout>
      <ActionCenterContent />
    </Layout>
  );
}

function fmtTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ActionCenterContent() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [justifyDialog, setJustifyDialog] = useState<any | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Overtime review dialog
  const [overtimeDialog, setOvertimeDialog] = useState<any | null>(null);
  const [overtimeNote, setOvertimeNote] = useState("");
  const [overtimeLoading, setOvertimeLoading] = useState(false);

  // Attendance detail dialog (LATE_CHECKIN / EARLY_LEAVE)
  const [attendanceDialog, setAttendanceDialog] = useState<any | null>(null);

  // Purchase detail dialog
  const [purchaseDialog, setPurchaseDialog] = useState<any | null>(null);

  // Work-report detail dialog
  const [workReportDialog, setWorkReportDialog] = useState<any | null>(null);

  // Leave review dialog
  const [leaveDialog, setLeaveDialog] = useState<{ notifId: number; leaveId: number; data: any | null } | null>(null);
  const [leaveDialogLoading, setLeaveDialogLoading] = useState(false);
  const [leavePaidChoice, setLeavePaidChoice] = useState<"paid" | "unpaid">("paid");

  // Salary advance approval dialog
  const [advanceDialog, setAdvanceDialog] = useState<{ notifId: number; advanceId: number } | null>(null);
  const [advancePeriod, setAdvancePeriod] = useState("");
  const [advanceLoading, setAdvanceLoading] = useState(false);

  // Generic "view" dialog — works for ANY notification, old or new, whether or
  // not it still has a matching action (e.g. the related request/leave/advance
  // was already resolved elsewhere, or it's a notification type with no
  // built-in action). Opening it always marks the notification as read.
  const [viewDialog, setViewDialog] = useState<any | null>(null);

  const periods = periodOptions();
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const { data: notifications = [], isLoading, refetch: refetchNotifications } = useQuery<any[]>({
    queryKey: ["notifications-all"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/notifications"), { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: pendingJustifications = [], refetch: refetchJustifications } = useQuery<any[]>({
    queryKey: ["admin-justifications"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/attendance/justifications"), { headers: authHeaders() });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((j: any) => j.status === "pending");
    },
    refetchInterval: 30_000,
  });

  const unreadCount = notifications.filter((n: any) => n.status === "unread").length;

  const filtered = notifications.filter((n: any) => {
    if (filter === "all") return true;
    if (filter === "unread") return n.status === "unread";
    return n.type === filter;
  });

  async function invalidate() {
    qc.invalidateQueries({ queryKey: ["notifications-all"] });
    qc.invalidateQueries({ queryKey: ["notifications-panel"] });
    qc.invalidateQueries({ queryKey: ["notifications-count"] });
  }

  async function markRead(id: number) {
    await fetch(apiUrl(`/api/notifications/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "read" }),
    });
    invalidate();
  }

  function openView(n: any) {
    if (n.status === "unread") markRead(n.id);
    setViewDialog(n);
  }

  async function archiveNotif(id: number) {
    await fetch(apiUrl(`/api/notifications/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "archived" }),
    });
    invalidate();
  }

  async function markAllRead() {
    await fetch(apiUrl("/api/notifications/mark-all-read"), {
      method: "POST", headers: authHeaders(),
    });
    invalidate();
  }

  async function clearAllNotifications() {
    await fetch(apiUrl("/api/notifications/clear-all"), {
      method: "POST", headers: authHeaders(),
    });
    invalidate();
    toast({ title: isArabic ? "تم حذف جميع الإشعارات" : "All notifications cleared" });
  }

  async function handleApproveUser(notifId: number, userId: number) {
    setActionLoading(`approve-${notifId}`);
    try {
      const res = await fetch(apiUrl(`/api/admin/approve/${userId}`), {
        method: "POST", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await archiveNotif(notifId);
      toast({ title: t("user_approved") });
    } catch {
      toast({ title: t("approval_failed"), variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function handleRejectUser(notifId: number, userId: number) {
    setActionLoading(`reject-${notifId}`);
    try {
      const res = await fetch(apiUrl(`/api/admin/reject/${userId}`), {
        method: "POST", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      await archiveNotif(notifId);
      toast({ title: t("user_rejected") });
    } catch {
      toast({ title: t("approval_failed"), variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function openLeaveReview(notifId: number, leaveId: number) {
    setLeaveDialog({ notifId, leaveId, data: null });
    setLeavePaidChoice("paid");
    try {
      const res = await fetch(apiUrl(`/api/leave/${leaveId}`), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLeaveDialog({ notifId, leaveId, data });
      }
    } catch {}
  }

  async function handleLeaveAction(notifId: number, leaveId: number, action: "approved" | "rejected", isPaid?: boolean) {
    setLeaveDialogLoading(true);
    try {
      const body: any = { status: action };
      if (action === "approved") body.isPaid = isPaid !== false;
      const res = await fetch(apiUrl(`/api/leave/${leaveId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      await archiveNotif(notifId);
      setLeaveDialog(null);
      toast({ title: action === "approved" ? t("leave_approved_toast") : t("leave_rejected_toast") });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    } finally { setLeaveDialogLoading(false); }
  }

  async function handleAdvanceFromDialog(action: "approved" | "rejected") {
    if (!advanceDialog) return;
    setAdvanceLoading(true);
    try {
      const body: any = { status: action };
      if (action === "approved" && advancePeriod) body.deductedPeriod = advancePeriod;
      const res = await fetch(apiUrl(`/api/salary-advances/${advanceDialog.advanceId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await archiveNotif(advanceDialog.notifId);
      setAdvanceDialog(null);
      toast({
        title: action === "approved"
          ? (isArabic ? "✅ تمت الموافقة على السلفة" : "✅ Salary advance approved")
          : (isArabic ? "❌ تم رفض طلب السلفة" : "❌ Salary advance rejected"),
      });
    } catch (e: any) {
      toast({ title: e.message ?? t("error"), variant: "destructive" });
    } finally { setAdvanceLoading(false); }
  }

  async function handleSalaryAdvanceAction(notifId: number, advanceId: number, action: "approved" | "rejected") {
    setActionLoading(`${action}-${notifId}`);
    try {
      const res = await fetch(apiUrl(`/api/salary-advances/${advanceId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? (isArabic ? "فشلت العملية" : "Operation failed"));
      }
      await archiveNotif(notifId);
      toast({
        title: action === "approved"
          ? (isArabic ? "✅ تمت الموافقة على السلفة" : "✅ Salary advance approved")
          : (isArabic ? "❌ تم رفض طلب السلفة" : "❌ Salary advance rejected"),
      });
    } catch (e: any) {
      toast({ title: e.message ?? t("error"), variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function handleRequestAction(notifId: number, requestId: number, action: "approved" | "rejected") {
    setActionLoading(`${action}-${notifId}`);
    try {
      const res = await fetch(apiUrl(`/api/requests/${requestId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? (isArabic ? "فشلت العملية" : "Operation failed"));
      }
      await archiveNotif(notifId);
      toast({
        title: action === "approved"
          ? (isArabic ? "✅ تمت الموافقة على الطلب" : "✅ Request approved")
          : (isArabic ? "❌ تم رفض الطلب" : "❌ Request rejected"),
      });
    } catch (e: any) {
      toast({ title: e.message ?? t("error"), variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function handleReviewJustification(justId: number, decision: "approved" | "rejected") {
    setReviewLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/attendance/justifications/${justId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: decision, adminNote: adminNote.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error ?? (isArabic ? "فشلت العملية" : "Operation failed"));
      }
      toast({
        title: decision === "approved"
          ? (isArabic ? "✅ تمت الموافقة" : "✅ Approved")
          : (isArabic ? "❌ تم الرفض" : "❌ Rejected"),
        description: decision === "approved"
          ? (isArabic ? "تم اعتبار حضور الموظف كاملاً." : "Employee attendance counted as full.")
          : (isArabic ? "تم رفض تبرير التأخر." : "Late justification rejected."),
      });
      setJustifyDialog(null);
      setAdminNote("");
      refetchJustifications();
      invalidate();
    } catch (e: any) {
      toast({ title: e.message ?? t("error"), variant: "destructive" });
    } finally { setReviewLoading(false); }
  }

  async function handleReviewOvertime(attendanceId: number, decision: "approved" | "rejected") {
    setOvertimeLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/attendance/${attendanceId}/overtime-approve`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: decision, adminNote: overtimeNote.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error ?? (isArabic ? "فشلت العملية" : "Operation failed"));
      }
      toast({
        title: decision === "approved"
          ? (isArabic ? "✅ تمت الموافقة على الوقت الإضافي" : "✅ Overtime Approved")
          : (isArabic ? "❌ تم رفض الوقت الإضافي" : "❌ Overtime Rejected"),
      });
      setOvertimeDialog(null);
      setOvertimeNote("");
      invalidate();
    } catch (e: any) {
      toast({ title: e.message ?? t("error"), variant: "destructive" });
    } finally { setOvertimeLoading(false); }
  }

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "all",                label: t("all"),                      count: notifications.length },
    { id: "unread",             label: t("unread"),                   count: unreadCount },
    { id: "REGISTRATION",       label: t("notif_type_registration") ?? (isArabic ? "تسجيل" : "Registrations") },
    { id: "LEAVE_REQUEST",      label: t("notif_type_leave") ?? (isArabic ? "إجازات" : "Leave") },
    { id: "LATE_CHECKIN",       label: t("notif_type_late") ?? (isArabic ? "تأخر" : "Late") },
    { id: "LATE_JUSTIFICATION", label: isArabic ? "تبريرات" : "Justifications" },
  ];

  const typeLabel = (type: string) =>
    t(`notif_type_label_${type}` as any) || type.replace(/_/g, " ");

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            {t("action_center")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("action_center_desc")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => { refetchNotifications(); refetchJustifications(); }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            {t("refresh") ?? (isArabic ? "تحديث" : "Refresh")}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" /> {t("mark_all_read")}
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={clearAllNotifications}
            >
              <Trash2 className="w-4 h-4" />
              {isArabic ? "حذف الكل" : "Clear All"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Pending Justifications Panel ── */}
      {pendingJustifications.length > 0 && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden shadow-sm">
          <div className="bg-violet-600 text-white px-5 py-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="font-bold text-sm">
              {t("notif_pending_justifications") ?? (isArabic ? "تبريرات التأخر المعلقة" : "Pending Late Justifications")}
            </span>
            <span className="ms-auto bg-white/20 text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingJustifications.length}
            </span>
          </div>
          <div className="divide-y divide-border bg-card">
            {pendingJustifications.map((j: any) => (
              <div key={j.id} className="px-5 py-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 text-violet-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{j.employeeName ?? (isArabic ? "موظف" : "Employee")}</p>
                  <p className="text-xs text-muted-foreground">
                    📅 {j.date}
                    {j.checkIn && ` · ${isArabic ? "دخول" : "In"}: ${fmtTime(j.checkIn)}`}
                  </p>
                  <p className="text-sm mt-1.5 text-foreground/90 line-clamp-2 italic">"{j.reason}"</p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 h-8 bg-violet-600 hover:bg-violet-700 text-white border-0 flex-shrink-0"
                  onClick={() => { setJustifyDialog(j); setAdminNote(""); }}
                >
                  {t("notif_review") ?? (isArabic ? "مراجعة" : "Review")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              filter === tab.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            )}
          >
            <Filter className="w-3 h-3" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={cn(
                "rounded-full px-1.5 py-0 text-[10px] tabular-nums",
                filter === tab.id ? "bg-white/20" : "bg-muted"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{t("no_notifications")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((n: any) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              const colorClass = TYPE_COLOR[n.type] ?? "text-muted-foreground bg-muted";
              // Whether one of the specific action buttons below will render for
              // this notification. If none apply — old notification whose related
              // record was already resolved elsewhere, a type with no built-in
              // action, or a missing relatedId — we fall back to a plain "View"
              // button so every notification, no matter how old, stays clickable.
              const hasSpecificAction =
                (n.type === "REGISTRATION" && !!n.relatedId) ||
                (n.type === "LEAVE_REQUEST" && !!n.relatedId) ||
                (n.type === "LATE_JUSTIFICATION" && !!n.relatedId) ||
                (n.type === "OVERTIME_DECISION" && n.relatedType === "attendance" && !!n.relatedId) ||
                (n.type === "EARLY_LEAVE" && !!n.relatedId) ||
                n.type === "LATE_CHECKIN" ||
                n.type === "PAYROLL_AUTO_SENT" ||
                (n.type === "SYSTEM_ALERT" && n.relatedType === "request" && !!n.relatedId) ||
                (n.type === "SYSTEM_ALERT" && n.relatedType === "salary_advance" && !!n.relatedId) ||
                (n.type === "SYSTEM_ALERT" && n.relatedType === "purchase" && !!n.relatedId) ||
                (n.type === "SYSTEM_ALERT" && n.relatedType === "work_report" && !!n.relatedId) ||
                (n.type === "SYSTEM_ALERT" && !["request", "salary_advance", "purchase", "work_report"].includes(n.relatedType) && !n.relatedId);

              return (
                <div key={n.id} className={cn("px-5 py-4 flex gap-4", n.status === "unread" && "bg-primary/[0.03]")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openView(n)}>
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground/60">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                        {n.status === "unread" && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Type label */}
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {typeLabel(n.type)}
                      </Badge>
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {n.type === "REGISTRATION" && n.relatedId && (
                        <>
                          <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white border-0"
                            disabled={actionLoading === `approve-${n.id}`}
                            onClick={() => handleApproveUser(n.id, n.relatedId)}>
                            <CheckCircle className="w-3.5 h-3.5" /> {t("approve")}
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5 h-8"
                            disabled={actionLoading === `reject-${n.id}`}
                            onClick={() => handleRejectUser(n.id, n.relatedId)}>
                            <XCircle className="w-3.5 h-3.5" /> {t("reject")}
                          </Button>
                        </>
                      )}

                      {n.type === "LEAVE_REQUEST" && n.relatedId && (
                        <Button size="sm" className="gap-1.5 h-8 bg-amber-500 hover:bg-amber-600 text-white border-0"
                          onClick={() => openLeaveReview(n.id, n.relatedId)}>
                          <FileText className="w-3.5 h-3.5" />
                          {isArabic ? "مراجعة" : "Review"}
                        </Button>
                      )}

                      {n.type === "LATE_JUSTIFICATION" && n.relatedId && (
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 bg-violet-600 hover:bg-violet-700 text-white border-0"
                          onClick={async () => {
                            markRead(n.id);
                            try {
                              const res = await fetch(apiUrl(`/api/attendance/justifications/${n.relatedId}`), { headers: authHeaders() });
                              if (res.ok) {
                                const data = await res.json();
                                setJustifyDialog(data);
                                setAdminNote(data.adminNote ?? "");
                              }
                            } catch {}
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {isArabic ? "مراجعة التبرير" : "Review Justification"}
                        </Button>
                      )}

                      {n.type === "OVERTIME_DECISION" && n.relatedType === "attendance" && n.relatedId && (
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 bg-cyan-600 hover:bg-cyan-700 text-white border-0"
                          onClick={async () => {
                            markRead(n.id);
                            try {
                              const res = await fetch(apiUrl(`/api/attendance/${n.relatedId}`), { headers: authHeaders() });
                              if (res.ok) {
                                const data = await res.json();
                                setOvertimeDialog({ ...data, notifId: n.id });
                                setOvertimeNote("");
                              }
                            } catch {}
                          }}
                        >
                          <Timer className="w-3.5 h-3.5" />
                          {isArabic ? "مراجعة الوقت الإضافي" : "Review Overtime"}
                        </Button>
                      )}

                      {n.type === "SYSTEM_ALERT" && n.relatedType === "request" && n.relatedId && (
                        <>
                          <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white border-0"
                            disabled={actionLoading === `approved-${n.id}`}
                            onClick={() => handleRequestAction(n.id, n.relatedId, "approved")}>
                            {actionLoading === `approved-${n.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            {t("approve")}
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5 h-8"
                            disabled={actionLoading === `rejected-${n.id}`}
                            onClick={() => handleRequestAction(n.id, n.relatedId, "rejected")}>
                            {actionLoading === `rejected-${n.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            {t("reject")}
                          </Button>
                        </>
                      )}

                      {n.type === "SYSTEM_ALERT" && n.relatedType === "salary_advance" && n.relatedId && (
                        <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white border-0"
                          onClick={() => { setAdvanceDialog({ notifId: n.id, advanceId: n.relatedId }); setAdvancePeriod(currentPeriod); }}>
                          <Banknote className="w-3.5 h-3.5" />
                          {isArabic ? "مراجعة السلفة" : "Review Advance"}
                        </Button>
                      )}

                      {/* EARLY_LEAVE → view attendance details */}
                      {n.type === "EARLY_LEAVE" && n.relatedId && (
                        <Button size="sm" className="gap-1.5 h-8 bg-rose-600 hover:bg-rose-700 text-white border-0"
                          onClick={async () => {
                            markRead(n.id);
                            try {
                              const res = await fetch(apiUrl(`/api/attendance/${n.relatedId}`), { headers: authHeaders() });
                              if (res.ok) setAttendanceDialog({ ...(await res.json()), _notifType: "EARLY_LEAVE", notifId: n.id });
                            } catch {}
                          }}>
                          <LogOut className="w-3.5 h-3.5" />
                          {isArabic ? "عرض المغادرة المبكرة" : "View Early Leave"}
                        </Button>
                      )}

                      {/* LATE_CHECKIN → view attendance details */}
                      {n.type === "LATE_CHECKIN" && n.relatedId && (
                        <Button size="sm" className="gap-1.5 h-8 bg-orange-500 hover:bg-orange-600 text-white border-0"
                          onClick={async () => {
                            markRead(n.id);
                            try {
                              const res = await fetch(apiUrl(`/api/attendance/${n.relatedId}`), { headers: authHeaders() });
                              if (res.ok) setAttendanceDialog({ ...(await res.json()), _notifType: "LATE_CHECKIN", notifId: n.id });
                            } catch {}
                          }}>
                          <Clock className="w-3.5 h-3.5" />
                          {isArabic ? "عرض تفاصيل التأخر" : "View Late Details"}
                        </Button>
                      )}

                      {/* LATE_CHECKIN (no relatedId) or generic SYSTEM_ALERT dismiss */}
                      {(n.type === "LATE_CHECKIN" && !n.relatedId) && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8"
                          onClick={() => { markRead(n.id); archiveNotif(n.id); }}>
                          {isArabic ? "إغلاق" : "Dismiss"}
                        </Button>
                      )}

                      {/* PAYROLL_AUTO_SENT → dismiss */}
                      {n.type === "PAYROLL_AUTO_SENT" && (
                        <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white border-0"
                          onClick={() => { markRead(n.id); archiveNotif(n.id); }}>
                          <CheckCheck className="w-3.5 h-3.5" />
                          {isArabic ? "تم الاستلام" : "Acknowledged"}
                        </Button>
                      )}

                      {/* SYSTEM_ALERT (purchase) → view purchase details */}
                      {n.type === "SYSTEM_ALERT" && n.relatedType === "purchase" && n.relatedId && (
                        <Button size="sm" className="gap-1.5 h-8 bg-purple-600 hover:bg-purple-700 text-white border-0"
                          onClick={async () => {
                            markRead(n.id);
                            try {
                              const res = await fetch(apiUrl(`/api/purchases/${n.relatedId}`), { headers: authHeaders() });
                              if (res.ok) setPurchaseDialog({ ...(await res.json()), notifId: n.id });
                            } catch {}
                          }}>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {isArabic ? "عرض المشتريات" : "View Purchase"}
                        </Button>
                      )}

                      {/* SYSTEM_ALERT (work_report) → view photo */}
                      {n.type === "SYSTEM_ALERT" && n.relatedType === "work_report" && n.relatedId && (
                        <Button size="sm" className="gap-1.5 h-8 bg-primary hover:bg-primary/90 text-white border-0"
                          onClick={async () => {
                            markRead(n.id);
                            try {
                              const res = await fetch(apiUrl(`/api/work-reports/${n.relatedId}`), { headers: authHeaders() });
                              if (res.ok) setWorkReportDialog({ ...(await res.json()), notifId: n.id });
                            } catch {}
                          }}>
                          <Camera className="w-3.5 h-3.5" />
                          {isArabic ? "عرض التوثيق" : "View Report"}
                        </Button>
                      )}

                      {/* Generic SYSTEM_ALERT dismiss (no relatedId) */}
                      {(n.type === "SYSTEM_ALERT" && !["request", "salary_advance", "purchase", "work_report"].includes(n.relatedType) && !n.relatedId) && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8"
                          onClick={() => { markRead(n.id); archiveNotif(n.id); }}>
                          {isArabic ? "إغلاق" : "Dismiss"}
                        </Button>
                      )}

                      {!hasSpecificAction && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8"
                          onClick={() => openView(n)}>
                          <Bell className="w-3.5 h-3.5" />
                          {isArabic ? "عرض الإشعار" : "View"}
                        </Button>
                      )}

                      <Button size="sm" variant="ghost"
                        className="gap-1.5 h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => archiveNotif(n.id)} title={t("archive")}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Leave Review Dialog ── */}
      <Dialog open={!!leaveDialog} onOpenChange={v => { if (!v) setLeaveDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Calendar className="w-5 h-5" />
              {isArabic ? "مراجعة طلب الإجازة" : "Review Leave Request"}
            </DialogTitle>
          </DialogHeader>

          {leaveDialog && (
            <div className="space-y-4 py-1">
              {/* Details */}
              {leaveDialog.data === null ? (
                <div className="flex items-center gap-3 text-muted-foreground py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{isArabic ? "جارٍ تحميل التفاصيل..." : "Loading details..."}</span>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isArabic ? "الموظف" : "Employee"}</span>
                    <span className="text-sm font-semibold">{leaveDialog.data.userName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isArabic ? "نوع الإجازة" : "Leave Type"}</span>
                    <span className="text-sm font-medium capitalize">{leaveDialog.data.type ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isArabic ? "من" : "From"}</span>
                    <span className="text-sm">{leaveDialog.data.startDate ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isArabic ? "إلى" : "To"}</span>
                    <span className="text-sm">{leaveDialog.data.endDate ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{isArabic ? "عدد الأيام" : "Total Days"}</span>
                    <span className="text-sm font-bold text-primary">{leaveDialog.data.totalDays ?? "—"}</span>
                  </div>
                  {leaveDialog.data.reason && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">{isArabic ? "السبب" : "Reason"}</p>
                      <p className="text-sm italic">"{leaveDialog.data.reason}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* Paid / Unpaid selector */}
              <div className="space-y-1.5">
                <Label>{isArabic ? "نوع الموافقة" : "Approval Type"}</Label>
                <Select value={leavePaidChoice} onValueChange={v => setLeavePaidChoice(v as "paid" | "unpaid")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">
                      {isArabic ? "✅ موافقة مع الراتب (إجازة مدفوعة)" : "✅ Approve with Pay (Paid Leave)"}
                    </SelectItem>
                    <SelectItem value="unpaid">
                      {isArabic ? "⚠️ موافقة بدون راتب (إجازة غير مدفوعة)" : "⚠️ Approve without Pay (Unpaid Leave)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {leavePaidChoice === "unpaid" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {isArabic ? "سيتم خصم هذه الأيام من الراتب." : "These days will be deducted from salary."}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setLeaveDialog(null)} disabled={leaveDialogLoading}>
              {t("cancel")}
            </Button>
            <Button
              size="sm" variant="destructive" className="gap-1.5"
              disabled={leaveDialogLoading || !leaveDialog?.data}
              onClick={() => leaveDialog && handleLeaveAction(leaveDialog.notifId, leaveDialog.leaveId, "rejected")}
            >
              {leaveDialogLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {t("reject")}
            </Button>
            <Button
              size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
              disabled={leaveDialogLoading || !leaveDialog?.data}
              onClick={() => leaveDialog && handleLeaveAction(leaveDialog.notifId, leaveDialog.leaveId, "approved", leavePaidChoice === "paid")}
            >
              {leaveDialogLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {isArabic
                ? (leavePaidChoice === "paid" ? "موافقة مع راتب" : "موافقة بدون راتب")
                : (leavePaidChoice === "paid" ? "Approve (Paid)" : "Approve (Unpaid)")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Attendance Detail Dialog (LATE_CHECKIN / EARLY_LEAVE) ══ */}
      <Dialog open={!!attendanceDialog} onOpenChange={v => { if (!v) setAttendanceDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {attendanceDialog?._notifType === "EARLY_LEAVE"
                ? <><LogOut className="w-5 h-5 text-rose-500" />{isArabic ? "تفاصيل المغادرة المبكرة" : "Early Leave Details"}</>
                : <><Clock className="w-5 h-5 text-orange-500" />{isArabic ? "تفاصيل التأخر" : "Late Check-in Details"}</>}
            </DialogTitle>
          </DialogHeader>
          {attendanceDialog && (
            <div className="space-y-3 py-1">
              {attendanceDialog.userName && (
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                  <UserPlus className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{isArabic ? "الموظف" : "Employee"}</p>
                    <p className="text-sm font-semibold">{attendanceDialog.userName}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 bg-muted/40 rounded-lg px-4 py-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{isArabic ? "التاريخ" : "Date"}</p>
                  <p className="text-xs font-medium">{attendanceDialog.date}</p>
                </div>
                <div className="border-x border-border">
                  <p className="text-xs text-muted-foreground mb-1">{isArabic ? "الدخول" : "In"}</p>
                  <p className="text-xs font-semibold text-orange-500">
                    {attendanceDialog.checkIn ? fmtTime(attendanceDialog.checkIn) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{isArabic ? "الخروج" : "Out"}</p>
                  <p className="text-xs font-medium">
                    {attendanceDialog.checkOut ? fmtTime(attendanceDialog.checkOut) : "—"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {attendanceDialog.hoursWorked != null && (
                  <div className="bg-muted/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isArabic ? "ساعات العمل" : "Hours"}</p>
                      <p className="text-sm font-semibold">{attendanceDialog.hoursWorked} {isArabic ? "س" : "h"}</p>
                    </div>
                  </div>
                )}
                {attendanceDialog.locationName && (
                  <div className="bg-muted/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{isArabic ? "الموقع" : "Location"}</p>
                      <p className="text-xs font-semibold truncate">{attendanceDialog.locationName}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAttendanceDialog(null)}>{t("close")}</Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { if (attendanceDialog) archiveNotif(attendanceDialog.notifId); setAttendanceDialog(null); }}>
              <Trash2 className="w-3.5 h-3.5" />{isArabic ? "أرشفة" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Purchase Detail Dialog ══ */}
      <Dialog open={!!purchaseDialog} onOpenChange={v => { if (!v) setPurchaseDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <ShoppingBag className="w-5 h-5" />
              {isArabic ? "تفاصيل المشتريات" : "Purchase Details"}
            </DialogTitle>
          </DialogHeader>
          {purchaseDialog && (
            <div className="space-y-3 py-1">
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-4 text-center">
                <p className="text-2xl font-bold text-purple-700">{Number(purchaseDialog.amount ?? 0).toLocaleString()}</p>
                <p className="text-xs text-purple-600 mt-0.5">{isArabic ? "المبلغ" : "Amount"}</p>
              </div>
              {[
                { label: isArabic ? "الصنف" : "Item", value: purchaseDialog.item },
                { label: isArabic ? "الفئة" : "Category", value: purchaseDialog.category },
                { label: isArabic ? "الفترة" : "Period", value: purchaseDialog.period },
                { label: isArabic ? "الموظف" : "Employee", value: purchaseDialog.userName },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm bg-muted/40 rounded-lg px-4 py-2.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              {purchaseDialog.notes && (
                <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{isArabic ? "ملاحظات" : "Notes"}</p>
                  <p className="text-sm">{purchaseDialog.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPurchaseDialog(null)}>{t("close")}</Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { if (purchaseDialog) archiveNotif(purchaseDialog.notifId); setPurchaseDialog(null); }}>
              <Trash2 className="w-3.5 h-3.5" />{isArabic ? "أرشفة" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ Work Report Detail Dialog ══ */}
      <Dialog open={!!workReportDialog} onOpenChange={v => { if (!v) setWorkReportDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Camera className="w-5 h-5" />
              {isArabic ? "توثيق العمل" : "Work Report"}
            </DialogTitle>
          </DialogHeader>
          {workReportDialog && (
            <div className="space-y-3 py-1">
              {workReportDialog.employeeName && (
                <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                  <UserPlus className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{isArabic ? "الموظف" : "Employee"}</p>
                    <p className="text-sm font-semibold">{workReportDialog.employeeName}</p>
                  </div>
                </div>
              )}
              {workReportDialog.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={workReportDialog.imageUrl} alt="work report" className="w-full object-cover max-h-64" />
                </div>
              ) : (
                <div className="aspect-video rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground gap-2 text-sm">
                  <Camera className="w-5 h-5" />
                  {isArabic ? "الصورة غير متاحة" : "Image unavailable"}
                </div>
              )}
              {workReportDialog.note && (
                <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{isArabic ? "الملاحظة" : "Note"}</p>
                  <p className="text-sm">{workReportDialog.note}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground text-end">
                {workReportDialog.createdAt ? new Date(workReportDialog.createdAt).toLocaleString() : ""}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setWorkReportDialog(null)}>{t("close")}</Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { if (workReportDialog) archiveNotif(workReportDialog.notifId); setWorkReportDialog(null); }}>
              <Trash2 className="w-3.5 h-3.5" />{isArabic ? "أرشفة" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generic Notification View Dialog — works for any notification,
           even old ones with no matching action or an already-resolved
           related record. Always lets the manager see the full content. ── */}
      <Dialog open={!!viewDialog} onOpenChange={v => { if (!v) setViewDialog(null); }}>
        <DialogContent className="max-w-md">
          {viewDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => { const Icon = TYPE_ICON[viewDialog.type] ?? Bell; return <Icon className="w-5 h-5 text-primary" />; })()}
                  {viewDialog.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{viewDialog.message}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">{typeLabel(viewDialog.type)}</Badge>
                  <span>{new Date(viewDialog.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewDialog(null)}>
                  {isArabic ? "إغلاق" : "Close"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => { archiveNotif(viewDialog.id); setViewDialog(null); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                  {isArabic ? "أرشفة" : "Archive"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Salary Advance Approval Dialog ── */}
      <Dialog open={!!advanceDialog} onOpenChange={v => { if (!v) setAdvanceDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Banknote className="w-5 h-5" />
              {isArabic ? "مراجعة طلب السلفة" : "Review Salary Advance"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>{isArabic ? "فترة خصم السلفة من الراتب" : "Deduct from Payroll Period"}</Label>
              <Select value={advancePeriod} onValueChange={setAdvancePeriod}>
                <SelectTrigger>
                  <SelectValue placeholder={isArabic ? "اختر الشهر" : "Select month"} />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isArabic
                  ? "اختر الشهر الذي سيُخصم منه مبلغ السلفة تلقائياً عند احتساب الراتب."
                  : "Choose the month this advance will be automatically deducted from payroll."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdvanceDialog(null)} disabled={advanceLoading}>
              {t("cancel")}
            </Button>
            <Button
              size="sm" variant="destructive" className="gap-1.5"
              disabled={advanceLoading}
              onClick={() => handleAdvanceFromDialog("rejected")}
            >
              {advanceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {t("reject")}
            </Button>
            <Button
              size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
              disabled={advanceLoading || !advancePeriod}
              onClick={() => handleAdvanceFromDialog("approved")}
            >
              {advanceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {isArabic ? "موافقة" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Justification Review Dialog ── */}
      {/* ══ Overtime Review Dialog ══ */}
      <Dialog open={!!overtimeDialog} onOpenChange={v => { if (!v) { setOvertimeDialog(null); setOvertimeNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-700">
              <Timer className="w-5 h-5" />
              {isArabic ? "مراجعة طلب الوقت الإضافي" : "Review Overtime Request"}
            </DialogTitle>
          </DialogHeader>
          {overtimeDialog && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-1">
                <p className="text-sm font-semibold">{overtimeDialog.userName}</p>
                <p className="text-xs text-muted-foreground">
                  📅 {isArabic ? "التاريخ" : "Date"}: {overtimeDialog.date}
                  {overtimeDialog.checkIn && ` · ${isArabic ? "دخول" : "In"}: ${fmtTime(overtimeDialog.checkIn)}`}
                  {overtimeDialog.checkOut && ` · ${isArabic ? "خروج" : "Out"}: ${fmtTime(overtimeDialog.checkOut)}`}
                </p>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <Timer className="w-5 h-5 text-cyan-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-cyan-700 font-semibold">
                    {isArabic ? "ساعات الوقت الإضافي" : "Overtime Hours"}
                  </p>
                  <p className="text-lg font-bold text-cyan-800">
                    {overtimeDialog.overtime} {isArabic ? "ساعة" : "hrs"}
                  </p>
                </div>
              </div>
              {overtimeDialog.overtimeStatus && overtimeDialog.overtimeStatus !== "pending" && (
                <div className={cn("rounded-lg px-4 py-2.5 text-center text-sm font-medium",
                  overtimeDialog.overtimeStatus === "approved"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                )}>
                  {overtimeDialog.overtimeStatus === "approved"
                    ? (isArabic ? "✅ تمت الموافقة مسبقاً" : "✅ Already Approved")
                    : (isArabic ? "❌ تم الرفض مسبقاً" : "❌ Already Rejected")}
                </div>
              )}
              {(!overtimeDialog.overtimeStatus || overtimeDialog.overtimeStatus === "pending") && (
                <div className="space-y-1.5">
                  <Label htmlFor="overtime-note">
                    {isArabic ? "ملاحظة (اختياري)" : "Note (optional)"}
                  </Label>
                  <Textarea
                    id="overtime-note"
                    placeholder={isArabic ? "أضف تعليقاً للموظف..." : "Add a comment for the employee..."}
                    value={overtimeNote}
                    onChange={e => setOvertimeNote(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setOvertimeDialog(null); setOvertimeNote(""); }}>
              {t("cancel")}
            </Button>
            {overtimeDialog && (!overtimeDialog.overtimeStatus || overtimeDialog.overtimeStatus === "pending") && (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  disabled={overtimeLoading}
                  onClick={() => handleReviewOvertime(overtimeDialog.id, "rejected")}
                >
                  {overtimeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  {t("reject")}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                  disabled={overtimeLoading}
                  onClick={() => handleReviewOvertime(overtimeDialog.id, "approved")}
                >
                  {overtimeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {isArabic ? "موافقة على الإضافي" : "Approve Overtime"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!justifyDialog} onOpenChange={v => { if (!v) setJustifyDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-700">
              <FileText className="w-5 h-5" />
              {isArabic ? "مراجعة تبرير التأخر" : "Review Late Justification"}
            </DialogTitle>
          </DialogHeader>
          {justifyDialog && (
            <div className="space-y-4 py-1">
              <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-1">
                <p className="text-sm font-semibold">{justifyDialog.employeeName}</p>
                <p className="text-xs text-muted-foreground">
                  📅 {isArabic ? "التاريخ" : "Date"}: {justifyDialog.date}
                  {justifyDialog.checkIn && ` · ${isArabic ? "دخول" : "In"}: ${fmtTime(justifyDialog.checkIn)}`}
                </p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-violet-700 mb-1">
                  {t("late_reason") ?? (isArabic ? "سبب التأخر" : "Reason for Late")}:
                </p>
                <p className="text-sm text-foreground/90">"{justifyDialog.reason}"</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-xs text-green-800">
                {t("approval_on_approve_info") ?? (isArabic
                  ? "عند الموافقة: سيُحتسب حضور الموظف كاملاً (لن يخصم أي دقيقة تأخر)."
                  : "On approval: employee attendance will be counted as full (no late deduction)."
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-note">
                  {t("approval_note_optional") ?? (isArabic ? "ملاحظة (اختياري)" : "Note (optional)")}
                </Label>
                <Textarea
                  id="admin-note"
                  placeholder={t("approval_note_placeholder") ?? (isArabic
                    ? "أضف تعليقاً اختيارياً للموظف..."
                    : "Add an optional comment for the employee..."
                  )}
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setJustifyDialog(null)}>
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={reviewLoading}
              onClick={() => handleReviewJustification(justifyDialog.id, "rejected")}
            >
              {reviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {t("reject")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
              disabled={reviewLoading}
              onClick={() => handleReviewJustification(justifyDialog.id, "approved")}
            >
              {reviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {t("approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
