import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";
import {
  Bell, CheckCheck, ExternalLink, UserPlus, Calendar, Clock,
  AlertTriangle, FileText, Camera, Maximize2, X, CheckCircle, XCircle,
  Gift, Minus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { useGetMe } from "@/lib/api-client/index";
import { useToast } from "@/hooks/use-toast";

const TYPE_ICON: Record<string, React.ElementType> = {
  REGISTRATION:       UserPlus,
  LEAVE_REQUEST:      Calendar,
  LATE_CHECKIN:       Clock,
  LATE_JUSTIFICATION: FileText,
  SYSTEM_ALERT:       AlertTriangle,
};

const TYPE_COLOR: Record<string, string> = {
  REGISTRATION:       "text-blue-500",
  LEAVE_REQUEST:      "text-amber-500",
  LATE_CHECKIN:       "text-orange-500",
  LATE_JUSTIFICATION: "text-violet-500",
  SYSTEM_ALERT:       "text-red-500",
};

const TYPE_BG: Record<string, string> = {
  REGISTRATION:       "bg-blue-500/10",
  LEAVE_REQUEST:      "bg-amber-500/10",
  LATE_CHECKIN:       "bg-orange-500/10",
  LATE_JUSTIFICATION: "bg-violet-500/10",
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

export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin";

  const [selectedNotif, setSelectedNotif]   = useState<any | null>(null);
  const [relatedData, setRelatedData]       = useState<any | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [fullImg, setFullImg]               = useState<string | null>(null);

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["notifications-panel"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/notifications"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
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
      if (relatedType === "leave")       url = `/api/leave/${relatedId}`;
      else if (relatedType === "bonus")  url = `/api/bonuses/${relatedId}`;
      else if (relatedType === "work_report") url = `/api/work-reports/${relatedId}`;
      if (!url) return;
      const res = await fetch(apiUrl(url), { headers: authHeaders() });
      if (res.ok) setRelatedData(await res.json());
    } catch { /* ignore */ } finally {
      setLoadingRelated(false);
    }
  }

  async function handleNotifClick(n: any) {
    if (n.status === "unread") markRead(n.id);
    setSelectedNotif(n);
    setRelatedData(null);
    fetchRelated(n);
  }

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
    if (n.relatedType === "work_report") return Camera;
    if (n.relatedType === "bonus")       return Gift;
    if (n.relatedType === "leave")       return Calendar;
    return TYPE_ICON[n.type] ?? Bell;
  }

  function getDetailColor(n: any) {
    if (n.relatedType === "work_report") return { color: "text-primary", bg: "bg-primary/10" };
    if (n.relatedType === "bonus")       return { color: "text-purple-500", bg: "bg-purple-500/10" };
    if (n.relatedType === "leave")       return { color: "text-amber-500", bg: "bg-amber-500/10" };
    return { color: TYPE_COLOR[n.type] ?? "text-muted-foreground", bg: TYPE_BG[n.type] ?? "bg-muted" };
  }

  const typeLabel = (type: string) =>
    t(`notif_type_label_${type}` as any) || type.replace(/_/g, " ");

  const fmt = (n: any) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <div className="flex flex-col max-h-[480px]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{t("notifications")}</span>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 h-5">{unreadCount}</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
              <CheckCheck className="w-3 h-3" /> {t("mark_all_read")}
            </Button>
          )}
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
              const isLeave     = n.relatedType === "leave";
              const isBonus     = n.relatedType === "bonus";
              const isWorkRpt   = n.relatedType === "work_report";
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
                    {(isLeave || isBonus || isWorkRpt) && (
                      <p className="text-xs text-primary mt-0.5">
                        {isLeave ? "📋 اضغط لعرض التفاصيل والمراجعة" : isBonus ? "💰 اضغط لعرض التفاصيل" : "📷 اضغط لعرض الصورة"}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
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

        <div className="px-4 py-2.5 border-t border-border">
          <Link href="/action-center" onClick={onClose}>
            <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-primary hover:text-primary">
              <ExternalLink className="w-3.5 h-3.5" />
              {t("open_action_center")}
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Notification Detail Dialog ── */}
      <Dialog open={!!selectedNotif} onOpenChange={v => { if (!v) { setSelectedNotif(null); setRelatedData(null); } }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {selectedNotif && (() => {
                const Icon = getDetailIcon(selectedNotif);
                const { color, bg } = getDetailColor(selectedNotif);
                return (
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", bg, color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                );
              })()}
              تفاصيل الإشعار
            </DialogTitle>
          </DialogHeader>

          {selectedNotif && (
            <div className="space-y-3 pb-1">

              {/* ═══ LEAVE REQUEST ═══ */}
              {selectedNotif.relatedType === "leave" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <>
                      {/* Status badge */}
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
                        <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                          <p className="text-xs text-muted-foreground">الموظف</p>
                          <p className="text-sm font-semibold">{relatedData.userName}</p>
                        </div>
                      )}

                      {/* Dates */}
                      <div className="bg-muted/40 rounded-lg px-4 py-3 grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">من</p>
                          <p className="text-sm font-medium">{relatedData.startDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">إلى</p>
                          <p className="text-sm font-medium">{relatedData.endDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الأيام</p>
                          <p className="text-sm font-bold text-primary">{relatedData.totalDays}</p>
                        </div>
                      </div>

                      {/* Reason */}
                      {relatedData.reason && (
                        <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">السبب</p>
                          <p className="text-sm leading-relaxed">{relatedData.reason}</p>
                        </div>
                      )}

                      {/* Admin approve/reject */}
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
                        <div className={cn("rounded-lg px-4 py-2 text-center text-sm font-medium", STATUS_COLOR[relatedData.status])}>
                          {STATUS_AR[relatedData.status]}
                          {relatedData.reviewedAt && (
                            <span className="block text-xs font-normal mt-0.5 opacity-75">
                              {new Date(relatedData.reviewedAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">تعذّر تحميل التفاصيل</p>
                  )}
                </>
              )}

              {/* ═══ BONUS / DEDUCTION ═══ */}
              {selectedNotif.relatedType === "bonus" && (
                <>
                  {loadingRelated ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : relatedData ? (
                    <>
                      <div className={cn("rounded-xl px-4 py-4 text-center", relatedData.type === "bonus" ? "bg-green-500/10" : "bg-red-500/10")}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                          {relatedData.type === "bonus"
                            ? <Gift className="w-5 h-5 text-green-600" />
                            : <Minus className="w-5 h-5 text-red-500" />}
                          <span className={cn("font-bold text-lg", relatedData.type === "bonus" ? "text-green-600" : "text-red-500")}>
                            {relatedData.type === "bonus" ? "+" : "−"}{fmt(relatedData.amount)}
                          </span>
                        </div>
                        <Badge variant="outline" className={relatedData.type === "bonus" ? "text-green-600 border-green-300" : "text-red-500 border-red-300"}>
                          {relatedData.type === "bonus" ? "مكافأة" : "خصم"}
                        </Badge>
                      </div>

                      {relatedData.userName && (
                        <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                          <p className="text-xs text-muted-foreground">الموظف</p>
                          <p className="text-sm font-semibold">{relatedData.userName}</p>
                        </div>
                      )}

                      {relatedData.period && (
                        <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                          <p className="text-xs text-muted-foreground">الفترة</p>
                          <p className="text-sm font-medium">{relatedData.period}</p>
                        </div>
                      )}

                      {relatedData.reason && (
                        <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">السبب</p>
                          <p className="text-sm leading-relaxed">{relatedData.reason}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">تعذّر تحميل التفاصيل</p>
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
                    <div className="relative rounded-xl overflow-hidden border border-border group cursor-pointer" onClick={() => setFullImg(relatedData.imageUrl)}>
                      <img src={relatedData.imageUrl} alt={relatedData.note ?? "work report"} className="w-full object-cover max-h-64 group-hover:scale-105 transition-transform duration-200" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2">
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
                  ) : (
                    <div className="aspect-video rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm gap-2">
                      <Camera className="w-5 h-5" />
                      الصورة غير متاحة
                    </div>
                  )}
                </>
              )}

              {/* ═══ DEFAULT (no relatedType) ═══ */}
              {!selectedNotif.relatedType && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs", TYPE_COLOR[selectedNotif.type])}>
                      {typeLabel(selectedNotif.type)}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", selectedNotif.status === "unread" ? "text-primary border-primary/40" : "text-muted-foreground")}>
                      {selectedNotif.status === "unread" ? "● " : ""}{selectedNotif.status}
                    </Badge>
                  </div>
                  <div className="bg-muted/40 rounded-lg px-4 py-3">
                    <p className="text-sm font-medium">{selectedNotif.title}</p>
                  </div>
                  {selectedNotif.message && (
                    <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                      <p className="text-sm text-foreground/90 leading-relaxed">{selectedNotif.message}</p>
                    </div>
                  )}
                </>
              )}

              {/* Title fallback for bonus/leave */}
              {(selectedNotif.relatedType === "leave" || selectedNotif.relatedType === "bonus") && !loadingRelated && relatedData && selectedNotif.message && (
                <div className="bg-muted/10 border border-border/50 rounded-lg px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
                  {selectedNotif.message}
                </div>
              )}

              {/* Date */}
              <p className="text-xs text-muted-foreground text-end">
                🕐 {new Date(selectedNotif.createdAt).toLocaleString()}
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
