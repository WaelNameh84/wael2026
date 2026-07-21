import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { Megaphone, Plus, Trash2, Loader2, AlertCircle, Building2, Globe, Calendar } from "lucide-react";
import { NoAnnouncementsIllustration } from "@/components/ui/empty-illustrations";
import { cn } from "@/lib/utils";
import { useQuery as useDeptsQuery } from "@tanstack/react-query";

type Announcement = {
  id: number;
  title: string;
  body: string;
  targetDepartment: string | null;
  priority: "normal" | "urgent";
  createdBy: number;
  createdByName: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  // Mark employee notifications as read when they open this page
  useEffect(() => {
    if (isAdmin || !me) return;
    fetch(apiUrl("/api/notifications/my/mark-all-read"), {
      method: "POST",
      headers: authHeaders(),
    }).then(() => {
      qc.invalidateQueries({ queryKey: ["my-notifications-count"] });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const [showForm, setShowForm]           = useState(false);
  const [editTarget, setEditTarget]       = useState<Announcement | null>(null);
  const [showAdminAll, setShowAdminAll]   = useState(false);

  // Form state
  const [title, setTitle]                 = useState("");
  const [body, setBody]                   = useState("");
  const [targetDept, setTargetDept]       = useState("all");
  const [priority, setPriority]           = useState<"normal" | "urgent">("normal");
  const [expiresAt, setExpiresAt]         = useState("");

  const queryKey = isAdmin && showAdminAll
    ? ["announcements-all"]
    : ["announcements"];

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey,
    queryFn: async () => {
      const url = isAdmin && showAdminAll ? "/api/announcements/all" : "/api/announcements";
      const res = await fetch(apiUrl(url), { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const { data: departments = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/departments"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  function resetForm() {
    setTitle(""); setBody(""); setTargetDept("all"); setPriority("normal"); setExpiresAt("");
    setEditTarget(null);
  }

  function openEdit(a: Announcement) {
    setTitle(a.title);
    setBody(a.body);
    setTargetDept(a.targetDepartment || "all");
    setPriority(a.priority);
    setExpiresAt(a.expiresAt ? a.expiresAt.slice(0, 10) : "");
    setEditTarget(a);
    setShowForm(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        body,
        targetDepartment: targetDept === "all" ? "" : targetDept,
        priority,
        expiresAt: expiresAt || undefined,
      };
      if (editTarget) {
        const res = await fetch(apiUrl(`/api/announcements/${editTarget.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      } else {
        const res = await fetch(apiUrl("/api/announcements"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: editTarget ? "✅ تم التحديث" : "✅ تم نشر الإعلان" });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements-all"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/announcements/${id}`), {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "تم حذف الإعلان" });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      qc.invalidateQueries({ queryKey: ["announcements-all"] });
    },
  });

  const urgentCount = announcements.filter(a => a.priority === "urgent").length;

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" /> لوحة الإعلانات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdmin ? "نشر وإدارة الإعلانات للموظفين" : "الإعلانات الموجهة لك من الإدارة"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant={showAdminAll ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAdminAll(v => !v)}
                >
                  {showAdminAll ? "الإعلانات النشطة" : "كل الإعلانات"}
                </Button>
                <Button className="gap-2" onClick={() => { resetForm(); setShowForm(true); }}>
                  <Plus className="w-4 h-4" /> إعلان جديد
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Urgent banner */}
        {urgentCount > 0 && (
          <div className="bg-red-500/10 border border-red-300 dark:border-red-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {urgentCount === 1 ? "يوجد إعلان عاجل يستوجب انتباهك" : `يوجد ${urgentCount} إعلانات عاجلة`}
            </p>
          </div>
        )}

        {/* Announcements list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <NoAnnouncementsIllustration />
            <div>
              <p className="font-medium text-sm text-foreground/80">لا توجد إعلانات حالياً</p>
              <p className="text-xs text-muted-foreground mt-1">ستظهر الإعلانات الجديدة هنا</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(a => {
              const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
              return (
                <div
                  key={a.id}
                  className={cn(
                    "bg-card border rounded-xl overflow-hidden",
                    a.priority === "urgent" ? "border-red-300 dark:border-red-800" : "border-border",
                    isExpired && "opacity-60"
                  )}
                >
                  {a.priority === "urgent" && (
                    <div className="bg-red-500 px-4 py-1.5 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-white" />
                      <span className="text-white text-xs font-bold">إعلان عاجل</span>
                      {isExpired && <span className="text-white/70 text-xs ms-auto">منتهي</span>}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base">{a.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {a.targetDepartment ? (
                            <Badge variant="outline" className="text-xs gap-1 text-blue-600">
                              <Building2 className="w-3 h-3" /> {a.targetDepartment}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                              <Globe className="w-3 h-3" /> لجميع الموظفين
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">منتهي الصلاحية</Badge>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(a)}>
                            <span className="sr-only">تعديل</span>
                            ✏️
                          </Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive"
                            onClick={() => deleteMut.mutate(a.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 mt-3 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      {a.createdByName && <span>بواسطة: {a.createdByName}</span>}
                      <span>{new Date(a.createdAt).toLocaleDateString("ar-SY")}</span>
                      {a.expiresAt && !isExpired && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          ينتهي: {new Date(a.expiresAt).toLocaleDateString("ar-SY")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              {editTarget ? "تعديل الإعلان" : "إعلان جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>عنوان الإعلان <span className="text-destructive">*</span></Label>
              <Input placeholder="مثال: اجتماع طارئ يوم الأحد" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>نص الإعلان <span className="text-destructive">*</span></Label>
              <Textarea placeholder="اكتب تفاصيل الإعلان هنا..." value={body} onChange={e => setBody(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الجهة المستهدفة</Label>
                <Select value={targetDept} onValueChange={setTargetDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🌐 جميع الموظفين</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الأولوية</Label>
                <Select value={priority} onValueChange={v => setPriority(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">🟢 عادي</SelectItem>
                    <SelectItem value="urgent">🔴 عاجل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الانتهاء (اختياري)</Label>
              <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} min={new Date().toISOString().slice(0,10)} />
              <p className="text-xs text-muted-foreground">اتركه فارغاً للإعلان الدائم</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>إلغاء</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !title.trim() || !body.trim()}
            >
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {editTarget ? "حفظ التعديلات" : "نشر الإعلان"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
