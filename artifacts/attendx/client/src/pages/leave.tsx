import { useState, useRef, useMemo, useCallback } from "react";
import { NoLeaveIllustration } from "@/components/ui/empty-illustrations";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import {
  useListLeave, useCreateLeave, useUpdateLeave, useDeleteLeave,
  useGetMe, getListLeaveQueryKey, getGetMeQueryKey,
} from "@/lib/api-client/index";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import {
  Plus, Check, X, Trash2, Loader2, Calendar, Paperclip, FileText,
  ExternalLink, UploadCloud, CheckCircle2, AlertCircle, WifiOff, RefreshCw,
  BarChart3, ChevronDown, ChevronUp, CalendarDays, PartyPopper, Eye, Pencil,
} from "lucide-react";
import { useHolidays } from "@/pages/holidays";

/* ─── Helpers ─────────────────────────────────── */

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "approved") return "default";
  if (s === "pending")  return "secondary";
  if (s === "rejected") return "destructive";
  return "outline";
}

const DOCUMENT_TYPES = ["sick", "emergency"];

const TYPE_COLORS: Record<string, string> = {
  annual:    "#3b82f6",
  sick:      "#f59e0b",
  emergency: "#ef4444",
  unpaid:    "#8b5cf6",
  other:     "#94a3b8",
};

const STATUS_COLORS: Record<string, string> = {
  pending:  "#f59e0b",
  approved: "#22c55e",
  rejected: "#ef4444",
  cancelled:"#94a3b8",
};

/* ─── Admin Stats Panel ───────────────────────── */

function AdminStatsPanel({ leaves, t }: { leaves: any[]; t: (k: string) => string }) {
  const [open, setOpen] = useState(false);

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leaves) counts[l.type] = (counts[l.type] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [leaves]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const l of leaves) if (counts[l.status] !== undefined) counts[l.status]++;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [leaves]);

  const typeLabels: Record<string, string> = {
    annual: t("annual_leave"), sick: t("sick_leave"),
    emergency: t("emergency_leave"), unpaid: t("unpaid_leave"), other: t("other_leave"),
  };

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    typeData.forEach(({ name }) => {
      cfg[name] = { label: typeLabels[name] ?? name, color: TYPE_COLORS[name] ?? "#94a3b8" };
    });
    return cfg;
  }, [typeData]);

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="w-4 h-4 text-primary" />
          {t("leave_overview")}
          <Badge variant="secondary" className="text-xs ms-1">{leaves.length} {t("total_requests")}</Badge>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border">
          {/* Status summary row */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {statusData.map(({ name, value }) => (
              <div key={name} className="bg-muted/50 rounded-lg px-3 py-2.5 text-center">
                <p className="text-2xl font-bold" style={{ color: STATUS_COLORS[name] }}>{value}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{t(name)}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Pie chart — by type */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t("leave_by_type")}</p>
              {typeData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[160px]">
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${typeLabels[name] ?? name} (${value})`} labelLine={false}>
                      {typeData.map(({ name }) => (
                        <Cell key={name} fill={TYPE_COLORS[name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">{t("no_leave_requests")}</div>
              )}
            </div>

            {/* Bar chart — by status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">{t("leave_by_status")}</p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} barSize={28}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={n => t(n)} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {statusData.map(({ name }) => (
                        <Cell key={name} fill={STATUS_COLORS[name] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Offline Banner ──────────────────────────── */

function OfflineBanner({ queueLen, syncing, t }: { queueLen: number; syncing: boolean; t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/15 border border-amber-400/40 rounded-xl text-amber-700 dark:text-amber-300 text-sm">
      {syncing
        ? <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
        : <WifiOff className="w-4 h-4 flex-shrink-0" />}
      <div>
        <span className="font-semibold">{syncing ? t("syncing") : t("offline_mode")}</span>
        {!syncing && queueLen > 0 && (
          <span className="ms-2 text-xs opacity-80">{queueLen} {t("pending_offline")}</span>
        )}
        {!syncing && queueLen === 0 && (
          <span className="ms-2 text-xs opacity-80">{t("offline_queue_hint")}</span>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────── */

export default function LeavePage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: leaves, isLoading } = useListLeave(undefined, { query: { queryKey: getListLeaveQueryKey() } });
  const { data: holidays } = useHolidays();
  const createMut = useCreateLeave();
  const updateMut = useUpdateLeave();
  const deleteMut = useDeleteLeave();

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewLeave, setViewLeave] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ type: "annual" as string, otherType: "", startDate: "", endDate: "", reason: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [form, setForm] = useState({ type: "annual" as string, otherType: "", startDate: "", endDate: "", reason: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { upload, state: uploadState, progress, objectPath, error: uploadError, reset: resetUpload } = useFileUpload();

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: getListLeaveQueryKey() }), [qc]);

  /* ─── Offline queue ── */
  const handleSync = useCallback(async (item: any) => {
    await createMut.mutateAsync({ data: item.payload });
    refresh();
  }, [createMut, refresh]);

  const { isOnline, queue, syncing, enqueue } = useOfflineQueue(handleSync);

  /* ─── Leave types ── */
  const leaveTypes = [
    { value: "annual",    label: t("annual_leave") },
    { value: "sick",      label: t("sick_leave") },
    { value: "emergency", label: t("emergency_leave") },
    { value: "unpaid",    label: t("unpaid_leave") },
    { value: "other",     label: t("other_leave") },
  ];

  const getLeaveTypeLabel = (type: string) => {
    const found = leaveTypes.find(lt => lt.value === type);
    return found ? found.label : type.replace(/_/g, " ");
  };

  const needsDocument = DOCUMENT_TYPES.includes(form.type);

  /* ─── Holiday overlap check for the selected date range ── */
  const overlappingHolidays = useMemo(() => {
    if (!holidays || !form.startDate || !form.endDate) return [];
    return holidays.filter(h => h.date >= form.startDate && h.date <= form.endDate);
  }, [holidays, form.startDate, form.endDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); resetUpload(); }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null); resetUpload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeDialog = () => {
    setOpen(false);
    setForm({ type: "annual", otherType: "", startDate: "", endDate: "", reason: "" });
    setSelectedFile(null); resetUpload();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = form.type === "other" ? (form.otherType.trim() || "other") : form.type;

    const payload: any = {
      type: finalType,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
    };

    /* Upload document if file selected */
    if (selectedFile && uploadState !== "done") {
      if (!isOnline) {
        toast({ title: t("upload_error"), description: t("offline_mode"), variant: "destructive" });
      } else {
        const docPath = await upload(selectedFile);
        if (!docPath) {
          toast({ title: t("upload_error"), variant: "destructive" });
          return;
        }
        payload.documentPath = docPath;
      }
    } else if (objectPath) {
      payload.documentPath = objectPath;
    }

    /* If offline — queue locally */
    if (!isOnline) {
      enqueue(payload);
      toast({ title: t("offline_mode"), description: t("offline_queue_hint") });
      closeDialog(); refresh();
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? t("failed"));
      }
      toast({ title: t("submit_leave") });
      closeDialog(); refresh();
    } catch (err: any) {
      toast({ title: t("failed"), description: err?.message, variant: "destructive" });
    }
  };

  const [approveDialog, setApproveDialog] = useState<{ id: number; type: string } | null>(null);
  const [approveIsPaid, setApproveIsPaid] = useState<boolean>(true);

  const handleApprove = (id: number, leaveType: string) => {
    // Default: unpaid-type leaves → false, others → true
    setApproveIsPaid(leaveType !== "unpaid");
    setApproveDialog({ id, type: leaveType });
  };

  const confirmApprove = async () => {
    if (!approveDialog) return;
    try {
      await updateMut.mutateAsync({ id: approveDialog.id, data: { status: "approved", isPaid: approveIsPaid } as any });
      toast({ title: t("leave_approved_toast") });
      setApproveDialog(null);
      refresh();
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    }
  };

  const handleStatus = async (id: number, status: "approved" | "rejected" | "cancelled") => {
    try {
      await updateMut.mutateAsync({ id, data: { status } });
      toast({ title: status === "approved" ? t("leave_approved_toast") : t("leave_rejected_toast") });
      refresh();
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteMut.mutateAsync({ id: deleteId });
      toast({ title: "تم الحذف بنجاح" });
      setDeleteId(null);
      refresh();
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
      setDeleteId(null);
    }
  };

  /* ── View / Edit leave ── */
  const openViewLeave = (leave: any) => {
    setViewLeave(leave);
    setEditMode(false);
    const baseType = leaveTypes.find(lt => lt.value === leave.type) ? leave.type : "other";
    setEditForm({
      type: baseType,
      otherType: baseType === "other" ? leave.type : "",
      startDate: leave.startDate ?? "",
      endDate: leave.endDate ?? "",
      reason: leave.reason ?? "",
    });
  };

  const handleEditSave = async () => {
    if (!viewLeave) return;
    setEditLoading(true);
    try {
      const finalType = editForm.type === "other" ? (editForm.otherType.trim() || "other") : editForm.type;
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/leave/${viewLeave.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: finalType,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          reason: editForm.reason,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? t("failed"));
      }
      toast({ title: "✅ تم تعديل الإجازة بنجاح" });
      setViewLeave(null);
      setEditMode(false);
      refresh();
    } catch (err: any) {
      toast({ title: t("failed"), description: err?.message, variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  const isAdmin = me?.role === "admin" || me?.role === "manager";
  const isSubmitting = createMut.isPending || uploadState === "uploading";

  return (
    <Layout>
      <div className="space-y-5 max-w-4xl">

        {/* Offline banner */}
        {(!isOnline || syncing) && (
          <OfflineBanner queueLen={queue.length} syncing={syncing} t={t} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">{t("leave")}</h1>
          <div className="flex items-center gap-2">
            <Link href="/leave/calendar">
              <Button variant="outline" size="sm" className="gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {t("calendar_view")}
              </Button>
            </Link>
            <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-submit-leave">
                  <Plus className="w-4 h-4" /> {t("submit_leave")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>{t("submit_leave_request")}</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 mt-2">

                  {/* Leave Type */}
                  <div className="space-y-1">
                    <Label>{t("leave_type")}</Label>
                    <Select value={form.type} onValueChange={v => { setForm(f => ({ ...f, type: v, otherType: "" })); setSelectedFile(null); resetUpload(); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map(lt => <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Other type */}
                  {form.type === "other" && (
                    <div className="space-y-1">
                      <Label>{t("other_leave_specify")}</Label>
                      <Input value={form.otherType} onChange={e => setForm(f => ({ ...f, otherType: e.target.value }))} placeholder={t("other_leave_specify")} required data-testid="input-leave-other-type" />
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1 min-w-0">
                      <Label>{t("start_date")}</Label>
                      <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required data-testid="input-leave-start" className="w-full" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <Label>{t("end_date")}</Label>
                      <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required data-testid="input-leave-end" className="w-full" />
                    </div>
                  </div>

                  {/* Holiday overlap warning */}
                  {overlappingHolidays.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5" data-testid="warning-holiday-overlap">
                      <PartyPopper className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        {isArabic ? (
                          <>
                            الفترة المحددة تتضمن {overlappingHolidays.length === 1 ? "عطلة رسمية" : `${overlappingHolidays.length} عطل رسمية`}:{" "}
                            {overlappingHolidays.map(h => `${h.name} (${h.date})`).join("، ")} — هذه الأيام مدفوعة تلقائياً ولا تحتاج لطلب إجازة.
                          </>
                        ) : (
                          <>
                            This range includes {overlappingHolidays.length === 1 ? "an official holiday" : `${overlappingHolidays.length} official holidays`}:{" "}
                            {overlappingHolidays.map(h => `${h.name} (${h.date})`).join(", ")} — these days are already paid, no leave request needed.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="space-y-1">
                    <Label>{t("reason")}</Label>
                    <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t("reason") + "..."} data-testid="input-leave-reason" />
                  </div>

                  {/* Document upload (sick/emergency) */}
                  {needsDocument && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" />
                        {t("upload_document_optional")}
                      </Label>
                      {!selectedFile ? (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer">
                          <UploadCloud className="w-7 h-7 text-muted-foreground" />
                          <span className="text-sm font-medium">{t("upload_document")}</span>
                          <span className="text-xs text-muted-foreground text-center">{t("upload_document_hint")}</span>
                        </button>
                      ) : (
                        <div className="border rounded-lg p-3 flex items-center gap-3">
                          <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                            {uploadState === "uploading" && (
                              <div className="mt-1.5 space-y-1">
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-xs text-muted-foreground">{t("uploading")} {progress}%</p>
                              </div>
                            )}
                            {uploadState === "done" && <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3" /> {t("upload_done")}</p>}
                            {uploadState === "error" && <p className="text-xs text-destructive flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" /> {t("upload_error")}</p>}
                          </div>
                          <button type="button" onClick={handleRemoveFile} className="text-muted-foreground hover:text-destructive flex-shrink-0"><X className="w-4 h-4" /></button>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-create-leave">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                    {uploadState === "uploading" ? t("uploading") : t("submit_leave_request")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Admin stats panel */}
        {isAdmin && !isLoading && (leaves?.length ?? 0) > 0 && (
          <AdminStatsPanel leaves={leaves ?? []} t={t} />
        )}

        {/* Leave list */}
        <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-start gap-4">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-md" />
                </div>
              ))}
            </div>
          ) : leaves?.map(leave => (
            <div key={leave.id} className="px-5 py-4 flex items-start gap-4" data-testid={`row-leave-${leave.id}`}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm capitalize">{getLeaveTypeLabel(leave.type)}</p>
                  <Badge variant={statusVariant(leave.status)} className="text-xs capitalize">
                    {leave.status === "approved" ? t("approved") : leave.status === "pending" ? t("pending") : leave.status === "rejected" ? t("rejected") : leave.status}
                  </Badge>
                  {/* Paid / Unpaid badge */}
                  {leave.status === "approved" && (
                    (() => {
                      const lv = leave as any;
                      const isUnpaid = lv.isPaid === false || (lv.isPaid === null && leave.type === "unpaid");
                      return isUnpaid
                        ? <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">غير مدفوعة</Badge>
                        : <Badge variant="outline" className="text-xs border-green-500 text-green-700">مدفوعة</Badge>;
                    })()
                  )}
                  {(leave as any).documentPath && (
                    <a href={(leave as any).documentPath} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText className="w-3 h-3" />{t("view_document")}<ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {isAdmin && <p className="text-xs text-muted-foreground">{leave.userName}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {leave.startDate} → {leave.endDate} · {leave.totalDays} {leave.totalDays !== 1 ? t("working_days") : t("date")}
                </p>
                {leave.reason && <p className="text-xs text-muted-foreground italic">{leave.reason}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" className="text-primary hover:text-primary w-8 h-8" onClick={() => openViewLeave(leave)} title="عرض التفاصيل"><Eye className="w-4 h-4" /></Button>
                {isAdmin && leave.status === "pending" && (
                  <>
                    <Button size="icon" variant="ghost" className="text-green-600 hover:text-green-600 w-8 h-8" onClick={() => handleApprove(leave.id, leave.type)} data-testid={`button-approve-leave-${leave.id}`}><Check className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive w-8 h-8" onClick={() => handleStatus(leave.id, "rejected")} data-testid={`button-reject-leave-${leave.id}`}><X className="w-4 h-4" /></Button>
                  </>
                )}
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive w-8 h-8" onClick={() => setDeleteId(leave.id)} data-testid={`button-delete-leave-${leave.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
          {leaves?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <NoLeaveIllustration />
              <div>
                <p className="font-medium text-sm text-foreground/80">{t("no_leave_requests")}</p>
                <p className="text-xs text-muted-foreground mt-1">لا توجد طلبات إجازة حتى الآن</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Approve dialog with paid/unpaid toggle ── */}
        <Dialog open={approveDialog !== null} onOpenChange={v => { if (!v) setApproveDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                الموافقة على الإجازة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">حدد نوع الإجازة قبل الموافقة:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setApproveIsPaid(true)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${approveIsPaid ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-border text-muted-foreground hover:border-green-300"}`}
                >
                  <span className="text-2xl">💰</span>
                  <span className="font-semibold text-sm">مدفوعة</span>
                  <span className="text-xs text-center opacity-70">تُحسب مع الراتب كأيام مدفوعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setApproveIsPaid(false)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${!approveIsPaid ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700" : "border-border text-muted-foreground hover:border-orange-300"}`}
                >
                  <span className="text-2xl">🚫</span>
                  <span className="font-semibold text-sm">غير مدفوعة</span>
                  <span className="text-xs text-center opacity-70">تُخصم من الراتب</span>
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setApproveDialog(null)}>إلغاء</Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={updateMut.isPending}
                onClick={confirmApprove}
              >
                {updateMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : null}
                موافقة {approveIsPaid ? "(مدفوعة)" : "(غير مدفوعة)"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── View / Edit leave dialog ── */}
        <Dialog open={!!viewLeave} onOpenChange={v => { if (!v) { setViewLeave(null); setEditMode(false); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editMode
                  ? <><Pencil className="w-4 h-4 text-primary" /> تعديل الإجازة</>
                  : <><Eye className="w-4 h-4 text-primary" /> تفاصيل الإجازة</>}
              </DialogTitle>
            </DialogHeader>

            {viewLeave && !editMode && (
              <div className="space-y-4 py-1">
                {/* Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={statusVariant(viewLeave.status)} className="text-sm capitalize">
                    {viewLeave.status === "approved" ? t("approved") : viewLeave.status === "pending" ? t("pending") : viewLeave.status === "rejected" ? t("rejected") : viewLeave.status}
                  </Badge>
                  {viewLeave.status === "approved" && (
                    (() => {
                      const isUnpaid = viewLeave.isPaid === false || (viewLeave.isPaid === null && viewLeave.type === "unpaid");
                      return isUnpaid
                        ? <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">غير مدفوعة</Badge>
                        : <Badge variant="outline" className="text-xs border-green-500 text-green-700">مدفوعة</Badge>;
                    })()
                  )}
                </div>

                {/* Fields */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("leave_type")}</p>
                    <p className="font-medium">{getLeaveTypeLabel(viewLeave.type)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("working_days")}</p>
                    <p className="font-medium">{viewLeave.totalDays}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("start_date")}</p>
                    <p className="font-medium">{viewLeave.startDate}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("end_date")}</p>
                    <p className="font-medium">{viewLeave.endDate}</p>
                  </div>
                </div>

                {viewLeave.reason && (
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{t("reason")}</p>
                    <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{viewLeave.reason}</p>
                  </div>
                )}

                {viewLeave.documentPath && (
                  <a href={viewLeave.documentPath} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <FileText className="w-4 h-4" />{t("view_document")}<ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                {isAdmin && viewLeave.userName && (
                  <p className="text-xs text-muted-foreground border-t pt-2">الموظف: {viewLeave.userName}</p>
                )}

                <div className="flex gap-2 pt-1">
                  {/* Allow editing pending leaves (employees can change their mind) */}
                  {viewLeave.status === "pending" && (
                    <Button size="sm" className="gap-1.5 flex-1" onClick={() => setEditMode(true)}>
                      <Pencil className="w-3.5 h-3.5" /> تعديل الطلب
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setViewLeave(null); setEditMode(false); }}>
                    إغلاق
                  </Button>
                </div>
              </div>
            )}

            {viewLeave && editMode && (
              <div className="space-y-4 py-1">
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  يمكنك تعديل تفاصيل الإجازة. التعديل يعيد الطلب إلى حالة "معلق" للمراجعة.
                </div>

                {/* Leave Type */}
                <div className="space-y-1">
                  <Label>{t("leave_type")}</Label>
                  <Select value={editForm.type} onValueChange={v => setEditForm(f => ({ ...f, type: v, otherType: "" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map(lt => <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {editForm.type === "other" && (
                  <div className="space-y-1">
                    <Label>{t("other_leave_specify")}</Label>
                    <Input value={editForm.otherType} onChange={e => setEditForm(f => ({ ...f, otherType: e.target.value }))} placeholder={t("other_leave_specify")} />
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("start_date")}</Label>
                    <Input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("end_date")}</Label>
                    <Input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} required />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1">
                  <Label>{t("reason")}</Label>
                  <Textarea value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} placeholder={t("reason") + "..."} rows={3} />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditMode(false)} disabled={editLoading}>
                    رجوع
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    disabled={editLoading || !editForm.startDate || !editForm.endDate}
                    onClick={handleEditSave}
                  >
                    {editLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    حفظ التعديلات
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                تأكيد الحذف
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
                إلغاء
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMut.isPending}
                onClick={handleDelete}
              >
                {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1" /> : null}
                حذف
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
