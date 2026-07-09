import { useState } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@/lib/api-client/index";
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
import { Banknote, Plus, CheckCircle, XCircle, Clock, Loader2, Trash2, User } from "lucide-react";
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
    opts.push({ value, label: d.toLocaleString("default", { month: "long", year: "numeric" }) });
  }
  return opts;
}

export default function SalaryAdvancesPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin";

  const [addOpen, setAddOpen] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<SalaryAdvance | null>(null);
  const [detailDialog, setDetailDialog] = useState<SalaryAdvance | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SalaryAdvance | null>(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [reviewForm, setReviewForm] = useState({ status: "approved" as "approved" | "rejected", adminNote: "", deductedPeriod: "" });
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
        body: JSON.stringify({ amount: parseFloat(form.amount), reason: form.reason.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isArabic ? "✅ تم إرسال طلب السلفة" : "✅ Advance request submitted" });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      setAddOpen(false);
      setForm({ amount: "", reason: "" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      if (!reviewDialog) return;
      const res = await fetch(apiUrl(`/api/salary-advances/${reviewDialog.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          status: reviewForm.status,
          adminNote: reviewForm.adminNote.trim() || undefined,
          deductedPeriod: reviewForm.deductedPeriod || undefined,
        }),
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
      toast({ title: isArabic ? "تم الحذف" : "Deleted" });
      qc.invalidateQueries({ queryKey: ["salary-advances"] });
      setDeleteConfirm(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = advances.filter(a => filterStatus === "all" || a.status === filterStatus);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const periods = periodOptions();

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
            { label: isArabic ? "الإجمالي" : "Total", value: advances.length, color: "text-foreground" },
            { label: isArabic ? "مقبولة" : "Approved", value: advances.filter(a => a.status === "approved").length, color: "text-green-600" },
            { label: isArabic ? "بانتظار" : "Pending", value: advances.filter(a => a.status === "pending").length, color: "text-amber-600" },
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
            <div className="py-14 text-center text-muted-foreground">
              <Banknote className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{isArabic ? "لا توجد طلبات" : "No requests found"}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(a => {
                const Icon = STATUS_ICON[a.status];
                return (
                  <button
                    key={a.id}
                    className="w-full text-start px-5 py-4 hover:bg-muted/30 transition-colors flex items-center gap-4"
                    onClick={() => {
                      if (isAdmin && a.status === "pending") {
                        setReviewForm({ status: "approved", adminNote: "", deductedPeriod: "" });
                        setReviewDialog(a);
                      } else {
                        setDetailDialog(a);
                      }
                    }}
                  >
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      a.status === "approved" ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                      a.status === "rejected" ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
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
                        {a.deductedPeriod && (
                          <Badge variant="outline" className="text-xs">{a.deductedPeriod}</Badge>
                        )}
                      </div>
                      {a.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.reason}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>

                    {/* Delete for own pending */}
                    {!isAdmin && a.status === "pending" && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(a); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {/* Admin delete */}
                    {isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(a); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
                  placeholder={isArabic ? "مثال: 500" : "e.g. 500"}
                />
              </div>
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
                <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{reviewDialog.userName}</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{fmt(reviewDialog.amount)}</p>
                  {reviewDialog.reason && <p className="text-sm text-muted-foreground">{reviewDialog.reason}</p>}
                  <p className="text-xs text-muted-foreground/60">{new Date(reviewDialog.createdAt).toLocaleString()}</p>
                </div>

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
                  <div className="space-y-1.5">
                    <Label>{isArabic ? "خصم من فترة (اختياري)" : "Deduct from period (optional)"}</Label>
                    <Select value={reviewForm.deductedPeriod} onValueChange={v => setReviewForm(f => ({ ...f, deductedPeriod: v }))}>
                      <SelectTrigger><SelectValue placeholder={isArabic ? "اختر الشهر..." : "Select month..."} /></SelectTrigger>
                      <SelectContent>
                        {periods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                  : reviewForm.status === "approved" ? "Confirm Approval" : "Confirm Rejection"}
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
            {detailDialog && (
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
                  <p className="text-xs text-muted-foreground mt-1">{isArabic ? "المبلغ المطلوب" : "Requested amount"}</p>
                </div>
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
                {detailDialog.deductedPeriod && (
                  <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">{isArabic ? "خصم من فترة" : "Deducted from period"}</p>
                    <p className="text-sm font-medium">{detailDialog.deductedPeriod}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-end">🕐 {new Date(detailDialog.createdAt).toLocaleString()}</p>
                <Button className="w-full" size="sm" onClick={() => setDetailDialog(null)}>
                  {isArabic ? "إغلاق" : "Close"}
                </Button>
              </div>
            )}
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
