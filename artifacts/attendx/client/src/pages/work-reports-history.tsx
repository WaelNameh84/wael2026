import { useState, useMemo } from "react";
import { InlineLoader } from "@/components/ui/spinner";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@/lib/api-client/index";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Eye, Trash2, X, Download, Filter, Search,
  Image as ImageIcon, FileText, Calendar, User,
} from "lucide-react";
import { format } from "date-fns";

export default function WorkReportsHistoryPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const today = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

  const [fromDate,       setFromDate]   = useState(firstOfMonth);
  const [toDate,         setToDate]     = useState(today);
  const [search,         setSearch]     = useState("");
  const [selectedUser,   setSelectedUser] = useState<string>("all");
  const [viewImg,        setViewImg]    = useState<string | null>(null);
  const [delId,          setDelId]      = useState<number | null>(null);
  const [deleting,       setDeleting]   = useState(false);
  const [clearOpen,      setClearOpen]  = useState(false);
  const [clearing,       setClearing]   = useState(false);

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["work-reports-history"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/work-reports"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["work-reports-users"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/users"), { headers: authHeaders() });
      if (!res.ok) return [];
      const all = await res.json();
      return all.filter((u: any) => u.role === "employee");
    },
    enabled: !!me,
  });

  const filtered = useMemo(() => {
    let list = reports;
    if (fromDate) list = list.filter((r: any) => r.createdAt.slice(0, 10) >= fromDate);
    if (toDate)   list = list.filter((r: any) => r.createdAt.slice(0, 10) <= toDate);
    if (isAdmin && selectedUser !== "all") {
      list = list.filter((r: any) => String(r.userId) === selectedUser);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r: any) =>
        (r.employeeName ?? "").toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [reports, fromDate, toDate, search, selectedUser, isAdmin]);

  const handleDelete = async () => {
    if (!delId) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/work-reports/${delId}`), {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      toast({ title: isArabic ? "تم حذف التقرير" : "Report deleted" });
      setDelId(null);
      qc.invalidateQueries({ queryKey: ["work-reports-history"] });
    } catch {
      toast({ title: t("error") ?? "Error", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearAll = async () => {
    if (filtered.length === 0) return;
    setClearing(true);
    let failed = 0;
    await Promise.all(filtered.map(async (r: any) => {
      const res = await fetch(apiUrl(`/api/work-reports/${r.id}`), {
        method: "DELETE", headers: authHeaders(),
      });
      if (!res.ok) failed++;
    }));
    setClearing(false);
    setClearOpen(false);
    qc.invalidateQueries({ queryKey: ["work-reports-history"] });
    if (failed === 0) toast({ title: isArabic ? "✅ تم مسح التوثيق بنجاح" : "✅ Documentation cleared" });
    else toast({ title: isArabic ? `فشل حذف ${failed} عناصر` : `${failed} items failed to delete`, variant: "destructive" });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl print:max-w-none" dir={isArabic ? "rtl" : "ltr"}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Camera className="w-6 h-6 text-primary" />
              {isArabic ? "سجل توثيق العمل" : "Work Report History"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isArabic
                ? isAdmin ? "جميع تقارير الموظفين" : "تقاريرك الشخصية"
                : isAdmin ? "All employee photo reports" : "Your personal photo reports"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setClearOpen(true)}
                disabled={filtered.length === 0}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isArabic ? "مسح التوثيق" : "Clear documentation"}
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Download className="w-3.5 h-3.5" />
              {isArabic ? "طباعة / تصدير PDF" : "Print / Export PDF"}
            </Button>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────── */}
        <div className="bg-card border border-card-border rounded-xl p-4 print:hidden">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{isArabic ? "تصفية" : "Filters"}</span>
            <Badge variant="secondary" className="ms-auto text-xs">
              {filtered.length} / {reports.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Employee filter (admin only) */}
            {isAdmin && (
              <div className="space-y-1 min-w-0">
                <Label className="text-xs flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {isArabic ? "الموظف" : "Employee"}
                </Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={isArabic ? "جميع الموظفين" : "All employees"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isArabic ? "جميع الموظفين" : "All employees"}</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1 min-w-0">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {isArabic ? "من" : "From"}
              </Label>
              <div dir="ltr" className="w-full overflow-hidden">
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-sm w-full" />
              </div>
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {isArabic ? "إلى" : "To"}
              </Label>
              <div dir="ltr" className="w-full overflow-hidden">
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-sm w-full" />
              </div>
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs flex items-center gap-1">
                <Search className="w-3 h-3" />
                {isArabic ? "بحث" : "Search"}
              </Label>
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={isArabic ? "اسم الموظف أو الملاحظة..." : "Employee or note..."}
                  className="ps-7 h-8 text-sm"
                />
              </div>
            </div>
            {(fromDate !== firstOfMonth || toDate !== today || search || selectedUser !== "all") && (
              <div className="flex items-end">
                <Button
                  variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground"
                  onClick={() => { setFromDate(firstOfMonth); setToDate(today); setSearch(""); setSelectedUser("all"); }}
                >
                  <X className="w-3.5 h-3.5" />
                  {isArabic ? "مسح" : "Clear"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────────────── */}
        {isLoading ? (
          <InlineLoader />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">{isArabic ? "لا توجد تقارير" : "No reports found"}</p>
            <p className="text-xs mt-1 opacity-70">
              {isArabic ? "جرّب تعديل فترة التاريخ أو مصطلح البحث" : "Try adjusting the date range or search term"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((r: any) => (
              <div
                key={r.id}
                className="group relative rounded-xl overflow-hidden bg-muted border border-border hover:border-primary/40 transition-all cursor-pointer"
                onClick={() => setViewImg(r.imageUrl)}
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={r.imageUrl}
                    alt={r.note ?? ""}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                </div>
                {/* hover/tap actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 print:hidden">
                  <div
                    className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow"
                    title={isArabic ? "عرض" : "View"}
                  >
                    <Eye className="w-4 h-4 text-gray-700" />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); setDelId(r.id); }}
                      className="w-9 h-9 bg-red-500/90 rounded-full flex items-center justify-center hover:bg-red-600 shadow"
                      title={isArabic ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
                {/* info bar */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                  {isAdmin && r.employeeName && (
                    <p className="text-white text-xs font-semibold truncate">{r.employeeName}</p>
                  )}
                  {r.note && (
                    <p className="text-white/80 text-[10px] truncate flex items-center gap-0.5">
                      <FileText className="w-2.5 h-2.5 flex-shrink-0" /> {r.note}
                    </p>
                  )}
                  <p className="text-white/60 text-[10px] mt-0.5">
                    {format(new Date(r.createdAt), "d/M/yyyy · HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* print summary */}
        <div className="hidden print:block border-t pt-4 text-xs text-muted-foreground">
          <p>{isArabic ? `إجمالي التقارير: ${filtered.length}` : `Total reports: ${filtered.length}`}</p>
          <p>{isArabic ? `الفترة: ${fromDate} — ${toDate}` : `Period: ${fromDate} — ${toDate}`}</p>
          <p>{isArabic ? `تاريخ التصدير: ${format(new Date(), "d/M/yyyy HH:mm")}` : `Exported: ${format(new Date(), "d/M/yyyy HH:mm")}`}</p>
        </div>
      </div>

      {/* ── Image viewer ────────────────────────────────────── */}
      <Dialog open={!!viewImg} onOpenChange={v => { if (!v) setViewImg(null); }}>
        <DialogContent className="max-w-2xl p-2 bg-black border-0">
          <button
            onClick={() => setViewImg(null)}
            data-no-swipe-back
            className="absolute top-3 end-3 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white [touch-action:none]"
          >
            <X className="w-4 h-4" />
          </button>
          {viewImg && <img src={viewImg} alt="full" className="w-full rounded object-contain max-h-[80vh]" />}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────────── */}
      <Dialog open={!!delId} onOpenChange={v => { if (!v) setDelId(null); }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <p className="font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {isArabic ? "حذف التقرير؟" : "Delete report?"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isArabic ? "لا يمكن التراجع عن هذا الإجراء." : "This cannot be undone."}
          </p>
          <div className={`flex gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setDelId(null)} disabled={deleting}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={handleDelete} disabled={deleting}>
              {deleting && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block me-1" />}
              {isArabic ? "حذف" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Clear all (filtered) confirm ─────────────────────── */}
      <Dialog open={clearOpen} onOpenChange={v => { if (!v && !clearing) setClearOpen(false); }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <p className="font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {isArabic ? "مسح التوثيق؟" : "Clear documentation?"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isArabic
              ? `سيتم حذف ${filtered.length} تقرير ضمن الفلتر الحالي نهائياً. لا يمكن التراجع عن هذا الإجراء.`
              : `This will permanently delete ${filtered.length} report(s) matching the current filter. This cannot be undone.`}
          </p>
          <div className={`flex gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setClearOpen(false)} disabled={clearing}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={handleClearAll} disabled={clearing}>
              {clearing && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block me-1" />}
              {isArabic ? "مسح الكل" : "Clear all"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
