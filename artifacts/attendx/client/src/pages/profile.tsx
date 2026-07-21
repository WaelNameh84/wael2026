import { useState, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@/lib/api-client/index";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiUrl, authHeaders, authFetch } from "@/lib/api-url";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  User, Mail, Phone, Building2, Briefcase, Clock, Calendar, Award,
  Banknote, CheckCircle, XCircle, TrendingUp, TrendingDown,
  Timer, BarChart3, FileText, AlertTriangle, ArrowLeft, Camera, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  present:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  late:        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  absent:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  excused:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  on_leave:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  early_leave: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};
const STATUS_AR: Record<string, string> = {
  present: "حاضر", late: "متأخر", absent: "غائب", excused: "معذور",
  on_leave: "إجازة", early_leave: "خروج مبكر",
};
const LEAVE_STATUS_AR: Record<string, string> = {
  pending: "بانتظار الموافقة", approved: "مقبول", rejected: "مرفوض",
};
const LEAVE_STATUS_COLOR: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ar-SY", { year: "numeric", month: "short", day: "numeric" });
}

export default function ProfilePage() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "الرجاء اختيار صورة", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "الصورة كبيرة جداً (الحد 20MB)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      // Read as data URL
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      // Upload to server storage
      const uploadRes = await authFetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileData }),
      });
      if (!uploadRes.ok) throw new Error("فشل رفع الصورة");
      const { path } = await uploadRes.json();
      // Save avatarUrl to user profile
      const patchRes = await authFetch(`/api/users/${me.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: path }),
      });
      if (!patchRes.ok) throw new Error("فشل حفظ الصورة");
      // Refresh me query so avatar shows immediately everywhere
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "✅ تم تحديث صورتك الشخصية" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message ?? "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [me, queryClient, toast]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${thisMonth}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: monthlySummary } = useQuery<any>({
    queryKey: ["profile-monthly-summary", thisMonth],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/attendance/summary/monthly?month=${thisMonth}`), { headers: authHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!me,
  });

  const { data: recentAttendance = [] } = useQuery<any[]>({
    queryKey: ["profile-attendance-recent"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/attendance?from=${monthStart}&to=${monthEnd}`), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!me,
  });

  const { data: leaves = [] } = useQuery<any[]>({
    queryKey: ["profile-leaves"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/leave"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!me,
  });

  const { data: bonusesSummary } = useQuery<any>({
    queryKey: ["profile-bonuses-summary"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/bonuses/summary/${me?.id}`), { headers: authHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!me,
  });

  const { data: advances = [] } = useQuery<any[]>({
    queryKey: ["profile-advances"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/salary-advances"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!me,
  });

  const { data: corrections = [] } = useQuery<any[]>({
    queryKey: ["profile-corrections"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/attendance-corrections"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!me,
  });

  if (meLoading) {
    return (
      <Layout>
        <div className="p-6 space-y-4 max-w-4xl mx-auto">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Layout>
    );
  }

  const daysPresent = monthlySummary?.present ?? 0;
  const daysLate    = monthlySummary?.late    ?? 0;
  const daysAbsent  = monthlySummary?.absent  ?? 0;
  const totalHours  = recentAttendance.reduce((s: number, r: any) => s + (r.hoursWorked ?? 0), 0);
  const totalOT     = recentAttendance.reduce((s: number, r: any) => s + (r.overtime ?? 0), 0);

  const approvedLeaves  = leaves.filter((l: any) => l.status === "approved").length;
  const pendingLeaves   = leaves.filter((l: any) => l.status === "pending").length;
  const pendingAdvances = advances.filter((a: any) => a.status === "pending").length;
  const pendingCorrections = corrections.filter((c: any) => c.status === "pending").length;

  const initials = (me?.name ?? "").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

        {/* Profile hero */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border rounded-2xl p-6">
          <div className="flex items-start gap-5 flex-wrap">
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{me?.name}</h1>
                <Badge
                  variant={(me?.role === "admin" || me?.role === "manager") ? "default" : "secondary"}
                  className={`capitalize ${me?.role === "manager" ? "bg-purple-600 hover:bg-purple-600 text-white" : ""}`}
                >
                  {me?.role === "admin" ? "مدير النظام" : me?.role === "manager" ? "مدير الشركة" : "موظف"}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {me?.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {me.email}
                  </p>
                )}
                {me?.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {me.phone}
                  </p>
                )}
                {me?.department && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" /> {me.department}
                  </p>
                )}
                {me?.position && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 flex-shrink-0" /> {me.position}
                  </p>
                )}
                {me?.workHoursPerDay && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Timer className="w-3.5 h-3.5 flex-shrink-0" /> {me.workHoursPerDay} ساعة/يوم
                  </p>
                )}
                {me?.createdAt && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    عضو منذ {fmtDate(me.createdAt)}
                  </p>
                )}
              </div>
            </div>
            {/* Avatar + upload */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <Link href="/settings">
                <Button variant="outline" size="sm" className="gap-1.5 w-full">
                  تعديل الملف ←
                </Button>
              </Link>
              {/* Hidden file input */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              {/* Avatar with camera overlay */}
              <div className="relative group">
                <div className="w-36 h-36 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-5xl font-bold shadow-xl overflow-hidden">
                  {me?.avatarUrl
                    ? <img src={apiUrl(me.avatarUrl)} alt={me.name} className="w-full h-full object-cover" />
                    : initials}
                </div>
                {/* Upload overlay */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="تغيير الصورة الشخصية"
                >
                  {uploading
                    ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                    : <Camera className="w-7 h-7 text-white" />
                  }
                </button>
                {/* Always-visible small camera badge */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-2 -end-2 w-9 h-9 rounded-full bg-primary border-2 border-background flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                  title="تغيير الصورة"
                >
                  {uploading
                    ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                    : <Camera className="w-4 h-4 text-white" />
                  }
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* This month stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            إحصائيات هذا الشهر — {new Date().toLocaleDateString("ar-SY", { month: "long", year: "numeric" })}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "أيام الحضور",    value: daysPresent,                  icon: CheckCircle, color: "text-green-500",  bg: "bg-green-500/10"  },
              { label: "أيام التأخر",    value: daysLate,                     icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
              { label: "أيام الغياب",   value: daysAbsent,                   icon: XCircle,     color: "text-red-500",    bg: "bg-red-500/10"    },
              { label: "ساعات العمل",    value: totalHours.toFixed(1) + " س", icon: Timer,       color: "text-primary",    bg: "bg-primary/10"    },
            ].map(s => (
              <div key={s.label} className={cn("rounded-xl p-4 border border-border bg-card")}>
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center mb-3", s.bg)}>
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions summary */}
        {(pendingLeaves > 0 || pendingAdvances > 0 || pendingCorrections > 0) && (
          <div className="bg-amber-500/5 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> طلبات بانتظار الموافقة
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingLeaves > 0 && (
                <Link href="/leave"><Badge variant="outline" className="text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 gap-1">
                  <Calendar className="w-3 h-3" /> {pendingLeaves} إجازة
                </Badge></Link>
              )}
              {pendingAdvances > 0 && (
                <Link href="/salary-advances"><Badge variant="outline" className="text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 gap-1">
                  <Banknote className="w-3 h-3" /> {pendingAdvances} سلفة
                </Badge></Link>
              )}
              {pendingCorrections > 0 && (
                <Link href="/attendance-corrections"><Badge variant="outline" className="text-amber-600 border-amber-300 cursor-pointer hover:bg-amber-50 gap-1">
                  <FileText className="w-3 h-3" /> {pendingCorrections} تصحيح
                </Badge></Link>
              )}
            </div>
          </div>
        )}

        {/* Detailed tabs */}
        <Tabs defaultValue="attendance">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="attendance">الحضور</TabsTrigger>
            <TabsTrigger value="leaves">الإجازات</TabsTrigger>
            <TabsTrigger value="financial">المالية</TabsTrigger>
            <TabsTrigger value="corrections">التصحيحات</TabsTrigger>
          </TabsList>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-4 space-y-3">
            {totalOT > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">إجمالي الأوفرتايم هذا الشهر</p>
                  <p className="text-xs text-muted-foreground">{totalOT.toFixed(2)} ساعة إضافية</p>
                </div>
              </div>
            )}
            {recentAttendance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">لا توجد سجلات هذا الشهر</p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2.5 text-start font-semibold text-foreground">التاريخ</th>
                      <th className="px-4 py-2.5 text-start font-semibold text-foreground">الدخول</th>
                      <th className="px-4 py-2.5 text-start font-semibold text-foreground">الخروج</th>
                      <th className="px-4 py-2.5 text-start font-semibold text-foreground">الساعات</th>
                      <th className="px-4 py-2.5 text-start font-semibold text-foreground">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.slice().reverse().map((r: any) => (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">{r.date}</td>
                        <td className="px-4 py-2.5 text-foreground/80">{fmtTime(r.checkIn)}</td>
                        <td className="px-4 py-2.5 text-foreground/80">{fmtTime(r.checkOut)}</td>
                        <td className="px-4 py-2.5 text-foreground">{r.hoursWorked ? `${r.hoursWorked}س` : "—"}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={cn("text-xs", STATUS_COLOR[r.status])}>
                            {STATUS_AR[r.status] ?? r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Leaves Tab */}
          <TabsContent value="leaves" className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "مقبولة",             value: approvedLeaves, color: "text-green-500" },
                { label: "بانتظار الموافقة",   value: pendingLeaves,  color: "text-amber-500" },
                { label: "إجمالي الطلبات",     value: leaves.length,  color: "text-foreground" },
              ].map(s => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {leaves.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">لا توجد طلبات إجازة</p>
            ) : (
              <div className="space-y-2">
                {leaves.slice(0, 10).map((l: any) => (
                  <div key={l.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{l.startDate} → {l.endDate}</p>
                      <p className="text-xs text-muted-foreground">{l.type} · {l.totalDays} أيام</p>
                    </div>
                    <Badge className={cn("text-xs flex-shrink-0", LEAVE_STATUS_COLOR[l.status])}>
                      {LEAVE_STATUS_AR[l.status] ?? l.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="mt-4 space-y-4">
            {/* Bonuses summary */}
            {bonusesSummary && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "مكافآت", value: `+${bonusesSummary.totalBonus?.toFixed(2) ?? 0}`, icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
                  { label: "خصومات", value: `−${bonusesSummary.totalDeduction?.toFixed(2) ?? 0}`, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
                  { label: "الصافي",  value: (bonusesSummary.net ?? 0) >= 0 ? `+${bonusesSummary.net?.toFixed(2)}` : bonusesSummary.net?.toFixed(2), icon: Award, color: (bonusesSummary.net ?? 0) >= 0 ? "text-green-500" : "text-red-500", bg: (bonusesSummary.net ?? 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10" },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center mb-2", s.bg)}>
                      <s.icon className={cn("w-4 h-4", s.color)} />
                    </div>
                    <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Salary advances */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Banknote className="w-3.5 h-3.5" /> السلف المالية ({advances.length})
              </h3>
              {advances.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm bg-muted/20 rounded-xl">لا توجد سلف</p>
              ) : (
                <div className="space-y-2">
                  {advances.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                      <Banknote className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{Number(a.amount).toLocaleString()} ريال</p>
                        <p className="text-xs text-muted-foreground">{a.reason ?? "—"} · {fmtDate(a.createdAt)}</p>
                      </div>
                      <Badge className={cn("text-xs", LEAVE_STATUS_COLOR[a.status])}>
                        {LEAVE_STATUS_AR[a.status] ?? a.status}
                      </Badge>
                    </div>
                  ))}
                  {advances.length > 5 && (
                    <Link href="/salary-advances">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        عرض كل السلف ({advances.length}) <ArrowLeft className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Corrections Tab */}
          <TabsContent value="corrections" className="mt-4 space-y-3">
            {corrections.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm bg-muted/20 rounded-xl">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>لا توجد طلبات تصحيح</p>
                <Link href="/attendance-corrections">
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> قدّم طلب تصحيح
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {corrections.slice(0, 8).map((c: any) => (
                    <div key={c.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{c.date}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {c.requestedCheckIn  && <span>دخول: {c.requestedCheckIn}</span>}
                          {c.requestedCheckOut && <span>خروج: {c.requestedCheckOut}</span>}
                        </div>
                      </div>
                      <Badge className={cn("text-xs flex-shrink-0",
                        c.status === "pending"  ? "bg-amber-100 text-amber-700" :
                        c.status === "approved" ? "bg-green-100 text-green-700" :
                                                  "bg-red-100 text-red-700"
                      )}>
                        {c.status === "pending" ? "بانتظار" : c.status === "approved" ? "مقبول" : "مرفوض"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Link href="/attendance-corrections">
                  <Button variant="outline" size="sm" className="w-full gap-1.5">
                    إدارة طلبات التصحيح <ArrowLeft className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
