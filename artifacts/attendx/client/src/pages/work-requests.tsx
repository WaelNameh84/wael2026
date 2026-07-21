import { useState } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { NoResultsIllustration } from "@/components/ui/empty-illustrations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@/lib/api-client/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { ClipboardList, Plus, CheckCircle, XCircle, Clock, Loader2, Timer } from "lucide-react";
import { format } from "date-fns";

type WorkRequest = {
  id: number;
  userId: number;
  userName: string;
  type: "overtime" | "permission" | "excuse";
  date: string;
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  overtime:   { ar: "عمل إضافي",   en: "Overtime",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  permission: { ar: "إذن خروج",    en: "Permission",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  excuse:     { ar: "عذر غياب",    en: "Excuse",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
};

const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending:  { ar: "بانتظار الموافقة", en: "Pending" },
  approved: { ar: "مقبول",           en: "Approved" },
  rejected: { ar: "مرفوض",           en: "Rejected" },
};

export default function WorkRequestsPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isArabic = i18n.language === "ar";

  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const [addOpen, setAddOpen] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<WorkRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const defaultForm = {
    type: "overtime" as "overtime" | "permission" | "excuse",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    hours: "",
    reason: "",
    targetUserId: "" as string,
  };
  const [form, setForm] = useState(defaultForm);

  function calcHours(start: string, end: string): string {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    const h = diff / 60;
    return h > 0 ? String(Math.round(h * 2) / 2) : "";
  }

  function handleTimeChange(field: "startTime" | "endTime", value: string) {
    setForm(f => {
      const updated = { ...f, [field]: value };
      const newHours = calcHours(
        field === "startTime" ? value : f.startTime,
        field === "endTime" ? value : f.endTime
      );
      return { ...updated, hours: newHours || f.hours };
    });
  }

  const { data: requests = [], isLoading } = useQuery<WorkRequest[]>({
    queryKey: ["work-requests"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/requests"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["req-employees"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/users"), { headers: authHeaders() });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((u: any) => u.role === "employee");
    },
    enabled: !!me,
    staleTime: 60_000,
  });

  const addMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const body: any = { type: data.type, date: data.date, reason: data.reason };
      if (data.startTime) body.startTime = data.startTime;
      if (data.endTime) body.endTime = data.endTime;
      if (data.hours) body.hours = parseFloat(data.hours);
      if (isAdmin && data.targetUserId) body.targetUserId = parseInt(data.targetUserId);
      const res = await fetch(apiUrl("/api/requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isArabic ? "✅ تم إرسال الطلب" : "✅ Request submitted" });
      qc.invalidateQueries({ queryKey: ["work-requests"] });
      setAddOpen(false);
      setForm(defaultForm);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reviewMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const res = await fetch(apiUrl(`/api/requests/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isArabic ? "تم التحديث" : "Updated" });
      qc.invalidateQueries({ queryKey: ["work-requests"] });
      setReviewDialog(null);
      setAdminNote("");
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = requests.filter(r =>
    (filterStatus === "all" || r.status === filterStatus) &&
    (filterType === "all" || r.type === filterType)
  );

  const pending = requests.filter(r => r.status === "pending").length;

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              {isArabic ? "الطلبات والأذونات" : "Requests & Permissions"}
            </h1>
            {pending > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                {pending} {isArabic ? "طلب بانتظار المراجعة" : "pending requests"}
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> {isArabic ? "طلب جديد" : "New Request"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder={isArabic ? "الحالة" : "Status"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
              <SelectItem value="pending">{isArabic ? "بانتظار الموافقة" : "Pending"}</SelectItem>
              <SelectItem value="approved">{isArabic ? "مقبول" : "Approved"}</SelectItem>
              <SelectItem value="rejected">{isArabic ? "مرفوض" : "Rejected"}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue placeholder={isArabic ? "النوع" : "Type"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
              <SelectItem value="overtime">{isArabic ? "عمل إضافي" : "Overtime"}</SelectItem>
              <SelectItem value="permission">{isArabic ? "إذن خروج" : "Permission"}</SelectItem>
              <SelectItem value="excuse">{isArabic ? "عذر غياب" : "Excuse"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <NoResultsIllustration />
              <div>
                <p className="font-medium text-sm text-foreground/80">{isArabic ? "لا توجد طلبات" : "No requests found"}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "سيتم عرض الطلبات هنا عند إضافتها" : "Requests will appear here once added"}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(r => {
                const tl = TYPE_LABELS[r.type];
                const sl = STATUS_LABELS[r.status];
                return (
                  <div key={r.id} className="px-5 py-4 flex items-start gap-4">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0 mt-0.5 ${tl?.color}`}>
                      {isArabic ? tl?.ar : tl?.en}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isAdmin && <p className="text-sm font-medium mb-0.5">{r.userName}</p>}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{r.date}</span>
                        {r.startTime && r.endTime && <span>{r.startTime} — {r.endTime}</span>}
                        {r.hours && <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{r.hours}h</span>}
                      </div>
                      <p className="text-sm mt-1">{r.reason}</p>
                      {r.adminNote && (
                        <p className="text-xs text-muted-foreground mt-1 italic border-s-2 border-muted ps-2">{r.adminNote}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                        {isArabic ? sl?.ar : sl?.en}
                      </Badge>
                      {isAdmin && r.status === "pending" && (
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setReviewDialog(r); setAdminNote(""); }}>
                          {isArabic ? "مراجعة" : "Review"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add request dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? "طلب جديد" : "New Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>{isArabic ? "اسم الموظف" : "Employee Name"}</Label>
                <Select value={form.targetUserId || "__none__"} onValueChange={v => setForm(f => ({ ...f, targetUserId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={isArabic ? "اختر موظفاً (اختياري)" : "Select employee (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{isArabic ? "— بدون تحديد —" : "— None —"}</SelectItem>
                    {employees.filter((emp: any) => emp.id != null && String(emp.id) !== "").map((emp: any) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label>{isArabic ? "نوع الطلب" : "Request Type"}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overtime">{isArabic ? "عمل إضافي" : "Overtime"}</SelectItem>
                    <SelectItem value="permission">{isArabic ? "إذن خروج" : "Permission"}</SelectItem>
                    <SelectItem value="excuse">{isArabic ? "عذر غياب" : "Excuse"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>{isArabic ? "التاريخ" : "Date"}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label>{isArabic ? "من الساعة" : "Start Time"}</Label>
                <Input type="time" value={form.startTime} onChange={e => handleTimeChange("startTime", e.target.value)} className="w-full" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>{isArabic ? "إلى الساعة" : "End Time"}</Label>
                <Input type="time" value={form.endTime} onChange={e => handleTimeChange("endTime", e.target.value)} className="w-full" />
              </div>
            </div>
            {form.type === "overtime" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{isArabic ? "عدد الساعات الإضافية" : "Overtime Hours"}</Label>
                  {form.hours && (
                    <span className="text-xs text-primary font-medium">
                      ⏱ {isArabic ? `${form.hours} ساعة` : `${form.hours}h`}
                    </span>
                  )}
                </div>
                <Input
                  type="number" min="0.5" step="0.5"
                  value={form.hours}
                  onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                  placeholder={isArabic ? "يُحسب تلقائياً من الوقت" : "Auto-calculated from time"}
                  className={form.hours ? "border-primary/50 bg-primary/5" : ""}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{isArabic ? "السبب" : "Reason"}</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder={isArabic ? "اكتب سبب الطلب..." : "Reason..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => addMut.mutate(form)} disabled={!form.reason.trim() || addMut.isPending}>
              {addMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
              {isArabic ? "إرسال" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog (admin) */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? "مراجعة الطلب" : "Review Request"}</DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">{isArabic ? "الموظف:" : "Employee:"}</span> {reviewDialog.userName}</p>
                <p><span className="text-muted-foreground">{isArabic ? "النوع:" : "Type:"}</span> {isArabic ? TYPE_LABELS[reviewDialog.type]?.ar : TYPE_LABELS[reviewDialog.type]?.en}</p>
                <p><span className="text-muted-foreground">{isArabic ? "التاريخ:" : "Date:"}</span> {reviewDialog.date}</p>
                <p><span className="text-muted-foreground">{isArabic ? "السبب:" : "Reason:"}</span> {reviewDialog.reason}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{isArabic ? "ملاحظة الإدارة (اختياري)" : "Admin Note (optional)"}</Label>
                <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewDialog(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" onClick={() => reviewMut.mutate({ id: reviewDialog!.id, status: "rejected" })} disabled={reviewMut.isPending}>
              <XCircle className="w-4 h-4 me-1.5" /> {isArabic ? "رفض" : "Reject"}
            </Button>
            <Button onClick={() => reviewMut.mutate({ id: reviewDialog!.id, status: "approved" })} disabled={reviewMut.isPending}>
              {reviewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-1.5" /> : <CheckCircle className="w-4 h-4 me-1.5" />}
              {isArabic ? "قبول" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
