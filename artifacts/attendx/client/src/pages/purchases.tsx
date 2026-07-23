import { useRef, useState } from "react";
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
import { InlineLoader } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload } from "@/hooks/use-file-upload";
import { apiUrl, authHeaders } from "@/lib/api-url";
import {
  ShoppingBag, Plus, Trash2, User, Camera, FolderOpen, X, Download,
  Loader2, Shirt, Wrench, Package, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Purchase = {
  id: number;
  userId: number;
  userName: string;
  category: "clothes" | "equipment" | "other";
  itemLabel: string;
  description: string | null;
  amount: number;
  receiptUrl: string | null;
  period: string;
  createdAt: string;
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  clothes: Shirt, equipment: Wrench, other: Package,
};
const CATEGORY_LABEL: Record<string, { ar: string; en: string }> = {
  clothes:   { ar: "ملابس",  en: "Clothes" },
  equipment: { ar: "معدات",  en: "Equipment" },
  other:     { ar: "أخرى",   en: "Other" },
};

export default function PurchasesPage() {
  const { i18n } = useTranslation();
  const { currency } = useSettings();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";
  const { upload, state: uploadState } = useFileUpload();

  const [addOpen, setAddOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<Purchase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Purchase | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");

  const [form, setForm] = useState({
    category: "clothes" as "clothes" | "equipment" | "other",
    customLabel: "",
    description: "",
    amount: "",
  });
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const { data: purchases = [], isLoading } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/purchases"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const resetForm = () => {
    setForm({ category: "clothes", customLabel: "", description: "", amount: "" });
    setReceiptPreview(null);
    setReceiptPath(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
    const path = await upload(file);
    if (path) setReceiptPath(path);
    else toast({ title: isArabic ? "فشل رفع الصورة" : "Failed to upload image", variant: "destructive" });
    e.target.value = "";
  };

  const addMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/api/purchases"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          category: form.category,
          customLabel: form.category === "other" ? form.customLabel.trim() : undefined,
          description: form.description.trim() || undefined,
          amount: parseFloat(form.amount),
          receiptUrl: receiptPath ?? undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isArabic ? "✅ تمت إضافة المشتريات — ستُخصم/تُضاف للراتب تلقائياً" : "✅ Purchase added — auto-included in salary" });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      setAddOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(apiUrl(`/api/purchases/${id}`), { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ title: isArabic ? "تم الحذف" : "Deleted" });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      setDeleteConfirm(null);
      setDetailDialog(null);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleDownload = (p: Purchase) => {
    if (!p.receiptUrl) return;
    const a = document.createElement("a");
    a.href = apiUrl(p.receiptUrl);
    a.download = `invoice-${p.itemLabel}-${p.id}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const filtered = purchases.filter(p => filterCategory === "all" || p.category === filterCategory);
  const fmt = (n: number) => formatCurrency(n, currency);
  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);

  const canSubmit = form.amount && !isNaN(parseFloat(form.amount)) && parseFloat(form.amount) > 0
    && (form.category !== "other" || form.customLabel.trim().length > 0)
    && uploadState !== "uploading";

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" />
              {isArabic ? "المشتريات" : "Purchases"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isArabic ? "سجّل مشترياتك المرتبطة بالعمل وسيتم إضافتها تلقائياً لراتبك" : "Log work-related purchases — auto-added to your salary"}
            </p>
          </div>
          {!isAdmin && (
            <Button onClick={() => setAddOpen(true)} className="gap-2" data-testid="button-add-purchase">
              <Plus className="w-4 h-4" />
              {isArabic ? "تسجيل مشتريات" : "Log Purchase"}
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: isArabic ? "الإجمالي" : "Total", value: fmt(totalAmount), color: "text-foreground" },
            ...(["clothes", "equipment", "other"] as const).map(c => ({
              label: isArabic ? CATEGORY_LABEL[c].ar : CATEGORY_LABEL[c].en,
              value: String(purchases.filter(p => p.category === c).length),
              color: "text-teal-600",
            })),
          ].map((s, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "clothes", "equipment", "other"] as const).map(c => (
            <Button
              key={c}
              size="sm"
              variant={filterCategory === c ? "default" : "outline"}
              onClick={() => setFilterCategory(c)}
              className="text-xs"
            >
              {c === "all" ? (isArabic ? "الكل" : "All") : (isArabic ? CATEGORY_LABEL[c].ar : CATEGORY_LABEL[c].en)}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          {isLoading ? (
            <InlineLoader />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <NoPayrollIllustration />
              <div>
                <p className="font-medium text-sm text-foreground/80">{isArabic ? "لا توجد مشتريات" : "No purchases found"}</p>
                <p className="text-xs text-muted-foreground mt-1">{isArabic ? "ستظهر مشترياتك هنا" : "Logged purchases will appear here"}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(p => {
                const Icon = CATEGORY_ICON[p.category] ?? Package;
                return (
                  <button
                    key={p.id}
                    className="w-full text-start px-5 py-4 hover:bg-muted/30 transition-colors flex items-center gap-4"
                    onClick={() => setDetailDialog(p)}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-teal-100 text-teal-600 dark:bg-teal-900/30">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {p.userName}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{p.itemLabel}</span>
                        <span className="text-lg font-bold text-primary tabular-nums">{fmt(p.amount)}</span>
                        <Badge variant="outline" className="text-xs">{p.period}</Badge>
                        {p.receiptUrl && <Receipt className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    {isAdmin && p.receiptUrl && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDownload(p); }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                        title={isArabic ? "تنزيل الفاتورة" : "Download invoice"}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {(isAdmin || p.userId === me?.id) && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }}
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

        {/* ── New Purchase Dialog (employee) ── */}
        <Dialog open={addOpen} onOpenChange={v => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                {isArabic ? "تسجيل مشتريات جديدة" : "Log New Purchase"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{isArabic ? "نوع المشتريات" : "Category"}</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as any }))}>
                  <SelectTrigger data-testid="select-purchase-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clothes">👕 {isArabic ? "ملابس" : "Clothes"}</SelectItem>
                    <SelectItem value="equipment">🔧 {isArabic ? "معدات" : "Equipment"}</SelectItem>
                    <SelectItem value="other">📦 {isArabic ? "أخرى" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.category === "other" && (
                <div className="space-y-1.5">
                  <Label>{isArabic ? "اسم العنصر" : "Item name"}</Label>
                  <Input
                    value={form.customLabel}
                    onChange={e => setForm(f => ({ ...f, customLabel: e.target.value }))}
                    placeholder={isArabic ? "مثال: أدوات مكتبية" : "e.g. Office supplies"}
                    data-testid="input-purchase-custom-label"
                  />
                  <p className="text-xs text-muted-foreground">
                    {isArabic ? "سيُستخدم هذا الاسم كبند إضافة في الراتب" : "This name is used as the salary addition line item"}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{isArabic ? "المبلغ المدفوع" : "Amount Paid"}</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder={isArabic ? "مثال: 150" : "e.g. 150"}
                  data-testid="input-purchase-amount"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{isArabic ? "وصف إضافي (اختياري)" : "Description (optional)"}</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder={isArabic ? "تفاصيل عن العنصر المُشترى..." : "Details about the item..."}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{isArabic ? "صورة الفاتورة" : "Invoice Photo"}</Label>
                {receiptPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={receiptPreview} alt="receipt" className="w-full max-h-48 object-contain bg-muted" />
                    <button
                      onClick={() => { setReceiptPreview(null); setReceiptPath(null); }}
                      className="absolute top-2 end-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {uploadState === "uploading" && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => cameraRef.current?.click()}>
                      <Camera className="w-3.5 h-3.5" />
                      {isArabic ? "تصوير" : "Take Photo"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => galleryRef.current?.click()}>
                      <FolderOpen className="w-3.5 h-3.5" />
                      {isArabic ? "من المعرض" : "From Gallery"}
                    </Button>
                  </div>
                )}
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
              <Button
                onClick={() => addMut.mutate()}
                disabled={!canSubmit || addMut.isPending}
                data-testid="button-submit-purchase"
              >
                {addMut.isPending && <Loader2 className="w-4 h-4 animate-spin me-1.5" />}
                {isArabic ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Detail Dialog ── */}
        <Dialog open={!!detailDialog} onOpenChange={v => { if (!v) setDetailDialog(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                {isArabic ? "تفاصيل المشتريات" : "Purchase Details"}
              </DialogTitle>
            </DialogHeader>
            {detailDialog && (
              <div className="space-y-3 pb-1">
                <Badge variant="outline" className="text-teal-600 border-teal-300">
                  {isArabic ? CATEGORY_LABEL[detailDialog.category].ar : CATEGORY_LABEL[detailDialog.category].en}
                </Badge>
                {isAdmin && (
                  <div className="bg-muted/40 rounded-lg px-4 py-2.5">
                    <p className="text-xs text-muted-foreground">{isArabic ? "الموظف" : "Employee"}</p>
                    <p className="text-sm font-semibold">{detailDialog.userName}</p>
                  </div>
                )}
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-4 text-center">
                  <p className="text-3xl font-bold text-primary tabular-nums">{fmt(detailDialog.amount)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{detailDialog.itemLabel}</p>
                </div>
                {detailDialog.description && (
                  <div className="bg-muted/20 border border-border rounded-lg px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-1">{isArabic ? "الوصف" : "Description"}</p>
                    <p className="text-sm leading-relaxed">{detailDialog.description}</p>
                  </div>
                )}
                {detailDialog.receiptUrl && (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <img src={apiUrl(detailDialog.receiptUrl)} alt="receipt" className="w-full max-h-56 object-contain bg-muted" />
                  </div>
                )}
                <div className="bg-muted/40 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{isArabic ? "فترة الراتب" : "Salary period"}</p>
                    <p className="text-sm font-medium">{detailDialog.period}</p>
                  </div>
                  {isAdmin && detailDialog.receiptUrl && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleDownload(detailDialog)}>
                      <Download className="w-3.5 h-3.5" />
                      {isArabic ? "تنزيل الفاتورة" : "Download Invoice"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-end">🕐 {new Date(detailDialog.createdAt).toLocaleString()}</p>
                <div className={`flex gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
                  {(isAdmin || detailDialog.userId === me?.id) && (
                    <Button variant="destructive" size="sm" className="flex-1 gap-1.5" onClick={() => { setDeleteConfirm(detailDialog); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {isArabic ? "حذف" : "Delete"}
                    </Button>
                  )}
                  <Button className="flex-1" size="sm" variant="outline" onClick={() => setDetailDialog(null)}>
                    {isArabic ? "إغلاق" : "Close"}
                  </Button>
                </div>
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
                {isArabic ? "حذف المشتريات" : "Delete Purchase"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {isArabic ? "هل أنت متأكد من حذف هذا السجل؟ سيتم إزالته من حساب الراتب. لا يمكن التراجع." : "Are you sure? It will be removed from the salary calculation. This cannot be undone."}
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
