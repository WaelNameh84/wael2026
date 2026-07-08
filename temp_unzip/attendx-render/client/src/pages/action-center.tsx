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
  FileText, Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiUrl, authHeaders } from "@/lib/api-url";

const TYPE_ICON: Record<string, React.ElementType> = {
  REGISTRATION:       UserPlus,
  LEAVE_REQUEST:      Calendar,
  LATE_CHECKIN:       Clock,
  LATE_JUSTIFICATION: FileText,
  SYSTEM_ALERT:       AlertTriangle,
};

const TYPE_COLOR: Record<string, string> = {
  REGISTRATION:       "text-blue-500 bg-blue-500/10",
  LEAVE_REQUEST:      "text-amber-500 bg-amber-500/10",
  LATE_CHECKIN:       "text-orange-500 bg-orange-500/10",
  LATE_JUSTIFICATION: "text-violet-500 bg-violet-500/10",
  SYSTEM_ALERT:       "text-red-500 bg-red-500/10",
};

type FilterTab = "all" | "unread" | "REGISTRATION" | "LEAVE_REQUEST" | "LATE_CHECKIN" | "LATE_JUSTIFICATION";

export default function ActionCenterPage() {
  const { data: me } = useGetMe();
  if (me && me.role !== "admin") return <Redirect to="/dashboard" />;

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

  async function handleLeaveAction(notifId: number, leaveId: number, action: "approved" | "rejected") {
    setActionLoading(`${action}-${notifId}`);
    try {
      const res = await fetch(apiUrl(`/api/leave/${leaveId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) throw new Error();
      await archiveNotif(notifId);
      toast({ title: action === "approved" ? t("leave_approved_toast") : t("leave_rejected_toast") });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
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

              return (
                <div key={n.id} className={cn("px-5 py-4 flex gap-4", n.status === "unread" && "bg-primary/[0.03]")}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
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
                        <>
                          <Button size="sm" className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white border-0"
                            disabled={actionLoading === `approved-${n.id}`}
                            onClick={() => handleLeaveAction(n.id, n.relatedId, "approved")}>
                            <CheckCircle className="w-3.5 h-3.5" /> {t("approve")}
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1.5 h-8"
                            disabled={actionLoading === `rejected-${n.id}`}
                            onClick={() => handleLeaveAction(n.id, n.relatedId, "rejected")}>
                            <XCircle className="w-3.5 h-3.5" /> {t("reject")}
                          </Button>
                        </>
                      )}

                      {n.type === "LATE_JUSTIFICATION" && n.relatedId && (
                        <Badge variant="outline" className="text-violet-600 border-violet-300 text-xs">
                          {isArabic ? "تبرير تأخر" : "Late Justification"}
                        </Badge>
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

                      {(n.type === "LATE_CHECKIN" || (n.type === "SYSTEM_ALERT" && !(n.relatedType === "request" && n.relatedId))) && (
                        <Button size="sm" variant="outline" className="gap-1.5 h-8"
                          onClick={() => { markRead(n.id); archiveNotif(n.id); }}>
                          {isArabic ? "إغلاق" : "Dismiss"}
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

      {/* ── Justification Review Dialog ── */}
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
