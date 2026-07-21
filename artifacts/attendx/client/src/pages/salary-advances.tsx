import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { formatCurrency } from "@/lib/format-currency";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@/lib/api-client/index";
import { NoPayrollIllustration } from "@/components/ui/empty-illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { Banknote, Plus, CheckCircle, XCircle, Clock, Loader2, Trash2, User, CalendarClock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type SalaryAdvance = {
  id: number;
  userId: number;
  userName: string;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  reviewedAt: string | null;
  deductedPeriod: string | null;
  installments: number;
  deductionUnit: "month" | "day";
  deductionStartDate: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
const STATUS_AR: Record<string, string> = {
  pending: "بانتظار الموافقة", approved: "مقبول", rejected: "مرفوض",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock, approved: CheckCircle, rejected: XCircle,
};

function periodOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: d.toLocaleString("ar-SY", { month: "long", year: "numeric" }) });
  }
  return opts;
}

/** Return YYYY-MM that is `offset` months ahead of `startPeriod` */
function addMonths(startPeriod: string, offset: number): string {
  const [y, m] = startPeriod.split("-").map(Number);
  const total  = y * 12 + m + offset;
  const yr     = Math.floor((total - 1) / 12);
  const mo     = ((total - 1) % 12) + 1;
  return `${yr}-${String(mo).padStart(2, "0")}`;
}

/** Human-readable period label */
function periodLabel(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("ar-SY", { month: "long", year: "numeric" });
}

/** Return date string offset by `offset` days from `startDate` (YYYY-MM-DD) */
function addDays(startDate: string, offset: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Human-readable day label */
function dayLabel(d: string): string {
  return new Date(d).toLocaleDateString("ar-SY", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function SalaryAdvancesPage() {
  const { i18n } = useTranslation();
  const { currency } = useSettings();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const [addOpen, setAddOpen] = useState(false);
  const [reviewDialog, setReviewDialog]   = useState<SalaryAdvance | null>(null);
  const [detailDialog, setDetailDialog]   = useState<SalaryAdvance | null>(null);
  const [editDialog, setEditDialog]       = useState<SalaryAdvance | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SalaryAdvance | null>(null);
  const [form, setForm]         = useState({ amount: "", reason: "", installments: "1" });
  const [reviewForm, setReviewForm] = useState({
    status: "approved" as "approved" | "rejected",
    adminNote: "",
    deductedPeriod: "",
    installments: "1",
    deductionUnit: "month" as "month" | "day",
    deductionStartDate: "",
  });
  const [editForm, setEditForm] = useState({
    deductedPeriod: "",
    installments: "1",
    deductionUnit: "month" as "month" | "day",
    deductionStartDate: "",
    adminNote: "",
  });
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: advances = [], isLoading } = useQuery<SalaryAdvance[]>({
    queryKey: ["salary-advances"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/salary-advances"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/salary-advances"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          reason: form.reason.trim() || undefined,
          installments: parseInt(form.installments) || 1,
          deductionUnit: "month",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم إرسال طلب السلفة" });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      setAddOpen(false);
      setForm({ amount: "", reason: "", installments: "1" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      if (!reviewDialog) return;
      const payload: Record<string, any> = {
        status:       reviewForm.status,
        adminNote:    reviewForm.adminNote.trim() || undefined,
        installments: parseInt(reviewForm.installments) || 1,
        deductionUnit: reviewForm.deductionUnit,
      };
      if (reviewForm.deductionUnit === "month") {
        // Default to current month if manager didn't pick one
        payload.deductedPeriod = reviewForm.deductedPeriod || new Date().toISOString().slice(0, 7);
      } else {
        payload.deductionStartDate = reviewForm.deductionStartDate || undefined;
      }
      const res = await fetch(apiUrl(`/api/salary-advances/${reviewDialog.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: reviewForm.status === "approved" ? "✅ تمت الموافقة" : "❌ تم الرفض" });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      setReviewDialog(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/salary-advances/${id}`), { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editDialog) return;
      const payload: Record<string, any> = {
        editSchedule: true,
        installments: parseInt(editForm.installments) || 1,
        deductionUnit: editForm.deductionUnit,
        adminNote: editForm.adminNote.trim() || undefined,
      };
      if (editForm.deductionUnit === "month") {
        payload.deductedPeriod = editForm.deductedPeriod || undefined;
      } else {
        payload.deductionStartDate = editForm.deductionStartDate || undefined;
      }
      const res = await fetch(apiUrl(`/api/salary-advances/${editDialog.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم تعديل جدول السداد" });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      setEditDialog(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = advances.filter(a => filterStatus === "all" || a.status === filterStatus);
  const fmt = (n: number) => formatCurrency(n, currency);
  const periods = periodOptions();

  /* ── computed installment preview for the review dialog ── */
  const reviewInstallments  = parseInt(reviewForm.installments) || 1;
  const reviewAmount        = reviewDialog?.amount ?? 0;
  const reviewInstallAmt    = reviewAmount / reviewInstallments;
  const reviewStartPeriod   = reviewForm.deductedPeriod;

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Banknote className="w-6 h-6 text-primary" />
              {isArabic ? "طلبات السلفة" : "Salary Advances"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isArabic ? "تقديم وإدارة طلبات السلفة على الراتب" : "Submit and manage salary advance requests"}
            </p>
          </div>
          {!isAdmin && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {isArabic ? "طلب سلفة جديد" : "New Advance Request"}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isArabic ? "الإجمالي" : "Total",    value: advances.length,                                    color: "text-foreground" },
            { label: isArabic ? "مقبولة"   : "Approved", value: advances.filter(a => a.status === "approved").length, color: "text-green-600"   },
            { label: isArabic ? "بانتظار"  : "Pending",  value: advances.filter(a => a.status === "pending").length,  color: "text-amber-600"   },
          ].map(s => (
            <div key={s.label} className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "approved", "rejected"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              onClick={() => setFilterStatus(s)}
              className="text-xs"
            >
              {s === "all" ? (isArabic ? "الكل" : "All") : (isArabic ? STATUS_AR[s] : s.charAt(0).toUpperCase() + s.slice(1))}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <NoPayrollIllustration />
              <div>
                <p className="font-medium text-sm text-foreground/80">{isArabic ? "لا توجد طلبات" : "No requests found"}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "ستظهر طلبات السلف هنا" : "Salary advance requests will appear here"}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(a => {
                const Icon = STATUS_ICON[a.status];
                const installments = a.installments ?? 1;
                const installAmt   = a.amount / installments;
                return (
                  <button
                    key={a.id}
                    className="w-full text-start px-5 py-4 hover:bg-muted/30 transition-colors flex items-center gap-4"
                    onClick={() => {
                      if (isAdmin && a.status === "pending") {
                        setReviewForm({ status: "approved", adminNote: "", deductedPeriod: "", installments: String(a.installments ?? 1), deductionUnit: (a as any).deductionUnit ?? "month", deductionStartDate: "" });
                        setReviewDialog(a);
                      } else {
                        setDetailDialog(a);
                      }
                    }}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      a.status === "approved" ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                      a.status === "rejected"  ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                                                 "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {a.userName}
                          </span>
                        )}
                        <span className="text-lg font-bold text-primary tabular-nums">{fmt(a.amount)}</span>
                        <Badge className={cn("text-xs", STATUS_STYLE[a.status])}>
                          {isArabic ? STATUS_AR[a.status] : a.status}
                        </Badge>
                        {/* installment badge */}
                        {a.status === "approved" && installments > 1 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {installments} دفعات × {fmt(installAmt)}
                          </Badge>
                        )}
                        {a.deductedPeriod && installments === 1 && (
                          <Badge variant="outline" className="text-xs">{a.deductedPeriod}</Badge>
                        )}
                      </div>
                      {/* installment schedule summary */}
                      {a.status === "approved" && installments > 1 && a.deductedPeriod && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          من {periodLabel(a.deductedPeriod)} إلى {periodLabel(addMonths(a.deductedPeriod, installments - 1))}
                        </p>
                      )}
                      {a.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>

                    {/* Delete */}
                    {(!isAdmin && a.status === "pending") || isAdmin ? (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(a); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── New Request Dialog (employee) ── */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                {isArabic ? "طلب سلفة جديد" : "New Salary Advance Request"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{isArabic ? "المبلغ المطلوب" : "Requested Amount"}</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder={isArabic ? "مثال: 5000" : "e.g. 5000"}
                />
              </div>

              {/* طريقة السداد المطلوبة */}
              <div className="space-y-1.5">
                <Label>{isArabic ? "طريقة السداد" : "Repayment type"}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm"
                    className={cn("flex-1 text-xs", form.installments === "1"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80")}
                    onClick={() => setForm(f => ({ ...f, installments: "1" }))}
                  >
                    {isArabic ? "دفعة واحدة" : "Single payment"}
                  </Button>
                  <Button
                    type="button" size="sm"
                    className={cn("flex-1 text-xs gap-1.5", form.installments !== "1"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80")}
                    onClick={() => setForm(f => ({ ...f, installments: f.installments === "1" ? "2" : f.installments }))}
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    {isArabic ? "على دفعات" : "Installments"}
                  </Button>
                </div>
              </div>

              {form.installments !== "1" && (
                <div className="space-y-1.5">
                  <Label>{isArabic ? "عدد الدفعات (أشهر)" : "Number of installments (months)"}</Label>
                  <Select value={form.installments} onValueChange={v => setForm(f => ({ ...f, installments: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2,3,4,5,6,7,8,9,10,12,18,24].map(n => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {isArabic ? "دفعات شهرية" : "monthly installments"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {isArabic
                        ? `كل دفعة: ${fmt(parseFloat(form.amount) / parseInt(form.installments))}`
                        : `Per installment: ${fmt(parseFloat(form.amount) / parseInt(form.installments))}`}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{isArabic ? "السبب (اختياري)" : "Reason (optional)"}</Label>
                <Textarea
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  placeholder={isArabic ? "اشرح سبب طلب السلفة..." : "Explain why you need the advance..."}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button
                onClick={() => addMut.mutate()}
                disabled={!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0 || addMut.isPending}
              >
                {addMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
                {isArabic ? "إرسال الطلب" : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Review Dialog (admin) ── */}
        <Dialog open={!!reviewDialog} onOpenChange={v => { if (!v) setReviewDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                {isArabic ? "مراجعة طلب السلفة" : "Review Advance Request"}
              </DialogTitle>
            </DialogHeader>
            {reviewDialog && (
              <div className="space-y-4">
                {/* Employee info */}
                <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{reviewDialog.userName}</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{fmt(reviewDialog.amount)}</p>
                  {reviewDialog.reason && <p className="text-sm text-muted-foreground">{reviewDialog.reason}</p>}
                  <p className="text-xs text-muted-foreground/60">{new Date(reviewDialog.createdAt).toLocaleString()}</p>
                </div>

                {/* Decision */}
                <div className="space-y-1.5">
                  <Label>{isArabic ? "القرار" : "Decision"}</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className={cn("flex-1 gap-1.5", reviewForm.status === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-muted text-muted-foreground")}
                      onClick={() => setReviewForm(f => ({ ...f, status: "approved" }))}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {isArabic ? "موافق" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      className={cn("flex-1 gap-1.5", reviewForm.status === "rejected" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-muted text-muted-foreground")}
                      onClick={() => setReviewForm(f => ({ ...f, status: "rejected" }))}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {isArabic ? "رفض" : "Reject"}
                    </Button>
                  </div>
                </div>

                {reviewForm.status === "approved" && (
                  <>
                    {/* Deduction unit */}
                    <div className="space-y-1.5">
                      <Label>{isArabic ? "وحدة الخصم" : "Deduction unit"}</Label>
                      <div className="flex gap-2">
                        <Button size="sm" className={cn("flex-1", reviewForm.deductionUnit === "month" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                          onClick={() => setReviewForm(f => ({ ...f, deductionUnit: "month" }))}>
                          {isArabic ? "شهري" : "Monthly"}
                        </Button>
                        <Button size="sm" className={cn("flex-1", reviewForm.deductionUnit === "day" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                          onClick={() => setReviewForm(f => ({ ...f, deductionUnit: "day" }))}>
                          {isArabic ? "يومي" : "Daily"}
                        </Button>
                      </div>
                    </div>

                    {/* Start period/date */}
                    {reviewForm.deductionUnit === "month" ? (
                      <div className="space-y-1.5">
                        <Label>{isArabic ? "بداية الخصم (الشهر الأول)" : "Deduction start month"}</Label>
                        <Select value={reviewForm.deductedPeriod} onValueChange={v => setReviewForm(f => ({ ...f, deductedPeriod: v }))}>
                          <SelectTrigger><SelectValue placeholder={isArabic ? "اختر الشهر..." : "Select month..."} /></SelectTrigger>
                          <SelectContent>
                            {periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label>{isArabic ? "تاريخ بدء الخصم" : "Deduction start date"}</Label>
                        <Input type="date" value={reviewForm.deductionStartDate}
                          onChange={e => setReviewForm(f => ({ ...f, deductionStartDate: e.target.value }))} />
                      </div>
                    )}

                    {/* Number of installments */}
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                        {isArabic
                          ? (reviewForm.deductionUnit === "day" ? "عدد الأيام" : "عدد الدفعات (أشهر)")
                          : (reviewForm.deductionUnit === "day" ? "Number of days" : "Number of installments (months)")}
                      </Label>
                      <Select value={reviewForm.installments} onValueChange={v => setReviewForm(f => ({ ...f, installments: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(reviewForm.deductionUnit === "day"
                            ? [1,3,5,7,10,14,15,20,25,30,45,60,90]
                            : [1,2,3,4,5,6,7,8,9,10,12,18,24]
                          ).map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 && reviewForm.deductionUnit === "month"
                                ? (isArabic ? "دفعة واحدة (خصم كامل)" : "1 installment (full deduction)")
                                : reviewForm.deductionUnit === "day"
                                  ? `${n} ${isArabic ? "يوم" : "days"}`
                                  : `${n} ${isArabic ? "دفعات" : "installments"}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Installment preview */}
                    {(reviewForm.deductionUnit === "month" ? reviewStartPeriod : reviewForm.deductionStartDate) && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <CalendarClock className="w-3.5 h-3.5" />
                          {isArabic ? "جدول السداد" : "Repayment schedule"}
                        </p>
                        {reviewInstallments === 1 ? (
                          <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                            {fmt(reviewAmount)} — {reviewForm.deductionUnit === "month" ? periodLabel(reviewStartPeriod!) : dayLabel(reviewForm.deductionStartDate)}
                          </p>
                        ) : (
                          <div className="space-y-0.5 max-h-40 overflow-y-auto">
                            {Array.from({ length: reviewInstallments }, (_, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-blue-700 dark:text-blue-300">
                                  {reviewForm.deductionUnit === "day"
                                    ? (isArabic ? `يوم ${i + 1}` : `Day ${i + 1}`)
                                    : (isArabic ? `دفعة ${i + 1}` : `Installment ${i + 1}`)}
                                  {" — "}
                                  {reviewForm.deductionUnit === "month"
                                    ? periodLabel(addMonths(reviewStartPeriod!, i))
                                    : dayLabel(addDays(reviewForm.deductionStartDate, i))}
                                </span>
                                <span className="font-semibold tabular-nums text-blue-800 dark:text-blue-200">
                                  {fmt(reviewInstallAmt)}
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-blue-200 dark:border-blue-700 mt-1 pt-1 flex justify-between text-xs font-bold text-blue-800 dark:text-blue-200">
                              <span>{isArabic ? "الإجمالي" : "Total"}</span>
                              <span className="tabular-nums">{fmt(reviewAmount)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Admin note */}
                <div className="space-y-1.5">
                  <Label>{isArabic ? "ملاحظة للموظف (اختياري)" : "Note to employee (optional)"}</Label>
                  <Textarea
                    value={reviewForm.adminNote}
                    onChange={e => setReviewForm(f => ({ ...f, adminNote: e.target.value }))}
                    rows={2}
                    placeholder={isArabic ? "أضف ملاحظة..." : "Add a note..."}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button
                onClick={() => reviewMut.mutate()}
                disabled={reviewMut.isPending}
                className={reviewForm.status === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              >
                {reviewMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
                {isArabic
                  ? reviewForm.status === "approved" ? "تأكيد الموافقة" : "تأكيد الرفض"
                  : reviewForm.status === "approved" ? "Confirm Approval"  : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Dialog ── */}
        <Dialog open={!!detailDialog} onOpenChange={v => { if (!v) setDetailDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-primary" />
                {isArabic ? "تفاصيل طلب السلفة" : "Advance Request Details"}
              </DialogTitle>
            </DialogHeader>
            {detailDialog && (() => {
              const inst    = detailDialog.installments ?? 1;
              const instAmt = detailDialog.amount / inst;
              return (
                <div className="space-y-3 pb-1">
                  <Badge className={cn("text-xs", STATUS_STYLE[detailDialog.status])}>
                    {isArabic ? STATUS_AR[detailDialog.status] : detailDialog.status}
                  </Badge>
                  {isAdmin && (
                    <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                      <p className="text-xs text-muted-foreground">{isArabic ? "الموظف" : "Employee"}</p>
                      <p className="text-sm font-semibold">{detailDialog.userName}</p>
                    </div>
                  )}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-4 text-center">
                    <p className="text-3xl font-bold text-primary tabular-nums">{fmt(detailDialog.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{isArabic ? "إجمالي المبلغ" : "Total amount"}</p>
                  </div>

                  {/* Installment details — monthly */}
                  {detailDialog.status === "approved" && (detailDialog.deductionUnit ?? "month") === "month" && detailDialog.deductedPeriod && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {inst === 1 ? (isArabic ? "خصم في شهر واحد" : "Single deduction") : (isArabic ? "جدول الدفعات الشهرية" : "Monthly schedule")}
                      </p>
                      {inst === 1 ? (
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                          {fmt(detailDialog.amount)} — {periodLabel(detailDialog.deductedPeriod)}
                        </p>
                      ) : (
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {Array.from({ length: inst }, (_, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-blue-700 dark:text-blue-300">
                                {isArabic ? `دفعة ${i + 1}` : `Installment ${i + 1}`}
                                {" — "}{periodLabel(addMonths(detailDialog.deductedPeriod!, i))}
                              </span>
                              <span className="font-semibold tabular-nums text-blue-800 dark:text-blue-200">{fmt(instAmt)}</span>
                            </div>
                          ))}
                          <div className="border-t border-blue-200 dark:border-blue-700 mt-1 pt-1 flex justify-between text-xs font-bold text-blue-800 dark:text-blue-200">
                            <span>{isArabic ? "الإجمالي" : "Total"}</span>
                            <span className="tabular-nums">{fmt(detailDialog.amount)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Installment details — daily */}
                  {detailDialog.status === "approved" && detailDialog.deductionUnit === "day" && detailDialog.deductionStartDate && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {inst === 1 ? (isArabic ? "خصم في يوم واحد" : "Single-day deduction") : (isArabic ? `جدول الدفعات اليومية (${inst} يوم)` : `Daily schedule (${inst} days)`)}
                      </p>
                      {inst === 1 ? (
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                          {fmt(detailDialog.amount)} — {dayLabel(detailDialog.deductionStartDate)}
                        </p>
                      ) : (
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {Array.from({ length: inst }, (_, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-blue-700 dark:text-blue-300">
                                {isArabic ? `يوم ${i + 1}` : `Day ${i + 1}`}
                                {" — "}{dayLabel(addDays(detailDialog.deductionStartDate!, i))}
                              </span>
                              <span className="font-semibold tabular-nums text-blue-800 dark:text-blue-200">{fmt(instAmt)}</span>
                            </div>
                          ))}
                          <div className="border-t border-blue-200 dark:border-blue-700 mt-1 pt-1 flex justify-between text-xs font-bold text-blue-800 dark:text-blue-200">
                            <span>{isArabic ? "الإجمالي" : "Total"}</span>
                            <span className="tabular-nums">{fmt(detailDialog.amount)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {detailDialog.reason && (
                    <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1">{isArabic ? "السبب" : "Reason"}</p>
                      <p className="text-sm leading-relaxed">{detailDialog.reason}</p>
                    </div>
                  )}
                  {detailDialog.adminNote && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                      <p className="text-xs text-blue-600 mb-1">{isArabic ? "ملاحظة المدير" : "Admin note"}</p>
                      <p className="text-sm leading-relaxed">{detailDialog.adminNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-end">🕐 {new Date(detailDialog.createdAt).toLocaleString()}</p>
                  <div className="flex gap-2">
                    {isAdmin && detailDialog.status === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => {
                          const unit = detailDialog.deductionUnit ?? "month";
                          setEditForm({
                            deductedPeriod: detailDialog.deductedPeriod ?? "",
                            installments: String(detailDialog.installments ?? 1),
                            deductionUnit: unit,
                            deductionStartDate: detailDialog.deductionStartDate ?? "",
                            adminNote: detailDialog.adminNote ?? "",
                          });
                          setDetailDialog(null);
                          setEditDialog(detailDialog);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        {isArabic ? "تعديل جدول السداد" : "Edit schedule"}
                      </Button>
                    )}
                    <Button className="flex-1" size="sm" onClick={() => setDetailDialog(null)}>
                      {isArabic ? "إغلاق" : "Close"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ── Edit Schedule Dialog (admin) ── */}
        <Dialog open={!!editDialog} onOpenChange={v => { if (!v) setEditDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                {isArabic ? "تعديل جدول السداد" : "Edit Repayment Schedule"}
              </DialogTitle>
            </DialogHeader>
            {editDialog && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-primary tabular-nums">{fmt(editDialog.amount)}</p>
                  {editDialog.userName && <p className="text-xs text-muted-foreground mt-0.5">{editDialog.userName}</p>}
                </div>

                {/* Deduction unit toggle */}
                <div className="space-y-1.5">
                  <Label>{isArabic ? "وحدة الخصم" : "Deduction unit"}</Label>
                  <div className="flex gap-2">
                    <Button size="sm" className={cn("flex-1", editForm.deductionUnit === "month" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                      onClick={() => setEditForm(f => ({ ...f, deductionUnit: "month" }))}>
                      {isArabic ? "شهري" : "Monthly"}
                    </Button>
                    <Button size="sm" className={cn("flex-1", editForm.deductionUnit === "day" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                      onClick={() => setEditForm(f => ({ ...f, deductionUnit: "day" }))}>
                      {isArabic ? "يومي" : "Daily"}
                    </Button>
                  </div>
                </div>

                {/* Start period / date */}
                {editForm.deductionUnit === "month" ? (
                  <div className="space-y-1.5">
                    <Label>{isArabic ? "بداية الخصم (الشهر الأول)" : "Deduction start month"}</Label>
                    <Select value={editForm.deductedPeriod} onValueChange={v => setEditForm(f => ({ ...f, deductedPeriod: v }))}>
                      <SelectTrigger><SelectValue placeholder={isArabic ? "اختر الشهر..." : "Select month..."} /></SelectTrigger>
                      <SelectContent>
                        {periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>{isArabic ? "تاريخ بدء الخصم" : "Deduction start date"}</Label>
                    <Input type="date" value={editForm.deductionStartDate}
                      onChange={e => setEditForm(f => ({ ...f, deductionStartDate: e.target.value }))} />
                  </div>
                )}

                {/* Number of installments */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                    {isArabic
                      ? (editForm.deductionUnit === "day" ? "عدد الأيام" : "عدد الدفعات (أشهر)")
                      : (editForm.deductionUnit === "day" ? "Number of days" : "Number of months")}
                  </Label>
                  <Select value={editForm.installments} onValueChange={v => setEditForm(f => ({ ...f, installments: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(editForm.deductionUnit === "day"
                        ? [1,3,5,7,10,14,15,20,25,30,45,60,90]
                        : [1,2,3,4,5,6,7,8,9,10,12,18,24]
                      ).map(n => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1 && editForm.deductionUnit === "month"
                            ? (isArabic ? "دفعة واحدة (خصم كامل)" : "1 month (full deduction)")
                            : editForm.deductionUnit === "day"
                              ? `${n} ${isArabic ? "يوم" : "days"}`
                              : `${n} ${isArabic ? "دفعات" : "months"}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview */}
                {(() => {
                  const n = parseInt(editForm.installments) || 1;
                  const amt = editDialog.amount / n;
                  const hasStart = editForm.deductionUnit === "month" ? !!editForm.deductedPeriod : !!editForm.deductionStartDate;
                  if (!hasStart) return null;
                  return (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" />
                        {isArabic ? "معاينة جدول السداد" : "Repayment preview"}
                      </p>
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {Array.from({ length: n }, (_, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-blue-700 dark:text-blue-300">
                              {editForm.deductionUnit === "day"
                                ? (isArabic ? `يوم ${i + 1}` : `Day ${i + 1}`)
                                : (isArabic ? `دفعة ${i + 1}` : `Installment ${i + 1}`)}
                              {" — "}
                              {editForm.deductionUnit === "month"
                                ? periodLabel(addMonths(editForm.deductedPeriod, i))
                                : dayLabel(addDays(editForm.deductionStartDate, i))}
                            </span>
                            <span className="font-semibold tabular-nums text-blue-800 dark:text-blue-200">{fmt(amt)}</span>
                          </div>
                        ))}
                        <div className="border-t border-blue-200 dark:border-blue-700 mt-1 pt-1 flex justify-between text-xs font-bold text-blue-800 dark:text-blue-200">
                          <span>{isArabic ? "الإجمالي" : "Total"}</span>
                          <span className="tabular-nums">{fmt(editDialog.amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Admin note */}
                <div className="space-y-1.5">
                  <Label>{isArabic ? "ملاحظة (اختياري)" : "Note (optional)"}</Label>
                  <Textarea value={editForm.adminNote} onChange={e => setEditForm(f => ({ ...f, adminNote: e.target.value }))}
                    rows={2} placeholder={isArabic ? "أضف ملاحظة..." : "Add a note..."} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button
                onClick={() => editMut.mutate()}
                disabled={editMut.isPending || (editForm.deductionUnit === "month" ? !editForm.deductedPeriod : !editForm.deductionStartDate)}
              >
                {editMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
                {isArabic ? "حفظ التعديل" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirm ── */}
        <Dialog open={!!deleteConfirm} onOpenChange={v => { if (!v) setDeleteConfirm(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                {isArabic ? "حذف الطلب" : "Delete Request"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {isArabic ? "هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع." : "Are you sure you want to delete this request? This cannot be undone."}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm.id)}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
                {isArabic ? "حذف" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
