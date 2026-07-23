import { useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useListUsers, useGetMe } from "@/lib/api-client/index";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineLoader } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Search, Filter, Loader2, AlertTriangle, CalendarX, CheckSquare, Square } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { apiUrl, authHeaders } from "@/lib/api-url";

function statusColor(s: string) {
  const map: Record<string, string> = {
    present: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    late: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    on_leave: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    early_leave: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
}

export default function ClearReportsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: me } = useGetMe();
  const { data: users = [] } = useListUsers(undefined, { query: { enabled: me?.role === "admin" || me?.role === "manager" } as any });

  const today = format(new Date(), "yyyy-MM-dd");
  const monthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [userId, setUserId] = useState<string>("all");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [submitted, setSubmitted] = useState({ userId: "all", from: monthAgo, to: today });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");

  const queryParams = useMemo(() => {
    const p: any = { from: submitted.from, to: submitted.to };
    if (submitted.userId !== "all") p.userId = parseInt(submitted.userId);
    return p;
  }, [submitted]);

  const { data: report, isLoading } = useQuery<any>({
    queryKey: ["clear-reports-data", queryParams],
    queryFn: async () => {
      const params = new URLSearchParams(queryParams as any);
      const res = await fetch(apiUrl(`/api/reports/attendance?${params}`), { headers: authHeaders() });
      if (!res.ok) return { records: [] };
      return res.json();
    },
  });

  const records: any[] = useMemo(() => {
    const allRecs = (report?.records ?? []).filter((r: any) => !r.isLeave);
    if (!search.trim()) return allRecs;
    const q = search.toLowerCase();
    return allRecs.filter((r: any) =>
      (r.userName ?? "").toLowerCase().includes(q) ||
      (r.date ?? "").includes(q) ||
      (r.status ?? "").toLowerCase().includes(q)
    );
  }, [report, search]);

  const allIds: number[] = records.map((r: any) => r.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(apiUrl("/api/attendance/bulk"), {
        method: "DELETE",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "فشل الحذف");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `تم حذف ${data.deleted ?? selectedIds.size} سجل بنجاح` });
      setSelectedIds(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["clear-reports-data"] });
    },
    onError: (err: any) => {
      toast({ title: "فشل الحذف", description: err.message, variant: "destructive" });
    },
  });

  if (me?.role !== "admin" && me?.role !== "manager") {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">{t("failed")}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarX className="w-6 h-6 text-destructive" />
              مسح التقارير
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              احذف سجلات الحضور لموظف معين أو لفترة زمنية محددة
            </p>
          </div>
          {someSelected && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              حذف {selectedIds.size} سجل محدد
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card border border-card-border rounded-xl p-5 space-y-4 overflow-hidden">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter className="w-4 h-4 text-primary" />
            فلترة السجلات
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-hidden">
            <div className="space-y-1.5 min-w-0 overflow-hidden">
              <Label className="text-xs">الموظف</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="جميع الموظفين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {(users as any[]).filter((u: any) => u.role !== "admin" && u.role !== "manager").map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs">من تاريخ</Label>
              <div dir="ltr" className="w-full overflow-hidden">
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-full" />
              </div>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs">إلى تاريخ</Label>
              <div dir="ltr" className="w-full overflow-hidden">
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-full" />
              </div>
            </div>
            <div className="flex items-end min-w-0">
              <Button
                className="w-full h-9 gap-2"
                onClick={() => { setSubmitted({ userId, from, to }); setSelectedIds(new Set()); setSearch(""); }}
              >
                <Search className="w-3.5 h-3.5" />
                بحث
              </Button>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في النتائج..."
            className="ps-9"
          />
        </div>

        {/* Results */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">

          {/* Table header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-muted/30">
            <button
              type="button"
              onClick={toggleAll}
              className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
              title={allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
            >
              {allSelected ? (
                <CheckSquare className="w-4.5 h-4.5 text-primary" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>
            <span className="text-xs font-medium text-muted-foreground flex-1">
              {records.length} سجل
              {someSelected && (
                <span className="text-primary ms-2">({selectedIds.size} محدد)</span>
              )}
            </span>
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="w-3 h-3" />
                حذف المحدد
              </Button>
            )}
          </div>

          {isLoading ? (
            <InlineLoader />
          ) : records.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CalendarX className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا توجد سجلات في هذا النطاق</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {records.map((rec: any) => (
                <div
                  key={rec.id}
                  className={cn(
                    "px-4 py-3 flex items-center gap-3 transition-colors",
                    selectedIds.has(rec.id) ? "bg-destructive/5" : "hover:bg-muted/20"
                  )}
                >
                  <Checkbox
                    checked={selectedIds.has(rec.id)}
                    onCheckedChange={() => toggleOne(rec.id)}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{rec.userName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{rec.date}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColor(rec.status ?? ""))}>
                      {t(rec.status ?? "") || rec.status}
                    </span>
                    {rec.checkIn && (
                      <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                        {new Date(rec.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {rec.checkOut ? ` ← ${new Date(rec.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setSelectedIds(new Set([rec.id])); setConfirmOpen(true); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                      title="حذف هذا السجل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm Dialog */}
        <Dialog open={confirmOpen} onOpenChange={v => { if (!v) setConfirmOpen(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                تأكيد الحذف
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                هل أنت متأكد من حذف <strong>{selectedIds.size}</strong> سجل حضور؟
              </p>
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                <p className="text-xs text-destructive">⚠️ لا يمكن التراجع عن هذا الإجراء</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} className="flex-1">
                إلغاء
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(Array.from(selectedIds))}
                className="flex-1 gap-1.5"
              >
                {deleteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                حذف نهائي
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
}
