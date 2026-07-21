import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useGetMe } from "@/lib/api-client/index";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, PartyPopper, Trash2, Loader2, CalendarDays, Flag } from "lucide-react";
import { apiUrl, authHeaders, authFetch } from "@/lib/api-url";

export interface Holiday {
  id: number;
  date: string;
  name: string;
  createdAt: string;
}

export const HOLIDAYS_QUERY_KEY = ["holidays"];

export function useHolidays() {
  return useQuery<Holiday[]>({
    queryKey: HOLIDAYS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/holidays"), { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load holidays");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export default function HolidaysPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const { data: holidays, isLoading } = useHolidays();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: "", name: "" });
  const [creating, setCreating] = useState(false);
  const [importingSwedish, setImportingSwedish] = useState(false);

  /* ── حساب عطل السويد الرسمية لسنة معينة ── */
  function getSwedishHolidays(year: number): { date: string; name: string }[] {
    // حساب عيد الفصح بخوارزمية Meeus/Jones/Butcher
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const easter = new Date(year, month - 1, day);

    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const add = (base: Date, days: number) => {
      const d = new Date(base); d.setDate(d.getDate() + days); return d;
    };

    // مidsommar: أول جمعة بعد أو في 19 يونيو
    const june19 = new Date(year, 5, 19);
    const midsommarEve = new Date(june19);
    while (midsommarEve.getDay() !== 5) midsommarEve.setDate(midsommarEve.getDate() + 1);

    // Alla helgons dag: أول سبت في أو بعد 31 أكتوبر
    const oct31 = new Date(year, 9, 31);
    const allSaints = new Date(oct31);
    while (allSaints.getDay() !== 6) allSaints.setDate(allSaints.getDate() + 1);

    return [
      { date: `${year}-01-01`, name: "Nyårsdagen – رأس السنة" },
      { date: `${year}-01-06`, name: "Trettondedag jul – عيد الغطاس" },
      { date: fmt(add(easter, -2)),  name: "Långfredagen – الجمعة العظيمة" },
      { date: fmt(easter),           name: "Påskdagen – أحد الفصح" },
      { date: fmt(add(easter, 1)),   name: "Annandag påsk – اثنين الفصح" },
      { date: `${year}-05-01`,       name: "Första maj – عيد العمال" },
      { date: fmt(add(easter, 39)),  name: "Kristi himmelsfärdsdag – الصعود" },
      { date: fmt(add(easter, 49)),  name: "Pingstdagen – عيد العنصرة" },
      { date: `${year}-06-06`,       name: "Sveriges nationaldag – اليوم الوطني السويدي" },
      { date: fmt(midsommarEve),     name: "Midsommarafton – عشية منتصف الصيف" },
      { date: fmt(add(midsommarEve, 1)), name: "Midsommardagen – يوم منتصف الصيف" },
      { date: fmt(allSaints),        name: "Alla helgons dag – عيد جميع القديسين" },
      { date: `${year}-12-24`,       name: "Julafton – عشية الميلاد" },
      { date: `${year}-12-25`,       name: "Juldagen – عيد الميلاد" },
      { date: `${year}-12-26`,       name: "Annandag jul – ثاني أيام الميلاد" },
      { date: `${year}-12-31`,       name: "Nyårsafton – عشية رأس السنة" },
    ];
  }

  const refresh = () => qc.invalidateQueries({ queryKey: HOLIDAYS_QUERY_KEY });

  const handleImportSwedish = async () => {
    setImportingSwedish(true);
    const year = new Date().getFullYear();
    const toImport = getSwedishHolidays(year);
    const existing = new Set((holidays ?? []).map(h => h.date));
    const newOnes = toImport.filter(h => !existing.has(h.date));

    if (newOnes.length === 0) {
      toast({ title: isArabic ? "العطل السويدية موجودة بالفعل" : "Swedish holidays already added" });
      setImportingSwedish(false);
      return;
    }

    let added = 0;
    for (const h of newOnes) {
      try {
        const res = await authFetch(apiUrl("/api/holidays"), {
          method: "POST",
          body: JSON.stringify(h),
        });
        if (res.ok) added++;
      } catch { /* تجاهل الخطأ الفردي */ }
    }

    toast({ title: `✅ تمت إضافة ${added} عطلة سويدية لعام ${year}` });
    refresh();
    setImportingSwedish(false);
  };

  // استيراد تلقائي للعطل السويدية عند أول فتح للصفحة إن كانت القائمة فارغة
  useEffect(() => {
    if (!isLoading && isAdmin && holidays !== undefined && holidays.length === 0) {
      handleImportSwedish();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAdmin, holidays?.length]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await authFetch(apiUrl("/api/holidays"), {
        method: "POST",
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? (isArabic ? "فشلت الإضافة" : "Failed to add"));
      toast({ title: isArabic ? "تمت إضافة العطلة" : "Holiday added" });
      setOpen(false);
      setForm({ date: "", name: "" });
      refresh();
    } catch (err: any) {
      toast({ title: isArabic ? "فشلت الإضافة" : "Failed", description: err?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(isArabic ? `حذف "${name}"؟` : `Delete "${name}"?`)) return;
    try {
      const res = await authFetch(apiUrl(`/api/holidays/${id}`), { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      toast({ title: isArabic ? "تم الحذف" : "Deleted" });
      refresh();
    } catch {
      toast({ title: isArabic ? "فشل الحذف" : "Failed", variant: "destructive" });
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const sorted = [...(holidays ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(h => h.date >= todayStr);
  const past = sorted.filter(h => h.date < todayStr).reverse();

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(isArabic ? "ar-EG" : "en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  const HolidayRow = ({ h, dimmed }: { h: Holiday; dimmed?: boolean }) => (
    <div className="px-5 py-3.5 flex items-center gap-4" data-testid={`row-holiday-${h.id}`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${dimmed ? "bg-muted" : "bg-primary/10"}`}>
        <PartyPopper className={`w-4 h-4 ${dimmed ? "text-muted-foreground" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${dimmed ? "text-muted-foreground" : ""}`}>{h.name}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(h.date)}</p>
      </div>
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive flex-shrink-0"
          onClick={() => handleDelete(h.id, h.name)}
          data-testid={`button-delete-holiday-${h.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-primary" />
              {isArabic ? "العطل الرسمية" : "Official Holidays"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isArabic
                ? "أيام العطل الرسمية تُحتسب مدفوعة تلقائياً لكل الموظفين، ولا حاجة لتقديم طلب إجازة عنها"
                : "Official holidays are automatically paid for everyone — no leave request needed"}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleImportSwedish}
                disabled={importingSwedish}
              >
                {importingSwedish
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Flag className="w-4 h-4" />}
                {isArabic ? "🇸🇪 استيراد العطل السويدية" : "🇸🇪 Import Swedish Holidays"}
              </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-add-holiday">
                  <Plus className="w-4 h-4" /> {isArabic ? "إضافة عطلة" : "Add Holiday"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{isArabic ? "إضافة عطلة رسمية" : "Add Official Holiday"}</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label>{isArabic ? "التاريخ" : "Date"}</Label>
                    <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required data-testid="input-holiday-date" />
                  </div>
                  <div className="space-y-1">
                    <Label>{isArabic ? "اسم العطلة" : "Holiday name"}</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder={isArabic ? "عيد الفطر" : "New Year's Day"} data-testid="input-holiday-name" />
                  </div>
                  <Button type="submit" className="w-full" disabled={creating} data-testid="button-create-holiday">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                    {isArabic ? "إضافة" : "Add"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-sm">{isArabic ? "القادمة" : "Upcoming"}</h2>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : upcoming.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {isArabic ? "لا توجد عطل قادمة" : "No upcoming holidays"}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {upcoming.map(h => <HolidayRow key={h.id} h={h} />)}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-sm">{isArabic ? "سابقة" : "Past"}</h2>
            </div>
            <div className="divide-y divide-border">
              {past.slice(0, 20).map(h => <HolidayRow key={h.id} h={h} dimmed />)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
