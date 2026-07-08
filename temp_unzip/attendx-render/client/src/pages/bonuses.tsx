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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, authHeaders } from "@/lib/api-url";
import { TrendingUp, TrendingDown, Plus, Trash2, DollarSign, Users, Award, Loader2 } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

type Bonus = {
  id: number;
  userId: number;
  userName: string;
  type: "bonus" | "deduction";
  amount: number;
  reason: string | null;
  period: string | null;
  createdAt: string;
};

export default function BonusesPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isArabic = i18n.language === "ar";

  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin";

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["bonus-employees"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/users"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!me,
    staleTime: 60_000,
  });

  const [filterUser, setFilterUser] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    userId: "",
    type: "bonus" as "bonus" | "deduction",
    amount: "",
    reason: "",
    period: format(new Date(), "yyyy-MM"),
  });

  const { data: bonuses = [], isLoading } = useQuery<Bonus[]>({
    queryKey: ["bonuses", filterUser, filterPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterUser !== "all") params.set("userId", filterUser);
      if (filterPeriod) params.set("period", filterPeriod);
      const res = await fetch(apiUrl(`/api/bonuses?${params}`), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(apiUrl("/api/bonuses"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...data, userId: parseInt(data.userId), amount: parseFloat(data.amount) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isArabic ? "✅ تم الحفظ بنجاح" : "✅ Saved" });
      qc.invalidateQueries({ queryKey: ["bonuses"] });
      setAddOpen(false);
      setForm({ userId: "", type: "bonus", amount: "", reason: "", period: format(new Date(), "yyyy-MM") });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await fetch(apiUrl(`/api/bonuses/${id}`), { method: "DELETE", headers: authHeaders() });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bonuses"] });
      setDeleteId(null);
    },
  });

  const filtered = bonuses.filter(b => filterType === "all" || b.type === filterType);

  const totalBonus = filtered.filter(b => b.type === "bonus").reduce((s, b) => s + b.amount, 0);
  const totalDeduction = filtered.filter(b => b.type === "deduction").reduce((s, b) => s + b.amount, 0);
  const net = totalBonus - totalDeduction;

  const exportExcel = () => {
    const rows = filtered.map(b => ({
      الموظف: b.userName,
      النوع: b.type === "bonus" ? "مكافأة" : "خصم",
      المبلغ: b.type === "deduction" ? -b.amount : b.amount,
      السبب: b.reason ?? "",
      الفترة: b.period ?? "",
      التاريخ: b.createdAt ? new Date(b.createdAt).toLocaleDateString("ar-SA") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المكافآت");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bonuses.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            {isArabic ? "المكافآت والخصومات" : "Bonuses & Deductions"}
          </h1>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
              <TrendingUp className="w-4 h-4" /> Excel
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> {isArabic ? "إضافة" : "Add"}
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4 text-center">
            <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground mb-1">{isArabic ? "المكافآت" : "Bonuses"}</p>
            <p className="text-2xl font-bold text-green-600">+{totalBonus.toFixed(0)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <TrendingDown className="w-5 h-5 text-red-600 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground mb-1">{isArabic ? "الخصومات" : "Deductions"}</p>
            <p className="text-2xl font-bold text-red-600">-{totalDeduction.toFixed(0)}</p>
          </div>
          <div className={`border rounded-xl p-4 text-center ${net >= 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800" : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"}`}>
            <DollarSign className={`w-5 h-5 mx-auto mb-1 ${net >= 0 ? "text-blue-600" : "text-orange-600"}`} />
            <p className="text-xs text-muted-foreground mb-1">{isArabic ? "الصافي" : "Net"}</p>
            <p className={`text-2xl font-bold ${net >= 0 ? "text-blue-600" : "text-orange-600"}`}>{net >= 0 ? "+" : ""}{net.toFixed(0)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-44"><SelectValue placeholder={isArabic ? "كل الموظفين" : "All employees"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "كل الموظفين" : "All employees"}</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue placeholder={isArabic ? "النوع" : "Type"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
              <SelectItem value="bonus">{isArabic ? "مكافأة" : "Bonus"}</SelectItem>
              <SelectItem value="deduction">{isArabic ? "خصم" : "Deduction"}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-40" />
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{isArabic ? "لا توجد سجلات" : "No records found"}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(b => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${b.type === "bonus" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                    {b.type === "bonus" ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{b.userName}</p>
                      <Badge variant={b.type === "bonus" ? "default" : "destructive"} className="text-xs">
                        {b.type === "bonus" ? (isArabic ? "مكافأة" : "Bonus") : (isArabic ? "خصم" : "Deduction")}
                      </Badge>
                      {b.period && <span className="text-xs text-muted-foreground">{b.period}</span>}
                    </div>
                    {b.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.reason}</p>}
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className={`font-bold text-lg ${b.type === "bonus" ? "text-green-600" : "text-red-600"}`}>
                      {b.type === "bonus" ? "+" : "-"}{b.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleDateString(isArabic ? "ar-SA" : "en-US")}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive flex-shrink-0" onClick={() => setDeleteId(b.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? "إضافة مكافأة / خصم" : "Add Bonus / Deduction"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{isArabic ? "الموظف" : "Employee"}</Label>
              <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر موظفاً" : "Select employee"} /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isArabic ? "النوع" : "Type"}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus">{isArabic ? "مكافأة" : "Bonus"}</SelectItem>
                    <SelectItem value="deduction">{isArabic ? "خصم" : "Deduction"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{isArabic ? "المبلغ" : "Amount"}</Label>
                <Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{isArabic ? "الفترة (شهر)" : "Period (month)"}</Label>
              <Input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{isArabic ? "السبب" : "Reason"}</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder={isArabic ? "سبب المكافأة أو الخصم..." : "Reason..."} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => addMut.mutate(form)} disabled={!form.userId || !form.amount || addMut.isPending}>
              {addMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isArabic ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{isArabic ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?"}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate(deleteId)} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
              {isArabic ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
