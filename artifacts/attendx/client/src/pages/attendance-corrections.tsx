import { useState } from "react";
import Layout from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@/lib/api-client/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, authHeaders } from "@/lib/api-url";
import {
  PenLine, Plus, CheckCircle, XCircle, Clock, Loader2, Trash2, User,
  CalendarCheck, Edit, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";

type Correction = {
  id: number;
  userId: number;
  userName: string;
  attendanceId: number | null;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  reviewedAt: string | null;
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

export default function AttendanceCorrectionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const [showForm, setShowForm]   = useState(false);
  const [reviewId, setReviewId]   = useState<number | null>(null);
  const [expanded, setExpanded]   = useState<number | null>(null);

  // Form state
  const [date, setDate]                     = useState(new Date().toISOString().slice(0, 10));
  const [reqCheckIn, setReqCheckIn]         = useState("");
  const [reqCheckOut, setReqCheckOut]       = useState("");
  const [reason, setReason]                 = useState("");
  const [attendanceId, setAttendanceId]     = useState("");

  // Review state
  const [reviewStatus, setReviewStatus]     = useState<"approved" | "rejected">("approved");
  const [adminNote, setAdminNote]           = useState("");

  const { data: corrections = [], isLoading } = useQuery<Correction[]>({
    queryKey: ["attendance-corrections"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/attendance-corrections"), { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/attendance-corrections"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          date,
          requestedCheckIn:  reqCheckIn  || undefined,
          requestedCheckOut: reqCheckOut || undefined,
          reason,
          attendanceId: attendanceId ? parseInt(attendanceId) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم إرسال الطلب للمراجعة" });
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
      setShowForm(false);
      setDate(new Date().toISOString().slice(0, 10));
      setReqCheckIn(""); setReqCheckOut(""); setReason(""); setAttendanceId("");
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/api/attendance-corrections/${reviewId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: reviewStatus, adminNote: adminNote || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: reviewStatus === "approved" ? "✅ تمت الموافقة" : "❌ تم الرفض" });
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
      setReviewId(null); setAdminNote("");
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/attendance-corrections/${id}`), {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      qc.invalidateQueries({ queryKey: ["attendance-corrections"] });
    },
  });

  const pending  = corrections.filter(c => c.status === "pending");
  const reviewed = corrections.filter(c => c.status !== "pending");

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PenLine className="w-6 h-6 text-primary" /> تصحيح سجلات الحضور
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin
                ? "استعراض ومعالجة طلبات تصحيح الحضور المقدمة من الموظفين"
                : "قدّم طلباً لتصحيح وقت دخولك أو خروجك الخاطئ"}
            </p>
          </div>
          {!isAdmin && (
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> طلب تصحيح
            </Button>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي الطلبات", value: corrections.length, color: "text-foreground" },
            { label: "بانتظار الموافقة", value: pending.length, color: "text-amber-500" },
            { label: "تمت المعالجة", value: reviewed.length, color: "text-green-500" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Pending list */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> بانتظار المراجعة ({pending.length})
            </h2>
            <div className="space-y-2">
              {pending.map(c => (
                <CorrectionCard
                  key={c.id}
                  c={c}
                  isAdmin={isAdmin}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onReview={() => { setReviewId(c.id); setReviewStatus("approved"); setAdminNote(""); }}
                  onDelete={() => deleteMut.mutate(c.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Reviewed list */}
        {reviewed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" /> الطلبات المعالجة ({reviewed.length})
            </h2>
            <div className="space-y-2">
              {reviewed.map(c => (
                <CorrectionCard
                  key={c.id}
                  c={c}
                  isAdmin={isAdmin}
                  expanded={expanded === c.id}
                  onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                  onReview={() => {}}
                  onDelete={() => deleteMut.mutate(c.id)}
                />
              ))}
            </div>
          </section>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        )}

        {!isLoading && corrections.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <PenLine className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>لا توجد طلبات تصحيح حتى الآن</p>
            {!isAdmin && (
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> قدّم طلباً الآن
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Submit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-primary" /> طلب تصحيح حضور
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5 min-w-0">
              <Label>تاريخ الحضور</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label>وقت الدخول المطلوب</Label>
                <Input type="time" value={reqCheckIn} onChange={e => setReqCheckIn(e.target.value)} placeholder="HH:MM" className="w-full" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>وقت الخروج المطلوب</Label>
                <Input type="time" value={reqCheckOut} onChange={e => setReqCheckOut(e.target.value)} placeholder="HH:MM" className="w-full" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">اترك الحقل فارغاً إذا كنت تريد تصحيح وقت واحد فقط</p>
            <div className="space-y-1.5">
              <Label>سبب التصحيح <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="اشرح سبب الطلب بالتفصيل..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button
              onClick={() => submitMut.mutate()}
              disabled={submitMut.isPending || !reason.trim() || (!reqCheckIn && !reqCheckOut)}
            >
              {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={reviewId !== null} onOpenChange={v => { if (!v) setReviewId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>مراجعة الطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                className={cn("flex-1 gap-1.5", reviewStatus === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-muted text-muted-foreground")}
                onClick={() => setReviewStatus("approved")}
              >
                <CheckCircle className="w-4 h-4" /> موافقة
              </Button>
              <Button
                className={cn("flex-1 gap-1.5", reviewStatus === "rejected" ? "bg-destructive text-white" : "bg-muted text-muted-foreground")}
                onClick={() => setReviewStatus("rejected")}
              >
                <XCircle className="w-4 h-4" /> رفض
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة (اختياري)</Label>
              <Textarea
                placeholder="أضف ملاحظة للموظف..."
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewId(null)}>إلغاء</Button>
            <Button
              onClick={() => reviewMut.mutate()}
              disabled={reviewMut.isPending}
              className={reviewStatus === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
            >
              {reviewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function CorrectionCard({
  c, isAdmin, expanded, onToggle, onReview, onDelete,
}: {
  c: Correction;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all", c.status === "pending" ? "border-amber-200 dark:border-amber-800" : "border-border")}>
      <button className="w-full text-start px-4 py-3 flex items-center gap-3" onClick={onToggle}>
        <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
          c.status === "pending" ? "bg-amber-500/10" : c.status === "approved" ? "bg-green-500/10" : "bg-red-500/10"
        )}>
          {c.status === "pending"  ? <Clock       className="w-4 h-4 text-amber-500" /> :
           c.status === "approved" ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                                     <XCircle     className="w-4 h-4 text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && <span className="text-sm font-semibold truncate">{c.userName}</span>}
            <span className="text-sm text-muted-foreground">{c.date}</span>
            <Badge className={cn("text-xs", STATUS_STYLE[c.status])}>{STATUS_AR[c.status]}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {c.requestedCheckIn  && <span>دخول: <strong>{c.requestedCheckIn}</strong></span>}
            {c.requestedCheckOut && <span>خروج: <strong>{c.requestedCheckOut}</strong></span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="bg-muted/40 rounded-lg px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1">سبب الطلب</p>
            <p className="text-sm">{c.reason}</p>
          </div>
          {c.adminNote && (
            <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-1">ملاحظة المدير</p>
              <p className="text-sm">{c.adminNote}</p>
            </div>
          )}
          {c.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              تمت المراجعة: {new Date(c.reviewedAt).toLocaleString("ar-SY")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            وقت الطلب: {new Date(c.createdAt).toLocaleString("ar-SY")}
          </p>
          {isAdmin && c.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5" onClick={onReview}>
                <Edit className="w-3.5 h-3.5" /> مراجعة الطلب
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {isAdmin && c.status !== "pending" && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" /> حذف
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
