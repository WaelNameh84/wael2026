import Layout from "@/components/Layout";
import { compressImage } from "@/lib/compress-image";
import { useTranslation } from "@/lib/i18n";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { useUpdateSettings, useChangePassword, getGetSettingsQueryKey, useGetMe } from "@/lib/api-client/index";
import { useQueryClient } from "@tanstack/react-query";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2, Moon, Sun, Monitor, Globe, Type, Lock,
  Fingerprint, MapPin, Database, Download, KeyRound,
  Eye, EyeOff, CheckCircle2, XCircle, ShieldCheck, AppWindow, UserCog, Volume2, VolumeX,
  Clock, AlignCenter, Minimize2, Maximize2, Bell, BellOff, BellRing, LogIn,
  Bot, Sparkles, ChevronDown, Play,
  Zap, Star, Heart, MessageCircle, Cpu, Wand2, Rocket, Brain, RotateCcw,
  Paintbrush, SendHorizonal, Save, Navigation, Search, Camera, Trash2, Smartphone, DollarSign,
  Check, Plus, Mail, Server, AtSign, KeyRound as KeyRound2, TestTube2,
  Shield, Atom, Compass, Gem, Ghost, Crown, Coffee, Flame, Target, Globe2,
  PowerOff, SlidersHorizontal, SmilePlus,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import type { AiButtonIcon, AiButtonShape, AiButtonColor, AvatarStyle, AiButtonSize, WelcomeStyle, SplashBgGradient, SplashStyle } from "@/hooks/use-settings";
import { CURRENCIES } from "@/lib/format-currency";
import ClockWidget from "@/components/ClockWidget";
import {
  getDailyRemindersEnabled, setDailyRemindersEnabled,
  requestNotificationPermission, getNotificationPermission,
  scheduleDailyReminders, cancelDailyReminders, sendTestNotification,
} from "@/lib/notifications";
import {
  getAlarmSettings, saveAlarmSettings, scheduleShiftAlarms,
  cancelShiftAlarms, playAlarmSound, playNotifSound,
  getNotifSoundType, saveNotifSoundType,
  warmUpAudioContext, stopAudioKeepAlive,
  type ShiftAlarmSettings, type AlarmSoundType, type NotifSoundType,
} from "@/lib/alarm";
import { playSuccess as playSoundTest, primeAudio } from "@/lib/sounds";
import type { AssistantPersonality } from "@/hooks/use-settings";
import { authFetch, apiUrl } from "@/lib/api-url";
import { syncPushSubscription } from "@/lib/push-alarm";
import { Robot3DIcon, Gem3DIcon, Brain3DIcon, Flame3DIcon, Star3DIcon, Orb3DIcon, Shield3DIcon, Crown3DIcon, Rocket3DIcon, Eye3DIcon, Neural3DIcon, Hologram3DIcon, Infinity3DIcon, Dna3DIcon, Chip3DIcon } from "@/components/AiIcons3D";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/* ─────────────────────────────────────────────────────────────
   Accordion Section Component
───────────────────────────────────────────────────────────── */
function Section({
  id, icon, title, badge, children, open, onToggle, accent,
}: {
  id: string; icon: React.ReactNode; title: string; badge?: React.ReactNode;
  children: React.ReactNode; open: boolean; onToggle: () => void; accent?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-4 text-start hover:bg-muted/30 transition-colors",
          open && "border-b border-border"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          accent ?? "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
        <span className="font-semibold flex-1 text-sm">{title}</span>
        {badge}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform flex-shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 py-4 space-y-5 animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const Toggle = ({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    aria-label={label}
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
  </button>
);

/* ─────────────────────────────────────────────────────────────
   Clear Records Dialog
───────────────────────────────────────────────────────────── */
const CLEAR_ITEMS = [
  { key: "attendance",             labelAr: "سجل الحضور والغياب",      labelEn: "Attendance Records"       },
  { key: "attendance_corrections", labelAr: "تصحيحات الحضور",          labelEn: "Attendance Corrections"   },
  { key: "late_justifications",    labelAr: "مبررات التأخر",            labelEn: "Late Justifications"      },
  { key: "leave",                  labelAr: "سجل الإجازات",             labelEn: "Leave Records"            },
  { key: "work_reports",           labelAr: "تقارير العمل",             labelEn: "Work Reports"             },
  { key: "requests",               labelAr: "الطلبات",                  labelEn: "Requests"                 },
  { key: "notifications",          labelAr: "الإشعارات",                labelEn: "Notifications"            },
  { key: "messages",               labelAr: "الرسائل",                  labelEn: "Messages"                 },
  { key: "salary_advances",        labelAr: "السلف",                    labelEn: "Salary Advances"          },
  { key: "bonuses",                labelAr: "المكافآت",                 labelEn: "Bonuses"                  },
  { key: "purchases",              labelAr: "المشتريات",                labelEn: "Purchases"                },
  { key: "payroll_reports",        labelAr: "كشف الرواتب",              labelEn: "Payroll Reports"          },
];

function ClearRecordsDialog({ isArabic }: { isArabic: boolean }) {
  const { toast } = useToast();
  const L = (ar: string, en: string) => isArabic ? ar : en;

  // steps: "employees" → "types" → "confirm"
  const [open, setOpen]               = useState(false);
  const [step, setStep]               = useState<"employees"|"types"|"confirm">("employees");
  const [clearing, setClearing]       = useState(false);

  // employee selection
  const [employees, setEmployees]     = useState<{id:number;name:string;role:string;department?:string}[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [empSearch, setEmpSearch]     = useState("");
  const [allEmps, setAllEmps]         = useState(true);          // true = كل الموظفين
  const [selEmps, setSelEmps]         = useState<Set<number>>(new Set());

  // record type selection
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  const resetAndOpen = async () => {
    setStep("employees");
    setAllEmps(true);
    setSelEmps(new Set());
    setSelected(new Set());
    setEmpSearch("");
    setOpen(true);
    setLoadingEmps(true);
    try {
      const res = await authFetch(apiUrl("/api/users"));
      if (res.ok) {
        const data = await res.json();
        setEmployees((data ?? []).filter((u: any) => u.role !== "admin"));
      }
    } catch { /* ignore */ }
    setLoadingEmps(false);
  };

  const toggleEmp = (id: number) =>
    setSelEmps(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggle = (key: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const toggleAllTypes = () =>
    setSelected(selected.size === CLEAR_ITEMS.length ? new Set() : new Set(CLEAR_ITEMS.map(i => i.key)));

  const filteredEmps = employees.filter(e =>
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.department ?? "").toLowerCase().includes(empSearch.toLowerCase())
  );

  const handleClear = async () => {
    if (selected.size === 0) return;
    setClearing(true);
    try {
      const body: any = { tables: Array.from(selected) };
      if (!allEmps) body.userIds = Array.from(selEmps);
      const res = await authFetch(apiUrl("/api/backups/clear-records"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const empLabel = allEmps
        ? L("جميع الموظفين", "all employees")
        : `${selEmps.size} ${L("موظف", "employee(s)")}`;
      toast({ title: L(`تم المسح بنجاح ✓ (${empLabel})`, `Records cleared ✓ (${empLabel})`) });
      setOpen(false);
    } catch {
      toast({ title: L("فشل المسح", "Clear failed"), variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const canNextEmps = allEmps || selEmps.size > 0;

  // Lock body scroll on iOS when modal is open
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const original = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top:      document.body.style.top,
      width:    document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.width    = "100%";
    return () => {
      document.body.style.overflow = original.overflow;
      document.body.style.position = original.position;
      document.body.style.top      = original.top;
      document.body.style.width    = original.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={resetAndOpen}
        className="w-full flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
      >
        <Trash2 className="w-4 h-4 shrink-0" />
        <div className="text-start">
          <p className="text-sm font-semibold">{L("مسح السجل", "Clear Records")}</p>
          <p className="text-xs opacity-70">{L("اختر الموظف ونوع البيانات التي تريد حذفها", "Choose employee and record types to delete")}</p>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm mx-auto bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-4 h-4" />
                <span className="font-semibold text-sm">
                  {step === "employees" ? L("اختر الموظف", "Select Employee")
                   : step === "types"   ? L("اختر نوع السجل", "Select Record Types")
                   :                      L("تأكيد المسح", "Confirm Clear")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* step dots */}
                <div className="flex gap-1">
                  {(["employees","types","confirm"] as const).map((s,i) => (
                    <span key={s} className={`w-1.5 h-1.5 rounded-full transition-colors ${step === s ? "bg-red-500" : i < ["employees","types","confirm"].indexOf(step) ? "bg-red-300" : "bg-muted"}`} />
                  ))}
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">✕</button>
              </div>
            </div>

            {/* ── STEP 1: اختيار الموظف ── */}
            {step === "employees" && (
              <>
                <div className="px-5 pt-3 pb-2 shrink-0 space-y-2">
                  {/* all / specific toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAllEmps(true)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${allEmps ? "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-600" : "border-border hover:bg-muted/50"}`}
                    >
                      {L("كل الموظفين", "All Employees")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllEmps(false)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${!allEmps ? "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-600" : "border-border hover:bg-muted/50"}`}
                    >
                      {L("موظف محدد", "Specific Employee")}
                    </button>
                  </div>

                  {!allEmps && (
                    <input
                      type="text"
                      value={empSearch}
                      onChange={e => setEmpSearch(e.target.value)}
                      placeholder={L("ابحث عن موظف...", "Search employee...")}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>

                {!allEmps && (
                  <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-1">
                    {loadingEmps ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : filteredEmps.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">{L("لا يوجد موظفون", "No employees found")}</p>
                    ) : (
                      filteredEmps.map(emp => (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                            selEmps.has(emp.id)
                              ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                              : "hover:bg-muted/50 border border-transparent"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selEmps.has(emp.id)}
                            onChange={() => toggleEmp(emp.id)}
                            className="accent-red-500 w-4 h-4 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{emp.name}</p>
                            {emp.department && <p className="text-xs text-muted-foreground truncate">{emp.department}</p>}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                )}

                {allEmps && (
                  <div className="px-5 py-4 flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center">
                      {L("سيتم تطبيق المسح على سجلات جميع الموظفين.", "Clear will apply to all employee records.")}
                    </p>
                  </div>
                )}

                <div className="px-5 pb-5 pt-3 border-t shrink-0 flex gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                    {L("إلغاء", "Cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={!canNextEmps}
                    onClick={() => setStep("types")}
                    className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    {L("التالي", "Next")} →
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2: اختيار نوع السجل ── */}
            {step === "types" && (
              <>
                <div className="px-5 pt-3 pb-1 shrink-0">
                  <button type="button" onClick={toggleAllTypes} className="text-xs text-primary font-medium hover:underline">
                    {selected.size === CLEAR_ITEMS.length ? L("إلغاء تحديد الكل", "Deselect all") : L("تحديد الكل", "Select all")}
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-1">
                  {CLEAR_ITEMS.map(item => (
                    <label
                      key={item.key}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        selected.has(item.key)
                          ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                    >
                      <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} className="accent-red-500 w-4 h-4 shrink-0" />
                      <span className="text-sm">{isArabic ? item.labelAr : item.labelEn}</span>
                    </label>
                  ))}
                </div>

                <div className="px-5 pb-5 pt-3 border-t shrink-0 flex gap-2">
                  <button type="button" onClick={() => setStep("employees")} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                    ← {L("رجوع", "Back")}
                  </button>
                  <button
                    type="button"
                    disabled={selected.size === 0}
                    onClick={() => setStep("confirm")}
                    className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    {L(`مسح (${selected.size})`, `Clear (${selected.size})`)}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3: تأكيد ── */}
            {step === "confirm" && (
              <div className="px-5 py-6 space-y-4 flex-1">
                <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 space-y-2">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">{L("ملخص العملية", "Summary")}</p>
                  <p className="text-xs text-muted-foreground">
                    {L("الموظفون:", "Employees:")} <span className="font-medium text-foreground">
                      {allEmps ? L("الكل", "All") : `${selEmps.size} ${L("موظف", "employee(s)")}`}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {L("السجلات:", "Records:")} <span className="font-medium text-foreground">{selected.size} {L("نوع", "type(s)")}</span>
                  </p>
                  <p className="text-xs text-red-600 font-medium mt-1">
                    ⚠️ {L("لا يمكن التراجع عن هذا الإجراء.", "This action cannot be undone.")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("types")} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">
                    ← {L("رجوع", "Back")}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={clearing}
                    className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {clearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {L("نعم، امسح الآن", "Yes, clear now")}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Backup Section Component
───────────────────────────────────────────────────────────── */
function BackupSection({ isArabic }: { isArabic: boolean }) {
  const { toast } = useToast();
  const [backups, setBackups]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(false);
  const [downloading, setDownloading]     = useState<number | null>(null);
  const [deleting, setDeleting]           = useState<number | null>(null);
  const [saving, setSaving]               = useState(false);
  const [restoring, setRestoring]         = useState(false);
  const [autoEnabled, setAutoEnabled]     = useState(false);
  const [autoDay, setAutoDay]             = useState(1);
  const [autoSaving, setAutoSaving]       = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<{ file: File; data: any } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const L = (ar: string, en: string) => isArabic ? ar : en;

  // تحميل القائمة + إعدادات النسخ التلقائي
  const loadBackups = async () => {
    setLoading(true);
    try {
      const [listRes, cfgRes] = await Promise.all([
        authFetch(apiUrl("/api/backups")),
        authFetch(apiUrl("/api/backups/auto-settings")),
      ]);
      if (listRes.ok) setBackups(await listRes.json());
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setAutoEnabled(cfg.enabled);
        setAutoDay(cfg.day);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBackups(); }, []);

  // ── نسخ فوري (تنزيل مباشر) ──────────────────────────────────
  const handleInstantDownload = async () => {
    setDownloading(-1);
    try {
      const res = await authFetch(apiUrl("/api/backups/download"), { method: "POST" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `attendx_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: L("تم تنزيل النسخة الاحتياطية ✓", "Backup downloaded ✓") });
    } catch {
      toast({ title: L("فشل الإنشاء", "Backup failed"), variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  // ── حفظ نسخة في التطبيق ─────────────────────────────────────
  const handleSaveInApp = async () => {
    setSaving(true);
    try {
      const name = `${L("نسخة", "Backup")} ${new Date().toLocaleDateString(isArabic ? "ar-EG-u-ca-gregory" : "en-GB")}`;
      const res  = await authFetch(apiUrl("/api/backups/save"), {
        method: "POST", body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      toast({ title: L("تم الحفظ بنجاح ✓", "Saved successfully ✓") });
      loadBackups();
    } catch {
      toast({ title: L("فشل الحفظ", "Save failed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── تنزيل نسخة محفوظة ───────────────────────────────────────
  const handleDownloadSaved = async (id: number, name: string) => {
    setDownloading(id);
    try {
      const res = await authFetch(apiUrl(`/api/backups/${id}/download`));
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `attendx_${name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: L("فشل التنزيل", "Download failed"), variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  // ── حذف نسخة ────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeleting(id);
    try {
      await authFetch(apiUrl(`/api/backups/${id}`), { method: "DELETE" });
      setBackups(b => b.filter(x => x.id !== id));
    } catch {
      toast({ title: L("فشل الحذف", "Delete failed"), variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  // ── قراءة ملف الاستعادة ──────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data?.version !== 1 || !data?.tables) {
          toast({ title: L("الملف غير صالح", "Invalid backup file"), variant: "destructive" });
          return;
        }
        setConfirmRestore({ file, data });
      } catch {
        toast({ title: L("الملف تالف", "Corrupted file"), variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── تنفيذ الاستعادة ──────────────────────────────────────────
  const handleRestore = async () => {
    if (!confirmRestore) return;
    setRestoring(true);
    try {
      const res = await authFetch(apiUrl("/api/backups/restore"), {
        method: "POST", body: JSON.stringify(confirmRestore.data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ title: L("تمت الاستعادة بنجاح ✓ سيُعاد تحميل الصفحة", "Restored successfully ✓ Reloading...") });
      setConfirmRestore(null);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast({ title: err?.message || L("فشلت الاستعادة", "Restore failed"), variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  // ── حفظ إعدادات النسخ التلقائي ──────────────────────────────
  const handleSaveAutoSettings = async () => {
    setAutoSaving(true);
    try {
      const res = await authFetch(apiUrl("/api/backups/auto-settings"), {
        method: "POST", body: JSON.stringify({ enabled: autoEnabled, day: autoDay }),
      });
      if (!res.ok) throw new Error();
      toast({ title: L("تم حفظ إعدادات النسخ التلقائي ✓", "Auto-backup settings saved ✓") });
    } catch {
      toast({ title: L("فشل الحفظ", "Save failed"), variant: "destructive" });
    } finally {
      setAutoSaving(false);
    }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">

      {/* ── نسخ فوري ── */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border/40">
        <p className="text-sm font-semibold">{L("نسخة احتياطية فورية", "Instant Backup")}</p>
        <p className="text-xs text-muted-foreground">
          {L("تنزيل ملف JSON يحتوي على جميع بيانات التطبيق مباشرة إلى جهازك.", "Downloads a JSON file with all app data directly to your device.")}
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={handleInstantDownload} disabled={downloading === -1}>
            {downloading === -1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {L("تنزيل الآن", "Download Now")}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleSaveInApp} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {L("حفظ في التطبيق", "Save in App")}
          </Button>
        </div>
      </div>

      {/* ── النسخ التلقائي الشهري ── */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3 border border-border/40">
        <p className="text-sm font-semibold">{L("النسخ التلقائي الشهري", "Monthly Auto-Backup")}</p>
        <p className="text-xs text-muted-foreground">
          {L("يحفظ نسخة تلقائية في التطبيق كل شهر في اليوم الذي تحدده.", "Automatically saves a backup inside the app every month on the day you choose.")}
        </p>
        <div className="flex items-center gap-3">
          <Toggle enabled={autoEnabled} onChange={setAutoEnabled} label={L("تفعيل النسخ التلقائي", "Enable auto-backup")} />
          <span className="text-sm">{L("تفعيل النسخ التلقائي", "Enable auto-backup")}</span>
        </div>
        {autoEnabled && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{L("يوم الحفظ كل شهر:", "Backup day each month:")}</span>
            <Select value={String(autoDay)} onValueChange={v => setAutoDay(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-48 overflow-y-auto z-[200]">
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <SelectItem key={d} value={String(d)}>{L(`اليوم ${d}`, `Day ${d}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" onClick={handleSaveAutoSettings} disabled={autoSaving} className="gap-1.5">
          {autoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {L("حفظ الإعداد", "Save Setting")}
        </Button>
      </div>

      {/* ── النسخ المحفوظة ── */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">{L("النسخ المحفوظة في التطبيق", "Saved Backups")}</p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {L("جاري التحميل...", "Loading...")}
          </div>
        ) : backups.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">{L("لا توجد نسخ محفوظة بعد", "No saved backups yet")}</p>
        ) : (
          <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden">
            {backups.map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleDateString(isArabic ? "ar-EG-u-ca-gregory" : "en-GB")}
                    {" · "}
                    {fmtSize(b.size_bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 px-2"
                    disabled={downloading === b.id}
                    onClick={() => handleDownloadSaved(b.id, b.name)}>
                    {downloading === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {L("تنزيل", "Download")}
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    disabled={deleting === b.id}
                    onClick={() => handleDelete(b.id)}>
                    {deleting === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    {L("حذف", "Delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── استعادة من ملف ── */}
      <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{L("استعادة من ملف", "Restore from File")}</p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {L("ارفع ملف نسخة احتياطية لاستعادة جميع البيانات. سيتم استبدال البيانات الحالية.", "Upload a backup file to restore all data. Current data will be replaced.")}
        </p>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
        <Button variant="outline" size="sm" className="gap-2 border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          onClick={() => fileRef.current?.click()}>
          <Upload className="w-3.5 h-3.5" />
          {L("اختيار ملف النسخة", "Choose Backup File")}
        </Button>
      </div>

      {/* ── نافذة تأكيد الاستعادة ── */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-base">{L("تأكيد الاستعادة", "Confirm Restore")}</p>
                <p className="text-xs text-muted-foreground">{confirmRestore.file.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {L(
                "سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية. هذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد؟",
                "All current data will be replaced with the backup. This action cannot be undone. Are you sure?"
              )}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white" onClick={handleRestore} disabled={restoring}>
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                {L("نعم، استعد الآن", "Yes, Restore Now")}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmRestore(null)} disabled={restoring}>
                {L("إلغاء", "Cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GPS Location Map Component
───────────────────────────────────────────────────────────── */
function GpsLocationSearch({ isArabic }: { isArabic: boolean }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ lat: string; lon: string; display_name: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResult(null); setError(""); return; }
    setSearching(true); setError(""); setResult(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { "Accept-Language": isArabic ? "ar" : "en" }, signal: controller.signal }
      );
      clearTimeout(timer);
      const data = await res.json();
      if (data.length > 0) {
        setResult({ lat: data[0].lat, lon: data[0].lon, display_name: data[0].display_name });
      } else {
        setError(isArabic ? "لم يتم العثور على الموقع" : "Location not found");
      }
    } catch {
      setError(isArabic ? "فشل الاتصال، تحقق من الإنترنت" : "Connection failed — check your internet");
    } finally {
      setSearching(false);
    }
  }, [isArabic]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 700);
  };

  const copyCoords = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${parseFloat(result.lat).toFixed(6)}, ${parseFloat(result.lon).toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mapSrc = result
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(result.lon)-0.02},${parseFloat(result.lat)-0.02},${parseFloat(result.lon)+0.02},${parseFloat(result.lat)+0.02}&layer=mapnik&marker=${result.lat},${result.lon}`
    : null;

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Search className="w-3.5 h-3.5 text-primary" />
          {isArabic ? "البحث عن موقع جغرافي" : "Search for a location"}
        </Label>
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={isArabic ? "ابحث عن موقع..." : "Search location..."}
            className="ps-8 pe-8"
          />
          {searching && (
            <Loader2 className="absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
          )}
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-2.5 py-1.5">
            <span className="w-3.5 h-3.5 flex-shrink-0">⚠</span>
            {error}
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 line-clamp-2 leading-snug">{result.display_name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <code className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded font-mono">
                  {parseFloat(result.lat).toFixed(5)}, {parseFloat(result.lon).toFixed(5)}
                </code>
                <button
                  onClick={copyCoords}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 transition-colors flex items-center gap-1 font-medium"
                >
                  {copied ? "✓ " + (isArabic ? "تم النسخ" : "Copied!") : isArabic ? "نسخ" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{ height: 240 }}>
            <iframe
              title="location-map"
              src={mapSrc!}
              width="100%"
              height="240"
              style={{ border: 0, display: "block" }}
              loading="lazy"
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">OpenStreetMap</a> contributors
          </p>
        </div>
      )}

      {/* Empty state */}
      {!result && !searching && !error && !query && (
        <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <p className="text-xs text-center">{isArabic ? "ابحث عن أي موقع على الخريطة" : "Search for any location on the map"}</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Settings Page
───────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  /*
   * NOTE ON SAVE-ON-CLICK BEHAVIOR:
   * Every setting below is "buffered" — changing a control in the UI only
   * updates local draft state (declared further down with the SAME name the
   * JSX already reads, e.g. `theme`, `currency`, `sidebarStyle`…). Nothing is
   * written to the live app (context/localStorage/visual DOM changes) until
   * the user presses "Save Settings", at which point handleSaveAll calls the
   * real `applyX` setter (aliased from useSettings() below) for every field.
   * This is why context values are destructured under `live*`/`apply*`
   * names instead of their natural names — so the rest of this file's JSX,
   * which was written against the natural names, transparently reads/writes
   * the buffered draft copies instead of the live context.
   */
  const {
    theme: liveTheme, fontSize: liveFontSize, language: liveLanguage,
    ttsEnabled: liveTtsEnabled, navTtsEnabled: liveNavTtsEnabled, wakeWord: liveWakeWord, assistantName: liveAssistantName, assistantPersonality: liveAssistantPersonality,
    aiButtonIcon: liveAiButtonIcon, aiButtonShape: liveAiButtonShape, aiButtonColor: liveAiButtonColor, aiButtonCustomColor: liveAiButtonCustomColor,
    aiEnabled: liveAiEnabled, aiAvatarStyle: liveAiAvatarStyle, aiButtonSize: liveAiButtonSize,
    setTheme: applyTheme, setFontSize: applyFontSize, setLanguage: applyLanguage, setTtsEnabled: applyTtsEnabled, setNavTtsEnabled: applyNavTtsEnabled, setWakeWord: applyWakeWord, setAssistantName: applyAssistantName, setAssistantPersonality: applyAssistantPersonality,
    setAiButtonIcon: applyAiButtonIcon, setAiButtonShape: applyAiButtonShape, setAiButtonColor: applyAiButtonColor, setAiButtonCustomColor: applyAiButtonCustomColor,
    setAiEnabled: applyAiEnabled, setAiAvatarStyle: applyAiAvatarStyle, setAiButtonSize: applyAiButtonSize,
    clockFormat: liveClockFormat, clockLocale: liveClockLocale, clockStyle: liveClockStyle, clockSize: liveClockSize, floatingClockEnabled: liveFloatingClockEnabled, floatingClockCheckIn: liveFloatingClockCheckIn,
    setClockFormat: applyClockFormat, setClockLocale: applyClockLocale, setClockStyle: applyClockStyle, setClockSize: applyClockSize, setFloatingClockEnabled: applyFloatingClockEnabled, setFloatingClockCheckIn: applyFloatingClockCheckIn,
    sidebarStyle: liveSidebarStyle, cardStyle: liveCardStyle, tableStyle: liveTableStyle, accentColor: liveAccentColor,
    cardColorMode: liveCardColorMode, cardColor: liveCardColor,
    fontColorMode: liveFontColorMode, fontColor: liveFontColor,
    setSidebarStyle: applySidebarStyle, setCardStyle: applyCardStyle, setTableStyle: applyTableStyle, setAccentColor: applyAccentColor,
    setCardColorMode: applyCardColorMode, setCardColor: applyCardColor,
    setFontColorMode: applyFontColorMode, setFontColor: applyFontColor,
    fontFamily: liveFontFamily, setFontFamily: applyFontFamily,
    fontWeight: liveFontWeight, setFontWeight: applyFontWeight,
    glassIntensity: liveGlassIntensity, backgroundMode: liveBackgroundMode, backgroundImage: liveBackgroundImage, backgroundGradient: liveBackgroundGradient,
    setGlassIntensity: applyGlassIntensity, setBackgroundMode: applyBackgroundMode, setBackgroundImage: applyBackgroundImage, setBackgroundGradient: applyBackgroundGradient,
    particlesEnabled, mouseLightEnabled,
    setParticlesEnabled, setMouseLightEnabled,
    welcomeBannerEnabled: liveWelcomeBannerEnabled, setWelcomeBannerEnabled: applyWelcomeBannerEnabled,
    welcomeMessage: liveWelcomeMessage, setWelcomeMessage: applyWelcomeMessage,
    welcomeShape: liveWelcomeShape, setWelcomeShape: applyWelcomeShape,
    welcomeImage: liveWelcomeImage, setWelcomeImage: applyWelcomeImage,
    welcomeTitle: liveWelcomeTitle, setWelcomeTitle: applyWelcomeTitle,
    welcomeStyle: liveWelcomeStyle, setWelcomeStyle: applyWelcomeStyle,
    aiVoiceResponse: liveAiVoiceResponse, setAiVoiceResponse: applyAiVoiceResponse,
    soundEnabled: liveSoundEnabled, soundVolume: liveSoundVolume, setSoundEnabled: applySoundEnabled, setSoundVolume: applySoundVolume,
    latenessAlertEnabled: liveLatenessAlertEnabled, latenessAlertDays: liveLatenessAlertDays, setLatenessAlertEnabled: applyLatenessAlertEnabled, setLatenessAlertDays: applyLatenessAlertDays,
    currency: liveCurrency, setCurrency: applyCurrency,
    splashBgGradient: liveSplashBgGradient, setSplashBgGradient: applySplashBgGradient,
    splashTagline: liveSplashTagline, setSplashTagline: applySplashTagline,
    splashDuration: liveSplashDuration, setSplashDuration: applySplashDuration,
    splashShowStars: liveSplashShowStars, setSplashShowStars: applySplashShowStars,
    splashShowParticles: liveSplashShowParticles, setSplashShowParticles: applySplashShowParticles,
    splashLogoUrl: liveSplashLogoUrl, setSplashLogoUrl: applySplashLogoUrl,
    splashLogoWidth: liveSplashLogoWidth, setSplashLogoWidth: applySplashLogoWidth,
    splashLogoHeight: liveSplashLogoHeight, setSplashLogoHeight: applySplashLogoHeight,
    splashLogoRadius: liveSplashLogoRadius, setSplashLogoRadius: applySplashLogoRadius,
    splashLogoOffsetX: liveSplashLogoOffsetX, setSplashLogoOffsetX: applySplashLogoOffsetX,
    splashLogoOffsetY: liveSplashLogoOffsetY, setSplashLogoOffsetY: applySplashLogoOffsetY,
    splashLogoBgSize: liveSplashLogoBgSize, setSplashLogoBgSize: applySplashLogoBgSize,
    splashAppName: liveSplashAppName, setSplashAppName: applySplashAppName,
    splashStyle: liveSplashStyle, setSplashStyle: applySplashStyle,
  } = useSettings();

  /* ── Draft (buffered) copies of every setting below ──────────────────
     Changing a control updates ONLY these; handleSaveAll pushes them to
     the real setters (applyX) above when "Save Settings" is pressed. */
  const [theme, setTheme] = useState(liveTheme);
  const [fontSize, setFontSize] = useState(liveFontSize);
  const [language, setLanguage] = useState(liveLanguage);
  const [ttsEnabled, setTtsEnabled] = useState(liveTtsEnabled);
  const [navTtsEnabled, setNavTtsEnabled] = useState(liveNavTtsEnabled);
  const [wakeWord, setWakeWord] = useState(liveWakeWord);
  const [assistantName, setAssistantName] = useState(liveAssistantName);
  const [assistantPersonality, setAssistantPersonality] = useState(liveAssistantPersonality);
  const [aiButtonIcon, setAiButtonIcon] = useState(liveAiButtonIcon);
  const [aiButtonShape, setAiButtonShape] = useState(liveAiButtonShape);
  const [aiButtonColor, setAiButtonColor] = useState(liveAiButtonColor);
  const [aiButtonCustomColor, setAiButtonCustomColor] = useState(liveAiButtonCustomColor);
  const [aiEnabled, setAiEnabled] = useState(liveAiEnabled);
  const [aiAvatarStyle, setAiAvatarStyle] = useState<AvatarStyle>(liveAiAvatarStyle);
  const [aiButtonSize, setAiButtonSize] = useState<AiButtonSize>(liveAiButtonSize);
  const [clockFormat, setClockFormat] = useState(liveClockFormat);
  const [clockLocale, setClockLocale] = useState(liveClockLocale);
  const [clockStyle, setClockStyle] = useState(liveClockStyle);
  const [clockSize, setClockSize] = useState(liveClockSize);
  const [floatingClockEnabled, setFloatingClockEnabled] = useState(liveFloatingClockEnabled);
  const [floatingClockCheckIn, setFloatingClockCheckIn] = useState(liveFloatingClockCheckIn);
  const [sidebarStyle, setSidebarStyle] = useState(liveSidebarStyle);
  const [cardStyle, setCardStyle] = useState(liveCardStyle);
  const [cardColorMode, setCardColorMode] = useState(liveCardColorMode);
  const [cardColor, setCardColor] = useState(liveCardColor);
  const [fontColorMode, setFontColorMode] = useState(liveFontColorMode);
  const [fontColor, setFontColor] = useState(liveFontColor);
  const [tableStyle, setTableStyle] = useState(liveTableStyle);
  const [accentColor, setAccentColor] = useState(liveAccentColor);
  const [fontFamily, setFontFamily] = useState(liveFontFamily);
  const [fontWeight, setFontWeight] = useState(liveFontWeight);
  const [glassIntensity, setGlassIntensity] = useState(liveGlassIntensity);
  const [backgroundMode, setBackgroundMode] = useState(liveBackgroundMode);
  const [backgroundImage, setBackgroundImage] = useState(liveBackgroundImage);
  const [backgroundGradient, setBackgroundGradient] = useState(liveBackgroundGradient);
  const [welcomeBannerEnabled, setWelcomeBannerEnabled] = useState(liveWelcomeBannerEnabled);
  const [welcomeMessage, setWelcomeMessage] = useState(liveWelcomeMessage);
  const [welcomeShape, setWelcomeShape] = useState(liveWelcomeShape);
  const [welcomeImage, setWelcomeImage] = useState(liveWelcomeImage);
  const [welcomeTitle, setWelcomeTitle] = useState(liveWelcomeTitle);
  const [welcomeImgUploading, setWelcomeImgUploading] = useState(false);
  const welcomeImgRef = useRef<HTMLInputElement>(null);
  const [welcomeStyle, setWelcomeStyle] = useState<WelcomeStyle>(liveWelcomeStyle);
  const [aiVoiceResponse, setAiVoiceResponse] = useState(liveAiVoiceResponse);
  const [soundEnabled, setSoundEnabled] = useState(liveSoundEnabled);
  const [soundVolume, setSoundVolume] = useState(liveSoundVolume);
  const [latenessAlertEnabled, setLatenessAlertEnabled] = useState(liveLatenessAlertEnabled);
  const [latenessAlertDays, setLatenessAlertDays] = useState(liveLatenessAlertDays);
  const [currency, setCurrency] = useState(liveCurrency);
  /* ── Splash screen drafts ── */
  const [splashBgGradient, setSplashBgGradient] = useState<SplashBgGradient>(liveSplashBgGradient);
  const [splashTagline, setSplashTagline] = useState(liveSplashTagline);
  const [splashDuration, setSplashDuration] = useState(liveSplashDuration);
  const [splashShowStars, setSplashShowStars] = useState(liveSplashShowStars);
  const [splashShowParticles, setSplashShowParticles] = useState(liveSplashShowParticles);
  const [splashLogoUrl, setSplashLogoUrl] = useState(liveSplashLogoUrl);
  const [splashLogoWidth, setSplashLogoWidth] = useState(liveSplashLogoWidth);
  const [splashLogoHeight, setSplashLogoHeight] = useState(liveSplashLogoHeight);
  const [splashLogoRadius, setSplashLogoRadius] = useState(liveSplashLogoRadius);
  const [splashLogoOffsetX, setSplashLogoOffsetX] = useState(liveSplashLogoOffsetX);
  const [splashLogoOffsetY, setSplashLogoOffsetY] = useState(liveSplashLogoOffsetY);
  const [splashLogoBgSize, setSplashLogoBgSize] = useState(liveSplashLogoBgSize);
  const [splashAppName, setSplashAppName] = useState(liveSplashAppName);
  const [splashStyle, setSplashStyle] = useState<SplashStyle>(liveSplashStyle);
  const [splashLogoUploading, setSplashLogoUploading] = useState(false);
  const splashLogoRef = useRef<HTMLInputElement>(null);

  /* Keep drafts in sync if the underlying value changes externally (e.g. another tab saves) */
  useEffect(() => { setTheme(liveTheme); }, [liveTheme]);
  useEffect(() => { setFontSize(liveFontSize); }, [liveFontSize]);
  useEffect(() => { setLanguage(liveLanguage); }, [liveLanguage]);
  useEffect(() => { setTtsEnabled(liveTtsEnabled); }, [liveTtsEnabled]);
  useEffect(() => { setNavTtsEnabled(liveNavTtsEnabled); }, [liveNavTtsEnabled]);
  useEffect(() => { setWakeWord(liveWakeWord); }, [liveWakeWord]);
  useEffect(() => { setAssistantName(liveAssistantName); }, [liveAssistantName]);
  useEffect(() => { setAssistantPersonality(liveAssistantPersonality); }, [liveAssistantPersonality]);
  useEffect(() => { setAiButtonIcon(liveAiButtonIcon); }, [liveAiButtonIcon]);
  useEffect(() => { setAiButtonShape(liveAiButtonShape); }, [liveAiButtonShape]);
  useEffect(() => { setAiButtonColor(liveAiButtonColor); }, [liveAiButtonColor]);
  useEffect(() => { setAiButtonCustomColor(liveAiButtonCustomColor); }, [liveAiButtonCustomColor]);
  useEffect(() => { setAiEnabled(liveAiEnabled); }, [liveAiEnabled]);
  useEffect(() => { setAiAvatarStyle(liveAiAvatarStyle); }, [liveAiAvatarStyle]);
  useEffect(() => { setAiButtonSize(liveAiButtonSize); }, [liveAiButtonSize]);
  useEffect(() => { setClockFormat(liveClockFormat); }, [liveClockFormat]);
  useEffect(() => { setClockLocale(liveClockLocale); }, [liveClockLocale]);
  useEffect(() => { setClockStyle(liveClockStyle); }, [liveClockStyle]);
  useEffect(() => { setClockSize(liveClockSize); }, [liveClockSize]);
  useEffect(() => { setFloatingClockEnabled(liveFloatingClockEnabled); }, [liveFloatingClockEnabled]);
  useEffect(() => { setFloatingClockCheckIn(liveFloatingClockCheckIn); }, [liveFloatingClockCheckIn]);
  useEffect(() => { setSidebarStyle(liveSidebarStyle); }, [liveSidebarStyle]);
  useEffect(() => { setCardStyle(liveCardStyle); }, [liveCardStyle]);
  useEffect(() => { setCardColorMode(liveCardColorMode); }, [liveCardColorMode]);
  useEffect(() => { setCardColor(liveCardColor); }, [liveCardColor]);
  useEffect(() => { setFontColorMode(liveFontColorMode); }, [liveFontColorMode]);
  useEffect(() => { setFontColor(liveFontColor); }, [liveFontColor]);
  useEffect(() => { setTableStyle(liveTableStyle); }, [liveTableStyle]);
  useEffect(() => { setAccentColor(liveAccentColor); }, [liveAccentColor]);
  useEffect(() => { setFontFamily(liveFontFamily); }, [liveFontFamily]);
  useEffect(() => { setGlassIntensity(liveGlassIntensity); }, [liveGlassIntensity]);
  useEffect(() => { setBackgroundMode(liveBackgroundMode); }, [liveBackgroundMode]);
  useEffect(() => { setBackgroundImage(liveBackgroundImage); }, [liveBackgroundImage]);
  useEffect(() => { setBackgroundGradient(liveBackgroundGradient); }, [liveBackgroundGradient]);
  useEffect(() => { setWelcomeBannerEnabled(liveWelcomeBannerEnabled); }, [liveWelcomeBannerEnabled]);
  useEffect(() => { setWelcomeMessage(liveWelcomeMessage); }, [liveWelcomeMessage]);
  useEffect(() => { setWelcomeShape(liveWelcomeShape); }, [liveWelcomeShape]);
  useEffect(() => { setWelcomeImage(liveWelcomeImage); }, [liveWelcomeImage]);
  useEffect(() => { setWelcomeTitle(liveWelcomeTitle); }, [liveWelcomeTitle]);
  useEffect(() => { setWelcomeStyle(liveWelcomeStyle); }, [liveWelcomeStyle]);
  useEffect(() => { setAiVoiceResponse(liveAiVoiceResponse); }, [liveAiVoiceResponse]);
  useEffect(() => { setSoundEnabled(liveSoundEnabled); }, [liveSoundEnabled]);
  useEffect(() => { setSoundVolume(liveSoundVolume); }, [liveSoundVolume]);
  useEffect(() => { setLatenessAlertEnabled(liveLatenessAlertEnabled); }, [liveLatenessAlertEnabled]);
  useEffect(() => { setLatenessAlertDays(liveLatenessAlertDays); }, [liveLatenessAlertDays]);
  useEffect(() => { setCurrency(liveCurrency); }, [liveCurrency]);
  useEffect(() => { setSplashBgGradient(liveSplashBgGradient); }, [liveSplashBgGradient]);
  useEffect(() => { setSplashTagline(liveSplashTagline); }, [liveSplashTagline]);
  useEffect(() => { setSplashDuration(liveSplashDuration); }, [liveSplashDuration]);
  useEffect(() => { setSplashShowStars(liveSplashShowStars); }, [liveSplashShowStars]);
  useEffect(() => { setSplashShowParticles(liveSplashShowParticles); }, [liveSplashShowParticles]);
  useEffect(() => { setSplashLogoUrl(liveSplashLogoUrl); }, [liveSplashLogoUrl]);
  useEffect(() => { setSplashLogoWidth(liveSplashLogoWidth); }, [liveSplashLogoWidth]);
  useEffect(() => { setSplashLogoHeight(liveSplashLogoHeight); }, [liveSplashLogoHeight]);
  useEffect(() => { setSplashLogoRadius(liveSplashLogoRadius); }, [liveSplashLogoRadius]);
  useEffect(() => { setSplashLogoOffsetX(liveSplashLogoOffsetX); }, [liveSplashLogoOffsetX]);
  useEffect(() => { setSplashLogoOffsetY(liveSplashLogoOffsetY); }, [liveSplashLogoOffsetY]);
  useEffect(() => { setSplashLogoBgSize(liveSplashLogoBgSize); }, [liveSplashLogoBgSize]);
  useEffect(() => { setSplashAppName(liveSplashAppName); }, [liveSplashAppName]);
  useEffect(() => { setSplashStyle(liveSplashStyle); }, [liveSplashStyle]);

  /* Reset the appearance draft fields back to defaults (does not apply until Save) */
  const resetAppearance = () => {
    setGlassIntensity("off");
    setBackgroundMode("default");
    setBackgroundImage("");
    setBackgroundGradient("aurora");
    setCardStyle("rounded");
    setCardColorMode("auto");
    setCardColor("#1e293b");
    setFontColorMode("auto");
    setFontColor("#1e293b");
  };

  const AI_PREVIEW_COLORS: Record<string, string> = {
    primary: "hsl(var(--primary))", violet: "#7c3aed", rose: "#e11d48",
    amber: "#d97706", emerald: "#059669", sky: "#0284c7",
    slate: "#475569", black: "#18181b", white: "#f8fafc", custom: aiButtonCustomColor,
  };
  const { data: me, refetch: refetchMe } = useGetMe();
  const {
    appName, appLogo, logoWidth, logoHeight, logoRotation, logoOffsetX, logoOffsetY,
    logoBgEnabled, logoBgColor, logoBgOpacity, logoBgRadius,
    setAppName, setAppLogo, setLogoWidth, setLogoHeight, setLogoRotation, setLogoOffsetX, setLogoOffsetY,
    setLogoBgEnabled, setLogoBgColor, setLogoBgOpacity, setLogoBgRadius, resetLogoBg,
  } = useAppConfig();
  const updateSettingsMut = useUpdateSettings();
  const changePasswordMut = useChangePassword();

  /* ── Section open/closed state ── */
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["appearance", "admin"]));
  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const isOpen = (id: string) => openSections.has(id);

  /* ── Password form ── */
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });

  /* ── Notification state ── */
  const [remindersEnabled, setRemindersEnabledState] = useState(() => getDailyRemindersEnabled());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(() => getNotificationPermission());

  const handleToggleReminders = async (val: boolean) => {
    if (val) {
      const perm = await requestNotificationPermission();
      setNotifPermission(perm);
      if (perm !== "granted") {
        toast({ title: isArabic ? t("notif_permission_not_granted") : "Notification permission denied", variant: "destructive" });
        return;
      }
      setDailyRemindersEnabled(true); setRemindersEnabledState(true);
      scheduleDailyReminders((localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "en", alarmSettings.startTime, alarmSettings.endTime);
      toast({ title: isArabic ? t("reminders_enabled") : "✅ Reminders enabled" });
    } else {
      setDailyRemindersEnabled(false); setRemindersEnabledState(false);
      cancelDailyReminders();
      toast({ title: isArabic ? t("reminders_disabled") : "🔕 Reminders disabled" });
    }
  };

  /* ── Biometric / GPS / Photo ── */
  const [biometricEnabled, setBiometricEnabled] = useState(() => localStorage.getItem("setting_biometric") !== "false");
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [gpsRadius, setGpsRadius] = useState("200");

  // تحميل إعدادات الجي بي إس من السيرفر (المصدر الموثوق الوحيد)
  useEffect(() => {
    fetch("/api/settings/app", { cache: "no-cache" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.gpsEnabled !== undefined) setGpsEnabled(Boolean(data.gpsEnabled));
        if (data.gpsRadius !== undefined) setGpsRadius(String(data.gpsRadius));
      })
      .catch(() => {});
  }, []);
  const [photoDocEnabled, setPhotoDocEnabled] = useState(() => localStorage.getItem("photo_doc_enabled") === "true");

  /* ── Admin & App Settings ── */
  const [adminForm, setAdminForm] = useState({ appName: "", username: "", email: "" });
  const [emailError, setEmailError] = useState("");
  const [logoPreview, setLogoPreview] = useState(appLogo);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoW, setLogoW] = useState(logoWidth);
  const [logoH, setLogoH] = useState(logoHeight);
  const [logoRot, setLogoRot] = useState(logoRotation);
  const [logoOX, setLogoOX] = useState(logoOffsetX);
  const [logoOY, setLogoOY] = useState(logoOffsetY);
  const [logoAspectLocked, setLogoAspectLocked] = useState(false);
  const [logoScalePct, setLogoScalePct] = useState(100);
  const [logoFileInfo, setLogoFileInfo] = useState<{ name: string; size: number; isSvg: boolean } | null>(null);
  const logoDragRef = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const [logoDragging, setLogoDragging] = useState(false);
  const [logoControlsOpen, setLogoControlsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!logoDragRef.current.active) return;
      const dx = clientX - logoDragRef.current.startX;
      const dy = clientY - logoDragRef.current.startY;
      setLogoOX(Math.max(-300, Math.min(300, Math.round(logoDragRef.current.ox + dx))));
      setLogoOY(Math.max(-300, Math.min(300, Math.round(logoDragRef.current.oy + dy))));
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onEnd = () => { logoDragRef.current.active = false; setLogoDragging(false); };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  /* ── Work Schedule ── */
  const [workStartTime, setWorkStartTime] = useState("09:00");
  const [lateGraceMinutes, setLateGraceMinutes] = useState(15);
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [appTimezone, setAppTimezone] = useState("Europe/Stockholm");

  /* ── Login customization ── */
  const [loginBgStyle, setLoginBgStyleState] = useState(() => localStorage.getItem("login_bg_style") || "default");
  const [loginSubtitle, setLoginSubtitleState] = useState(() => localStorage.getItem("login_custom_subtitle") || "");
  const [dailySummarySending, setDailySummarySending] = useState(false);

  /* ── Brevo ── */
  const [brevoKey, setBrevoKey] = useState("");
  const [brevoFrom, setBrevoFrom] = useState("");
  const [brevoConfigured, setBrevoConfigured] = useState(false);
  const [brevoSaving, setBrevoSaving] = useState(false);
  const [brevoTesting, setBrevoTesting] = useState(false);
  const [brevoTestResult, setBrevoTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [brevoShowKey, setBrevoShowKey] = useState(false);

  /* ── Resend ── */
  const [resendKey, setResendKey] = useState("");
  const [resendFrom, setResendFrom] = useState("onboarding@resend.dev");
  const [resendConfigured, setResendConfigured] = useState(false);
  const [resendSaving, setResendSaving] = useState(false);
  const [resendTesting, setResendTesting] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [resendShowKey, setResendShowKey] = useState(false);

  /* ── Alarm ── */
  const [alarmSettings, setAlarmSettingsState] = useState<ShiftAlarmSettings>(() => getAlarmSettings());
  const [pushStatus, setPushStatus] = useState<"idle" | "subscribing" | "subscribed" | "error">("idle");
  const [pushErrorMsg, setPushErrorMsg] = useState("");

  // Auto-sync alarm start/end from work schedule whenever workStartTime or breakMinutes changes
  useEffect(() => {
    if (!workStartTime) return;
    const [hh, mm] = workStartTime.split(":").map(Number);
    const endMin = hh * 60 + mm + 8 * 60 + breakMinutes;
    const calcEnd = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    setAlarmSettingsState(s => ({ ...s, startTime: workStartTime, endTime: calcEnd }));
  }, [workStartTime, breakMinutes]);

  // On mount: sync subscription with server and update UI state
  useEffect(() => {
    (async () => {
      // Try silent re-sync first (no permission prompt)
      const ok = await syncPushSubscription({ enabled: alarmSettings.enabled, startTime: alarmSettings.startTime, endTime: alarmSettings.endTime });
      if (ok) { setPushStatus("subscribed"); return; }

      // Fall back: check server-side status to show correct UI
      const statusRes = await authFetch("/api/push/status").catch(() => null);
      if (statusRes?.ok) {
        const data = await statusRes.json().catch(() => ({}));
        if (data.subscribed) setPushStatus("subscribed");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Notification sound ── */
  const [notifSoundType, setNotifSoundTypeState] = useState<NotifSoundType>(() => getNotifSoundType());

  /* Detect iOS Safari running in regular browser (not installed as PWA) */
  const isIosBrowser = (() => {
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone = (window.navigator as any).standalone === true;
    return isIos && !isStandalone;
  })();

  /* Subscribe this device to server-sent push notifications for the alarm */
  const subscribeToPush = useCallback(async (settings: ShiftAlarmSettings) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("error");
      // Show iOS-specific instructions if on iOS Safari browser
      if (isIosBrowser) {
        setPushErrorMsg("IOS_PWA_REQUIRED");
      } else {
        setPushErrorMsg(isArabic ? t("browser_no_bg_notif") : "This browser does not support background push notifications");
      }
      return;
    }
    setPushStatus("subscribing");
    setPushErrorMsg("");
    try {
      // Notification permission must be explicitly requested BEFORE calling
      // pushManager.subscribe(), otherwise browsers reject the subscription
      // with a generic error instead of prompting the user.
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") {
        setPushStatus("error");
        setPushErrorMsg(isArabic
          ? t("notif_permission_denied_retry")
          : "Notification permission was denied. Enable it in the browser's site settings and try again.");
        return;
      }

      const vapidRes = await authFetch("/api/push/vapid-key");
      const vapidData = await vapidRes.json().catch(() => ({}));
      const publicKey = vapidData?.publicKey;
      if (!publicKey) {
        setPushStatus("error");
        setPushErrorMsg(isArabic
          ? t("server_not_configured_notif")
          : "The server is not configured for push notifications (missing VAPID key). Contact your administrator.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      await authFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: sub.toJSON(),
          enabled:        settings.enabled,
          startTime:      settings.startTime,
          endTime:        settings.endTime,
          // Send the browser's UTC offset so the server fires at the user's local time
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      });
      setPushStatus("subscribed");
    } catch (err: any) {
      setPushStatus("error");
      setPushErrorMsg(
        err?.name === "NotAllowedError"
          ? (isArabic ? t("notif_permission_denied_browser") : "Notification permission was denied by the browser.")
          : (isArabic ? t("subscription_failed_check_perm") : "Subscription failed. Please allow notifications.")
      );
    }
  }, [isArabic]);

  const unsubscribeFromPush = useCallback(async () => {
    await authFetch("/api/push/unsubscribe", { method: "DELETE" }).catch(() => {});
    setPushStatus("idle");
  }, []);

  /* ── API Key ── */
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [keyError, setKeyError] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [currentKeyInfo, setCurrentKeyInfo] = useState<{ hasKey: boolean; source: string; maskedKey: string | null } | null>(null);

  /* ── Integration keys — Cloudinary ── */
  const [clCloudName, setClCloudName]   = useState("");
  const [clApiKey,    setClApiKey]      = useState("");
  const [clApiSecret, setClApiSecret]   = useState("");
  const [clConfigured, setClConfigured] = useState(false);
  const [clMasked, setClMasked]         = useState<{cloudName:string|null,apiKey:string|null,apiSecret:string|null}>({cloudName:null,apiKey:null,apiSecret:null});
  const [clSaving,    setClSaving]      = useState(false);
  const [showClSecret, setShowClSecret] = useState(false);

  /* ── Integration keys — VAPID ── */
  const [vapidPub,        setVapidPub]        = useState("");
  const [vapidPriv,       setVapidPriv]       = useState("");
  const [vapidEmail,      setVapidEmail]      = useState("");
  const [vapidConfigured, setVapidConfigured] = useState(false);
  const [vapidMasked, setVapidMasked]         = useState<{publicKey:string|null,privateKey:string|null,email:string|null}>({publicKey:null,privateKey:null,email:null});
  const [vapidSaving,     setVapidSaving]     = useState(false);
  const [showVapidPriv,   setShowVapidPriv]   = useState(false);

  /* ── Manager API Keys access ── */
  const [managerApiAccess,    setManagerApiAccess]    = useState(false);
  const [managerApiAccessSaving, setManagerApiAccessSaving] = useState(false);

  /* ── Global saving ── */
  const [globalSaving, setGlobalSaving] = useState(false);

  const isAdmin = me?.role === "admin" || me?.role === "manager";
  // مدير النظام فقط — بعض الأقسام الحساسة مخفية عن مدير الشركة
  const isAdminOnly = me?.role === "admin";

  useEffect(() => {
    setAdminForm({ appName, username: me?.name ?? "", email: me?.email ?? "" });
  }, [appName, me?.name, me?.email]);

  useEffect(() => {
    if (!isAdmin) return;
    authFetch("/api/settings/app").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.workStartTime) setWorkStartTime(data.workStartTime);
      if (data?.lateGraceMinutes != null) setLateGraceMinutes(data.lateGraceMinutes);
      if (data?.breakMinutes != null) setBreakMinutes(data.breakMinutes);
      if (data?.appTimezone) setAppTimezone(data.appTimezone);
    }).catch(() => {});
  }, [isAdmin]);

  // Load integration keys status (Cloudinary + VAPID) — admin only
  useEffect(() => {
    if (!isAdminOnly) return;
    authFetch("/api/settings/integrations").then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      setClConfigured(data.cloudinary?.configured ?? false);
      setClMasked({ cloudName: data.cloudinary?.cloudName ?? null, apiKey: data.cloudinary?.apiKey ?? null, apiSecret: data.cloudinary?.apiSecret ?? null });
      setVapidConfigured(data.vapid?.configured ?? false);
      setVapidMasked({ publicKey: data.vapid?.publicKey ?? null, privateKey: data.vapid?.privateKey ?? null, email: data.vapid?.email ?? null });
      if (data.vapid?.email) setVapidEmail(data.vapid.email);
    }).catch(() => {});
  }, [isAdminOnly]);

  // Load manager-api-access for both admin and manager roles
  useEffect(() => {
    if (!isAdmin) return;
    authFetch("/api/settings/integrations/manager-api-access").then(r => r.ok ? r.json() : null).then(data => {
      if (data) setManagerApiAccess(data.allowed ?? false);
    }).catch(() => {});
  }, [isAdmin]);

  // Load email provider configs (admin only)
  useEffect(() => {
    if (!isAdminOnly) return;
    authFetch("/api/ai/brevo").then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        setBrevoConfigured(data.configured ?? false);
        if (data.from) setBrevoFrom(data.from);
      }
    }).catch(() => {});
    authFetch("/api/ai/resend").then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        setResendConfigured(data.configured ?? false);
        if (data.from) setResendFrom(data.from);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOnly]);

  async function handleBrevoSave() {
    if (!brevoKey.trim()) return;
    setBrevoSaving(true);
    setBrevoTestResult(null);
    try {
      const res = await authFetch("/api/ai/brevo", {
        method: "POST",
        body: JSON.stringify({ apiKey: brevoKey.trim(), from: brevoFrom.trim() || undefined }),
      });
      if (res.ok) {
        setBrevoConfigured(true);
        setBrevoKey("");
        toast({ title: isArabic ? "✅ تم حفظ مفتاح Brevo" : "✅ Brevo key saved" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: isArabic ? "فشل الحفظ" : "Save failed", description: err.error, variant: "destructive" });
      }
    } finally { setBrevoSaving(false); }
  }

  async function handleBrevoTest() {
    setBrevoTesting(true);
    setBrevoTestResult(null);
    try {
      const to = me?.email ?? "";
      if (!to) { setBrevoTestResult({ ok: false, error: isArabic ? "لم يُعثر على إيميل للاختبار — أضف إيميلك في ملفك الشخصي" : "No test email found — add your email in your profile" }); return; }
      const res = await authFetch("/api/ai/brevo/test", { method: "POST", body: JSON.stringify({ to }) });
      const data = await res.json().catch(() => ({ ok: false, error: "Unknown error" }));
      setBrevoTestResult(data);
    } finally { setBrevoTesting(false); }
  }

  async function handleBrevoClear() {
    await authFetch("/api/ai/brevo", { method: "DELETE" });
    setBrevoConfigured(false);
    setBrevoKey("");
    setBrevoFrom("");
    setBrevoTestResult(null);
    toast({ title: isArabic ? "تم حذف إعدادات Brevo" : "Brevo settings cleared" });
  }

  async function handleResendSave() {
    if (!resendKey.trim()) return;
    setResendSaving(true);
    setResendTestResult(null);
    try {
      const res = await authFetch("/api/ai/resend", {
        method: "POST",
        body: JSON.stringify({ apiKey: resendKey.trim(), from: resendFrom || "onboarding@resend.dev" }),
      });
      if (res.ok) {
        setResendConfigured(true);
        setResendKey("");
        toast({ title: isArabic ? "✅ تم حفظ مفتاح Resend" : "✅ Resend key saved" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: isArabic ? "فشل الحفظ" : "Save failed", description: err.error, variant: "destructive" });
      }
    } finally { setResendSaving(false); }
  }

  async function handleResendTest() {
    setResendTesting(true);
    setResendTestResult(null);
    try {
      const to = me?.email ?? "";
      if (!to) { setResendTestResult({ ok: false, error: isArabic ? "لم يُعثر على إيميل للاختبار — أضف إيميلك في ملفك الشخصي" : "No test email found — add your email in your profile" }); return; }
      const res = await authFetch("/api/ai/resend/test", { method: "POST", body: JSON.stringify({ to }) });
      const data = await res.json().catch(() => ({ ok: false, error: "Unknown error" }));
      setResendTestResult(data);
    } finally { setResendTesting(false); }
  }

  async function handleResendClear() {
    await authFetch("/api/ai/resend", { method: "DELETE" });
    setResendConfigured(false);
    setResendKey("");
    setResendFrom("onboarding@resend.dev");
    setResendTestResult(null);
    toast({ title: isArabic ? "تم حذف إعدادات Resend" : "Resend settings cleared" });
  }


  useEffect(() => {
    const stored = localStorage.getItem("gemini_api_key");
    if (stored) {
      setCurrentKeyInfo({ hasKey: true, source: "local", maskedKey: stored.slice(0, 8) + "••••••••" + stored.slice(-4) });
    } else {
      authFetch("/api/settings/my-ai-key").then(r => r.ok ? r.json() : null).then(data => {
        if (data?.key) {
          localStorage.setItem("gemini_api_key", data.key);
          setCurrentKeyInfo({ hasKey: true, source: "local", maskedKey: data.maskedKey });
        } else {
          setCurrentKeyInfo({ hasKey: false, source: "none", maskedKey: null });
        }
      }).catch(() => setCurrentKeyInfo({ hasKey: false, source: "none", maskedKey: null }));
    }
  }, []);

  /* ── Handlers ── */
  const handleSettings = (field: "theme" | "fontSize" | "language", value: string) => {
    /* Buffer the draft copy (used by the JSX + committed to the server on Save),
       but also apply the theme to the live DOM immediately so the user sees the
       color change right away instead of having to press Save or refresh.
       Persistence to server/localStorage still only happens on "Save Settings". */
    if (field === "theme") { setTheme(value as any); applyTheme(value as any); }
    if (field === "fontSize") setFontSize(value as any);
    if (field === "language") setLanguage(value as any);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast({ title: t("passwords_no_match"), variant: "destructive" }); return;
    }
    try {
      await changePasswordMut.mutateAsync({ data: { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword } });
      toast({ title: t("password_changed") });
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e: any) {
      toast({ title: t("failed"), description: e?.data?.error, variant: "destructive" });
    }
  };

  const handleVerifyKey = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setKeyStatus("verifying"); setKeyError("");
    try {
      const res = await authFetch("/api/ai/verify-key", { method: "POST", body: JSON.stringify({ key }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.valid) {
        setKeyStatus("valid");
        localStorage.setItem("gemini_api_key", key);
        toast({ title: isArabic ? t("key_verified_saved2") : "✅ Key verified and saved" });
      } else {
        const REASON_MAP: Record<string, string> = {
          unauthorized: isArabic ? t("key_unauthorized_expired") : "Key is unauthorized or expired",
          invalid_key:  isArabic ? t("key_incorrect") : "Invalid API key",
          bad_request:  isArabic ? t("invalid_request") : "Bad request",
        };
        const reason = data?.reason ?? "";
        const friendly = REASON_MAP[reason] || reason || (isArabic ? t("invalid_label") : "Invalid key");
        setKeyStatus("invalid"); setKeyError(friendly);
      }
    } catch {
      setKeyStatus("invalid"); setKeyError(isArabic ? t("connection_failed") : "Could not reach server");
    }
  };

  const handleSaveKey = async () => {
    const key = apiKey.trim(); if (!key) return;
    setIsSavingKey(true);
    setKeyStatus("verifying"); setKeyError("");
    try {
      const res = await authFetch("/api/ai/verify-key", { method: "POST", body: JSON.stringify({ key }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.valid) {
        localStorage.setItem("gemini_api_key", key);
        authFetch("/api/settings/my-ai-key", { method: "POST", body: JSON.stringify({ key }) }).catch(() => {});
        setCurrentKeyInfo({ hasKey: true, source: "local", maskedKey: key.slice(0, 8) + "••••••••" + key.slice(-4) });
        setApiKey(""); setKeyStatus("valid");
        toast({ title: isArabic ? t("key_verified_saved_success") : "✅ Key verified and saved successfully" });
      } else {
        const REASON_MAP: Record<string, string> = {
          unauthorized:       isArabic ? t("key_unauthorized_expired") : "Key unauthorized or expired",
          invalid_key:        isArabic ? t("key_incorrect") : "Invalid API key",
          bad_request:        isArabic ? t("invalid_request") : "Bad request",
          INVALID_ARGUMENT:   isArabic ? t("key_invalid_format") : "Invalid key or format",
          API_KEY_INVALID:    isArabic ? t("api_key_invalid") : "API key is invalid",
          PERMISSION_DENIED:  isArabic ? t("access_denied_check_key") : "Permission denied – check key permissions",
          RESOURCE_EXHAUSTED: isArabic ? t("quota_exhausted") : "Quota exhausted – key is valid but quota exceeded",
        };
        const rawReason = data?.reason ?? "";
        const reason = rawReason.length > 80 ? rawReason.slice(0, 80) + "..." : rawReason;
        const friendly = REASON_MAP[reason] || REASON_MAP[rawReason] || reason || (isArabic ? t("key_verification_failed") : "Key verification failed");
        setKeyStatus("invalid"); setKeyError(friendly);
        toast({ title: isArabic ? `❌ ${friendly}` : `❌ ${friendly}`, variant: "destructive" });
      }
    } catch {
      setKeyStatus("invalid"); setKeyError(isArabic ? t("server_connection_failed") : "Could not reach server");
      toast({ title: isArabic ? t("server_conn_failed2") : "❌ Could not reach server", variant: "destructive" });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = () => {
    if (!confirm(t("key_remove_confirm") ?? "Remove the saved API key?")) return;
    localStorage.removeItem("gemini_api_key");
    authFetch("/api/settings/my-ai-key", { method: "POST", body: JSON.stringify({ key: "" }) }).catch(() => {});
    setCurrentKeyInfo({ hasKey: false, source: "none", maskedKey: null });
    toast({ title: t("key_removed") });
  };

  const handleExport = () => {
    const data = { exported_at: new Date().toISOString(), settings: { language, theme, fontSize, biometricEnabled, gpsEnabled, gpsRadius } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pulse_backup_${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("export_data") + " ✓" });
  };

  /* Stage login bg style — only persists to localStorage on Save */
  const saveLoginBgStyle = (val: string) => {
    setLoginBgStyleState(val);
    /* NOTE: localStorage.setItem("login_bg_style", val) now happens inside handleSaveAll */
  };

  const sendDailySummary = async () => {
    setDailySummarySending(true);
    try {
      const res = await authFetch("/api/attendance/daily-summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("failed_label"));
      toast({ title: `✅ تم الإرسال لـ ${data.sent} موظف` });
    } catch (err: any) {
      toast({ title: t("send_failed"), description: err.message, variant: "destructive" });
    } finally { setDailySummarySending(false); }
  };

  /* ── Master Save All ── */
  const handleSaveAll = async () => {
    // Validate BEFORE committing any local/global state so a failed save
    // never partially applies changes (e.g. logo transform without the
    // rest of the form).
    if (isAdmin && !isValidEmail(adminForm.email)) {
      setEmailError(t("invalid_email"));
      return;
    }
    setEmailError("");

    setGlobalSaving(true);
    const tasks: Promise<any>[] = [];

    // Save alarm
    saveAlarmSettings(alarmSettings);
    saveNotifSoundType(notifSoundType);
    const lang = (localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "ar";
    if (alarmSettings.enabled) scheduleShiftAlarms(alarmSettings, lang); else cancelShiftAlarms();
    // Re-schedule daily reminders with the updated work times
    if (getDailyRemindersEnabled()) {
      scheduleDailyReminders(lang, alarmSettings.startTime, alarmSettings.endTime);
    }
    // Sync push subscription times whenever alarm settings are saved
    if (alarmSettings.enabled && pushStatus === "subscribed") {
      subscribeToPush(alarmSettings);
    }

    // Save logo transform (only applied globally on Save)
    setLogoWidth(logoW);
    setLogoHeight(logoH);
    setLogoRotation(logoRot);
    setLogoOffsetX(logoOX);
    setLogoOffsetY(logoOY);

    // Save biometric / photo settings (local-only — no server equivalent)
    localStorage.setItem("setting_biometric", String(biometricEnabled));
    localStorage.setItem("photo_doc_enabled", String(photoDocEnabled));

    // Save login subtitle & background
    localStorage.setItem("login_custom_subtitle", loginSubtitle);
    localStorage.setItem("login_bg_style", loginBgStyle);

    // Apply every buffered appearance/behavior setting to the live app now
    // (context + localStorage + any DOM/visual side-effects) — nothing
    // above this point in the draft state has taken effect until now.
    applyTheme(theme as any);
    applyFontSize(fontSize as any);
    applyLanguage(language as any);
    applyTtsEnabled(ttsEnabled);
    applyWakeWord(wakeWord);
    applyAssistantName(assistantName);
    applyAssistantPersonality(assistantPersonality);
    applyAiButtonIcon(aiButtonIcon);
    applyAiButtonShape(aiButtonShape);
    applyAiButtonColor(aiButtonColor);
    applyAiButtonCustomColor(aiButtonCustomColor);
    applyAiEnabled(aiEnabled);
    applyAiAvatarStyle(aiAvatarStyle);
    applyAiButtonSize(aiButtonSize);
    applyClockFormat(clockFormat);
    applyClockLocale(clockLocale);
    applyClockStyle(clockStyle);
    applyClockSize(clockSize);
    applyFloatingClockEnabled(floatingClockEnabled);
    applyFloatingClockCheckIn(floatingClockCheckIn);
    applySidebarStyle(sidebarStyle);
    applyCardStyle(cardStyle);
    applyCardColorMode(cardColorMode);
    applyCardColor(cardColor);
    applyFontColorMode(fontColorMode);
    applyFontColor(fontColor);
    applyTableStyle(tableStyle);
    applyAccentColor(accentColor);
    applyFontFamily(fontFamily);
    applyFontWeight(fontWeight);
    applyGlassIntensity(glassIntensity);
    applyBackgroundMode(backgroundMode);
    applyBackgroundImage(backgroundImage);
    applyBackgroundGradient(backgroundGradient);
    applyWelcomeBannerEnabled(welcomeBannerEnabled);
    applyWelcomeMessage(welcomeMessage);
    applyWelcomeShape(welcomeShape);
    applyWelcomeImage(welcomeImage);
    applyWelcomeTitle(welcomeTitle);
    applyWelcomeStyle(welcomeStyle);
    applyAiVoiceResponse(aiVoiceResponse);
    applySoundEnabled(soundEnabled);
    applySoundVolume(soundVolume);
    applyLatenessAlertEnabled(latenessAlertEnabled);
    applyLatenessAlertDays(latenessAlertDays);
    applyCurrency(currency);
    applySplashBgGradient(splashBgGradient);
    applySplashTagline(splashTagline);
    applySplashDuration(splashDuration);
    applySplashShowStars(splashShowStars);
    applySplashShowParticles(splashShowParticles);
    applySplashLogoUrl(splashLogoUrl);
    applySplashLogoWidth(splashLogoWidth);
    applySplashLogoHeight(splashLogoHeight);
    applySplashLogoRadius(splashLogoRadius);
    applySplashLogoOffsetX(splashLogoOffsetX);
    applySplashLogoOffsetY(splashLogoOffsetY);
    applySplashLogoBgSize(splashLogoBgSize);
    applySplashAppName(splashAppName);
    applySplashStyle(splashStyle);
    // مسح sessionStorage حتى تظهر الشاشة مجدداً بعد تغيير اللوغو أو الإعدادات
    try {
      ["attendx_s1_v2","attendx_s2_v2","attendx_s3_v1","attendx_s4_v1","attendx_s5_v1"]
        .forEach(k => sessionStorage.removeItem(k));
    } catch {}

    // Save theme / fontSize / language to server (draft → committed on Save)
    // NOTE: no silent catch — failures will bubble up and trigger the error toast
    tasks.push(
      updateSettingsMut.mutateAsync({
        data: { theme, fontSize, language } as any,
      }).then(() => {
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      })
    );

    if (isAdmin) {
      // Save work schedule
      tasks.push(
        authFetch("/api/settings/app", {
          method: "PATCH",
          body: JSON.stringify({
            workStartTime, lateGraceMinutes, breakMinutes, appTimezone,
            gpsEnabled, gpsRadius: parseInt(gpsRadius) || 200,
          }),
        }).catch(() => {})
      );

      // Save admin profile if changed
      const nameChanged = adminForm.username.trim() !== (me?.name ?? "");
      const emailChanged = adminForm.email.trim() !== (me?.email ?? "");

      if (adminForm.appName.trim() && adminForm.appName.trim() !== appName) {
        tasks.push(
          authFetch("/api/settings/app", { method: "PATCH", body: JSON.stringify({ appName: adminForm.appName.trim() }) })
            .then(r => r.json()).then(d => { if (d.appName) setAppName(d.appName); }).catch(() => {})
        );
      }
      if ((nameChanged || emailChanged) && me?.id) {
        const body: Record<string, string> = {};
        if (nameChanged) body.name = adminForm.username.trim();
        if (emailChanged) body.email = adminForm.email.trim();
        tasks.push(
          authFetch(`/api/users/${me.id}`, { method: "PATCH", body: JSON.stringify(body) })
            .then(r => { if (!r.ok) return r.json().then((d: any) => { throw new Error(d.error); }); return undefined; })
            .catch(() => {})
        );
      }
    }

    try {
      await Promise.all(tasks);
      await refetchMe();
      toast({ title: isArabic ? t("all_settings_saved") : "✅ All settings saved" });
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    } finally {
      setGlobalSaving(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <Layout>
      <div className="space-y-3 max-w-xl pb-28">

        {/* Page Title */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{t("settings")}</h1>
          <p className="text-sm text-muted-foreground">{isArabic ? t("click_section_expand") : "Tap a section to expand"}</p>
        </div>

        {/* ── 1. Admin & App Settings ── */}
        {isAdmin && (
          <Section
            id="admin" open={isOpen("admin")} onToggle={() => toggleSection("admin")}
            icon={<UserCog className="w-4 h-4" />}
            title={t("admin_app_settings")}
            accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          >
            {/* App Name */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><AppWindow className="w-3.5 h-3.5" /> {t("app_name")}</Label>
              <Input value={adminForm.appName} onChange={e => setAdminForm(f => ({ ...f, appName: e.target.value }))} placeholder={t("app_name_placeholder")} />
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label>{isArabic ? t("app_logo") : "App Logo"}</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain" /> : <AppWindow className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex gap-2 flex-wrap">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
                          const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
                          if (!isSvg && !allowedTypes.includes(file.type)) {
                            toast({ title: isArabic ? t("unsupported_format") : "Unsupported file format", variant: "destructive" });
                            return;
                          }
                          if (file.size > 20_000_000) { toast({ title: isArabic ? "الحد الأقصى 20 ميجابايت" : "Max 20MB", variant: "destructive" }); return; }
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const src = ev.target?.result as string;
                            setLogoPreview(src);
                            setLogoFileInfo({ name: file.name, size: file.size, isSvg });
                            // Auto-detect natural image dimensions and apply them to the logo container
                            if (!isSvg) {
                              const imgEl = new window.Image();
                              imgEl.onload = () => {
                                const nw = imgEl.naturalWidth;
                                const nh = imgEl.naturalHeight;
                                if (nw > 0 && nh > 0) {
                                  // Scale down to fit within 300px while preserving ratio
                                  const maxDim = 300;
                                  const scale = Math.min(1, maxDim / Math.max(nw, nh));
                                  setLogoW(Math.round(nw * scale));
                                  setLogoH(Math.round(nh * scale));
                                }
                              };
                              imgEl.src = src;
                            } else {
                              // SVG: default square based on current size
                              const sz = Math.min(logoW || 120, 200);
                              setLogoW(sz); setLogoH(sz);
                            }
                          };
                          reader.onerror = () => toast({ title: isArabic ? t("failed") : "Failed to read file", variant: "destructive" });
                          reader.readAsDataURL(file);
                        }} />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted cursor-pointer">
                        <Database className="w-3.5 h-3.5" /> {isArabic ? t("choose_image") : "Choose Image"}
                      </span>
                    </label>
                    {logoPreview && (
                      <button onClick={() => { setLogoPreview(""); setLogoFileInfo(null); }} className="px-3 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10">
                        {isArabic ? t("remove_action") : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG — {isArabic ? "بحد أقصى 20 ميجابايت" : "max 20MB"}</p>
                  {logoFileInfo && (
                    <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5">
                      <span className="font-mono">{logoFileInfo.name}</span>
                      <span>·</span>
                      <span>{(logoFileInfo.size / 1024).toFixed(1)} KB</span>
                      {logoFileInfo.isSvg && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">SVG</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              {logoPreview !== appLogo && (
                <button disabled={logoSaving} onClick={async () => {
                  setLogoSaving(true);
                  try {
                    const r = await authFetch("/api/settings/app", { method: "PATCH", body: JSON.stringify({ appLogo: logoPreview }) });
                    const d = await r.json();
                    setAppLogo(d.appLogo ?? ""); setLogoPreview(d.appLogo ?? "");
                    toast({ title: isArabic ? t("logo_saved") : "Logo saved" });
                  } catch { toast({ title: t("failed"), variant: "destructive" }); }
                  finally { setLogoSaving(false); }
                }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                  {logoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                  {isArabic ? t("save_logo") : "Save Logo"}
                </button>
              )}

              {/* Logo Size Controls — collapsible */}
              <button
                type="button"
                onClick={() => setLogoControlsOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors text-xs font-medium"
              >
                <span className="flex items-center gap-1.5">
                  <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {isArabic ? "ضبط الحجم والموضع والتدوير" : "Size, position & rotation"}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", logoControlsOpen && "rotate-180")} />
              </button>

              {logoControlsOpen && <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">{isArabic ? t("logo_size_login") : "Logo size on login page"}</Label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={logoAspectLocked}
                      onChange={e => setLogoAspectLocked(e.target.checked)}
                      className="accent-primary w-3.5 h-3.5 cursor-pointer"
                    />
                    {isArabic ? t("lock_aspect_ratio") : "Lock aspect ratio"}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? t("width_label") : "Width"}</Label>
                      <span className="text-xs font-mono text-primary">{logoW}px</span>
                    </div>
                    <input
                      type="range" min={16} max={2000} step={1}
                      value={logoW}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (logoAspectLocked && logoW > 0) {
                          const ratio = logoH / logoW;
                          setLogoW(v);
                          setLogoH(Math.round(v * ratio));
                        } else {
                          setLogoW(v);
                        }
                      }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? t("height_label") : "Height"}</Label>
                      <span className="text-xs font-mono text-primary">{logoH}px</span>
                    </div>
                    <input
                      type="range" min={16} max={2000} step={1}
                      value={logoH}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (logoAspectLocked && logoH > 0) {
                          const ratio = logoW / logoH;
                          setLogoH(v);
                          setLogoW(Math.round(v * ratio));
                        } else {
                          setLogoH(v);
                        }
                      }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Quick size presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: isArabic ? "صغير" : "Small", v: 48 },
                    { label: isArabic ? "متوسط" : "Medium", v: 96 },
                    { label: isArabic ? "كبير" : "Large", v: 200 },
                    { label: isArabic ? "كبير جداً" : "X-Large", v: 400 },
                    { label: isArabic ? "ضخم" : "Huge", v: 800 },
                  ].map(p => (
                    <button key={p.v} type="button"
                      onClick={() => {
                        const ratio = logoW > 0 ? logoH / logoW : 1;
                        setLogoW(p.v);
                        setLogoH(logoAspectLocked ? Math.round(p.v * ratio) : p.v);
                      }}
                      className="px-2.5 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted hover:border-primary/40"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs">{isArabic ? t("scale_label") : "Scale"}</Label>
                  <div className="flex items-center gap-2 flex-1 max-w-[240px]">
                    <input
                      type="range" min={10} max={800} step={1}
                      value={logoScalePct}
                      onChange={e => {
                        const pct = Number(e.target.value);
                        const factor = pct / logoScalePct;
                        setLogoW(v => Math.max(16, Math.min(2000, Math.round(v * factor))));
                        setLogoH(v => Math.max(16, Math.min(2000, Math.round(v * factor))));
                        setLogoScalePct(pct);
                      }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-primary w-12 text-end">{logoScalePct}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{isArabic ? t("width_px") : "W (px)"}</Label>
                      <Input
                        type="number" min={16} max={2000}
                        value={logoW}
                        onChange={e => {
                          const v = Math.max(16, Math.min(2000, Number(e.target.value)));
                          if (logoAspectLocked && logoW > 0) {
                            const ratio = logoH / logoW;
                            setLogoW(v);
                            setLogoH(Math.round(v * ratio));
                          } else {
                            setLogoW(v);
                          }
                        }}
                        className="w-20 h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{isArabic ? t("height_px") : "H (px)"}</Label>
                      <Input
                        type="number" min={16} max={2000}
                        value={logoH}
                        onChange={e => {
                          const v = Math.max(16, Math.min(2000, Number(e.target.value)));
                          if (logoAspectLocked && logoH > 0) {
                            const ratio = logoW / logoH;
                            setLogoH(v);
                            setLogoW(Math.round(v * ratio));
                          } else {
                            setLogoH(v);
                          }
                        }}
                        className="w-20 h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Big, comfortable live-drag preview canvas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{isArabic ? "المعاينة المباشرة — اسحب أو مرّر للتكبير" : "Live preview — drag to move, scroll to zoom"}</Label>
                    <span className="text-xs font-mono text-primary">{logoW}×{logoH}px</span>
                  </div>
                  <div
                    className={cn(
                      "w-full rounded-xl bg-[repeating-conic-gradient(#0000_0_25%,#8882_0_50%)_50%/16px_16px] bg-primary/5 overflow-hidden flex items-center justify-center border-2 relative select-none",
                      logoDragging ? "border-primary cursor-grabbing shadow-lg" : "border-border cursor-grab"
                    )}
                    style={{ height: 260 }}
                    title={t("drag_reposition_logo")}
                    onMouseDown={e => {
                      e.preventDefault();
                      logoDragRef.current = { active: true, startX: e.clientX, startY: e.clientY, ox: logoOX, oy: logoOY };
                      setLogoDragging(true);
                    }}
                    onTouchStart={e => {
                      const tt = e.touches[0];
                      logoDragRef.current = { active: true, startX: tt.clientX, startY: tt.clientY, ox: logoOX, oy: logoOY };
                      setLogoDragging(true);
                    }}
                    onWheel={e => {
                      e.preventDefault();
                      const delta = e.deltaY > 0 ? -0.05 : 0.05;
                      const factor = Math.max(0.05, 1 + delta);
                      setLogoW(v => Math.max(16, Math.min(2000, Math.round(v * factor))));
                      setLogoH(v => Math.max(16, Math.min(2000, Math.round(v * factor))));
                    }}
                  >
                    <div
                      className="flex items-center justify-center select-none"
                      style={{
                        width: Math.min(logoW, 900),
                        height: Math.min(logoH, 220),
                        maxWidth: "90%",
                        maxHeight: "85%",
                        transform: `translate(${logoOX}px, ${logoOY}px) rotate(${logoRot}deg)`,
                      }}
                    >
                      {logoPreview
                        ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain pointer-events-none" />
                        : <span className="text-xs text-muted-foreground">{logoW}×{logoH}</span>
                      }
                    </div>
                    {!logoDragging && (
                      <span className="absolute bottom-1 inset-x-0 text-center text-[10px] text-muted-foreground/70 pointer-events-none">
                        {t("drag_hint")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Free rotation + position controls */}
                <Label className="text-xs font-medium text-muted-foreground pt-2 block">
                  {isArabic ? t("free_position_control") : "Free rotation & position control"}
                </Label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{isArabic ? t("rotation_label") : "Rotation"}</Label>
                    <span className="text-xs font-mono text-primary">{logoRot}°</span>
                  </div>
                  <input
                    type="range" min={-180} max={180} step={1}
                    value={logoRot}
                    onChange={e => { const v = Number(e.target.value); setLogoRot(v); }}
                    className="w-full accent-primary h-1.5 cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? t("orientation_horizontal") : "Horizontal"}</Label>
                      <span className="text-xs font-mono text-primary">{logoOX}px</span>
                    </div>
                    <input
                      type="range" min={-800} max={800} step={1}
                      value={logoOX}
                      onChange={e => { const v = Number(e.target.value); setLogoOX(v); }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? t("orientation_vertical") : "Vertical"}</Label>
                      <span className="text-xs font-mono text-primary">{logoOY}px</span>
                    </div>
                    <input
                      type="range" min={-800} max={800} step={1}
                      value={logoOY}
                      onChange={e => { const v = Number(e.target.value); setLogoOY(v); }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLogoW(64); setLogoH(64);
                    setLogoRot(0); setLogoOX(0); setLogoOY(0);
                    setLogoScalePct(100); setLogoAspectLocked(false);
                    resetLogoBg();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {isArabic ? t("reset_all") : "Reset all"}
                </button>

                {/* Logo background box control */}
                <div className="space-y-3 pt-3 mt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      {isArabic ? t("logo_box_background") : "Logo background box"}
                    </Label>
                    <button
                      type="button"
                      onClick={() => setLogoBgEnabled(!logoBgEnabled)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        logoBgEnabled
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {logoBgEnabled
                        ? (isArabic ? t("visible") : "Visible")
                        : (isArabic ? t("transparent") : "Transparent")}
                    </button>
                  </div>

                  {logoBgEnabled && (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        {["#3b82f6", "#7c3aed", "#e11d48", "#d97706", "#059669", "#475569", "#18181b", "#f8fafc"].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setLogoBgColor(c)}
                            className={cn(
                              "w-7 h-7 rounded-full border-2 transition-transform",
                              logoBgColor === c ? "border-primary scale-110" : "border-border"
                            )}
                            style={{ backgroundColor: c }}
                            aria-label={c}
                          />
                        ))}
                        <input
                          type="color"
                          value={logoBgColor}
                          onChange={e => setLogoBgColor(e.target.value)}
                          className="w-7 h-7 rounded-full border-2 border-border cursor-pointer bg-transparent"
                          title={isArabic ? t("custom_color") : "Custom color"}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{isArabic ? t("box_opacity") : "Box opacity"}</Label>
                          <span className="text-xs font-mono text-primary">{logoBgOpacity}%</span>
                        </div>
                        <input
                          type="range" min={0} max={100} step={1}
                          value={logoBgOpacity}
                          onChange={e => setLogoBgOpacity(Number(e.target.value))}
                          className="w-full accent-primary h-1.5 cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{isArabic ? t("box_corner_radius") : "Corner roundness"}</Label>
                          <span className="text-xs font-mono text-primary">{logoBgRadius}px</span>
                        </div>
                        <input
                          type="range" min={0} max={100} step={1}
                          value={logoBgRadius}
                          onChange={e => setLogoBgRadius(Number(e.target.value))}
                          className="w-full accent-primary h-1.5 cursor-pointer"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>}
            </div>

            <div className="border-t border-border" />

            {/* Work Schedule */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setScheduleOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {isArabic ? t("shift_schedule") : "Work Schedule"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{workStartTime}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", scheduleOpen && "rotate-180")} />
                </span>
              </button>
              {scheduleOpen && <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? "وقت بداية الدوام" : "Start Time"}</Label>
                  <Input type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? t("grace_period_min") : "Grace Period (min)"}</Label>
                  <Input type="number" min={0} max={120} value={lateGraceMinutes} onChange={e => setLateGraceMinutes(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))} className="font-mono" />
                </div>
              </div>
              {/* Break duration row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? "مدة الاستراحة (دقيقة)" : "Break Duration (min)"}</Label>
                  <Input type="number" min={0} max={240} value={breakMinutes} onChange={e => setBreakMinutes(Math.max(0, Math.min(240, parseInt(e.target.value) || 0)))} className="font-mono" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? "نهاية الدوام المحسوبة" : "Calculated Shift End"}</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted/40 font-mono text-sm text-primary font-semibold">
                    {(() => {
                      const [hh, mm] = workStartTime.split(":").map(Number);
                      // workHoursPerDay default 8; shown as reference
                      const endMin = hh * 60 + mm + 8 * 60 + breakMinutes;
                      return `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                    })()}
                  </div>
                </div>
              </div>
              {breakMinutes > 0 && (
                <p className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {isArabic
                    ? `⏸ ${breakMinutes} دقيقة استراحة يومية لا تُحتسب في الراتب`
                    : `⏸ ${breakMinutes} min daily break excluded from paid hours`}
                </p>
              )}
              {/* Timezone selector */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{isArabic ? "المنطقة الزمنية" : "Timezone"}</Label>
                  <span className="text-xs font-mono font-semibold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                    {(() => {
                      try {
                        const now = new Date();
                        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
                        const localStr = new Intl.DateTimeFormat("en-US", {
                          timeZone: appTimezone,
                          hour: "2-digit", minute: "2-digit", hour12: false,
                          timeZoneName: "shortOffset",
                        }).format(now);
                        const match = localStr.match(/GMT([+-]\d+(?::\d+)?)/);
                        if (match) return `UTC${match[1]}`;
                        // fallback: compute offset manually
                        const tzDate = new Date(now.toLocaleString("en-US", { timeZone: appTimezone }));
                        const diff = Math.round((tzDate.getTime() - utcMs) / 60000);
                        const sign = diff >= 0 ? "+" : "-";
                        const abs = Math.abs(diff);
                        const hh = String(Math.floor(abs / 60)).padStart(2, "0");
                        const mm = String(abs % 60).padStart(2, "0");
                        return `UTC${sign}${hh}:${mm}`;
                      } catch { return appTimezone; }
                    })()}
                  </span>
                </div>
                <select
                  value={appTimezone}
                  onChange={e => setAppTimezone(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                >
                  <optgroup label={isArabic ? "أوروبا" : "Europe"}>
                    <option value="Europe/Stockholm">Europe/Stockholm (UTC+1/+2)</option>
                    <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                    <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                    <option value="Europe/Berlin">Europe/Berlin (UTC+1/+2)</option>
                    <option value="Europe/Rome">Europe/Rome (UTC+1/+2)</option>
                    <option value="Europe/Madrid">Europe/Madrid (UTC+1/+2)</option>
                    <option value="Europe/Amsterdam">Europe/Amsterdam (UTC+1/+2)</option>
                    <option value="Europe/Oslo">Europe/Oslo (UTC+1/+2)</option>
                    <option value="Europe/Helsinki">Europe/Helsinki (UTC+2/+3)</option>
                    <option value="Europe/Athens">Europe/Athens (UTC+2/+3)</option>
                    <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
                  </optgroup>
                  <optgroup label={isArabic ? "الشرق الأوسط وأفريقيا" : "Middle East & Africa"}>
                    <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                    <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                    <option value="Asia/Kuwait">Asia/Kuwait (UTC+3)</option>
                    <option value="Asia/Baghdad">Asia/Baghdad (UTC+3)</option>
                    <option value="Asia/Amman">Asia/Amman (UTC+2/+3)</option>
                    <option value="Asia/Beirut">Asia/Beirut (UTC+2/+3)</option>
                    <option value="Africa/Cairo">Africa/Cairo (UTC+2)</option>
                  </optgroup>
                  <optgroup label={isArabic ? "أخرى" : "Other"}>
                    <option value="UTC">UTC (UTC+0)</option>
                    <option value="America/New_York">America/New_York (UTC-5/-4)</option>
                    <option value="America/Chicago">America/Chicago (UTC-6/-5)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
                    <option value="Asia/Karachi">Asia/Karachi (UTC+5)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                    <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                  </optgroup>
                </select>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                {isArabic ? (
                  <span>يُعد متأخراً بعد: <strong className="font-mono text-primary">{(() => { const [hh, mm] = workStartTime.split(":").map(Number); const t = hh * 60 + mm + lateGraceMinutes; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })()} ({appTimezone})</strong></span>
                ) : (
                  <span>Late after: <strong className="font-mono text-primary">{(() => { const [hh, mm] = workStartTime.split(":").map(Number); const t = hh * 60 + mm + lateGraceMinutes; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })()} ({appTimezone})</strong></span>
                )}
              </div>
              </div>}
            </div>

            <div className="border-t border-border" />

            {/* Admin Profile */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium"><UserCog className="w-3.5 h-3.5" /> {t("admin_profile")}</Label>
              <Input value={adminForm.username} onChange={e => setAdminForm(f => ({ ...f, username: e.target.value }))} placeholder={t("admin_username_placeholder")} />
              <div>
                <Input type="email" value={adminForm.email} onChange={e => { setAdminForm(f => ({ ...f, email: e.target.value })); setEmailError(""); }} placeholder="admin@company.com" className={emailError ? "border-destructive" : ""} />
                {emailError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> {emailError}</p>}
              </div>
            </div>
          </Section>
        )}

        {/* ── 2. Appearance ── */}
        <Section
          id="appearance" open={isOpen("appearance")} onToggle={() => toggleSection("appearance")}
          icon={<Monitor className="w-4 h-4" />}
          title={t("appearance")}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        >
          {/* Theme Grid */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> {isArabic ? t("appearance_label2") : "Theme"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "light",  label: isArabic ? t("light_label2")    : "Light",  icon: <Sun className="w-4 h-4 text-yellow-500" />,     bg: "bg-white border-gray-200" },
                { value: "dark",   label: isArabic ? t("dark_label2")     : "Dark",   icon: <Moon className="w-4 h-4 text-slate-400" />,     bg: "bg-gray-900 border-gray-700" },
                { value: "system", label: isArabic ? t("automatic_label") : "Auto",   icon: <Monitor className="w-4 h-4 text-blue-400" />,   bg: "bg-gradient-to-br from-white to-gray-700 border-gray-400" },
              ].map(opt => (
                <button key={opt.value} onClick={() => handleSettings("theme", opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all text-xs font-medium",
                    theme === opt.value ? "border-primary ring-2 ring-primary/30 scale-105 bg-primary/5" : "border-border hover:border-muted-foreground/40"
                  )}>
                  <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center", opt.bg)}>
                    {"icon" in opt && opt.icon ? opt.icon : <span className={cn("w-4 h-4 rounded-full", (opt as any).dot)} />}
                  </div>
                  <span className="text-[10px] leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs"><Type className="w-3.5 h-3.5" /> {t("font_size")}</Label>
            <Select value={fontSize} onValueChange={v => handleSettings("fontSize", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">{t("small")}</SelectItem>
                <SelectItem value="medium">{t("medium")}</SelectItem>
                <SelectItem value="large">{t("large")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <DollarSign className="w-3.5 h-3.5" />
              {isArabic ? "عملة التطبيق" : "App Currency"}
            </Label>
            <Select value={currency} onValueChange={v => setCurrency(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(() => {
                    const opt = CURRENCIES.find(c => c.code === currency);
                    return opt
                      ? <span className="flex items-center gap-2"><span className="font-bold text-primary w-5 shrink-0">{opt.symbol}</span><span>{opt.code} — {isArabic ? opt.labelAr : opt.labelEn}</span></span>
                      : currency;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(opt => (
                  <SelectItem key={opt.code} value={opt.code}>
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-primary w-5 shrink-0">{opt.symbol}</span>
                      <span>{opt.code} — {isArabic ? opt.labelAr : opt.labelEn}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font Family */}
          {(() => {
            const fontOpts = [
              { value: "default"    as const, label: "Jakarta Sans",  preview: "Aa مرحبا", family: "'Plus Jakarta Sans', sans-serif",  tag: isArabic ? "افتراضي" : "Default" },
              { value: "inter"      as const, label: "Inter",         preview: "Aa Hello",  family: "'Inter', sans-serif",             tag: "Modern"   },
              { value: "nunito"     as const, label: "Nunito",        preview: "Aa Hello",  family: "'Nunito', sans-serif",            tag: "Rounded"  },
              { value: "poppins"    as const, label: "Poppins",       preview: "Aa Hello",  family: "'Poppins', sans-serif",           tag: "Geo"      },
              { value: "montserrat" as const, label: "Montserrat",    preview: "Aa Hello",  family: "'Montserrat', sans-serif",        tag: isArabic ? "عريض" : "Bold"    },
              { value: "raleway"    as const, label: "Raleway",       preview: "Aa Hello",  family: "'Raleway', sans-serif",           tag: isArabic ? "عريض" : "Bold"    },
              { value: "oswald"     as const, label: "Oswald",        preview: "Aa Hello",  family: "'Oswald', sans-serif",            tag: isArabic ? "ضيق عريض" : "Condensed" },
              { value: "lexend"     as const, label: "Lexend",        preview: "Aa Hello",  family: "'Lexend', sans-serif",            tag: isArabic ? "واضح" : "Clear"   },
              { value: "rubik"      as const, label: "Rubik",         preview: "Aa مرحبا", family: "'Rubik', sans-serif",             tag: isArabic ? "مدوّر" : "Round"  },
              { value: "outfit"     as const, label: "Outfit",        preview: "Aa Hello",  family: "'Outfit', sans-serif",            tag: isArabic ? "هندسي" : "Geometric" },
              { value: "space"      as const, label: "Space Grotesk", preview: "Aa Hello",  family: "'Space Grotesk', sans-serif",     tag: "Tech"     },
              { value: "cairo"      as const, label: "Cairo",         preview: "Aa مرحبا", family: "'Cairo', sans-serif",             tag: "Arabic"   },
              { value: "tajawal"    as const, label: "Tajawal",       preview: "Aa مرحبا", family: "'Tajawal', sans-serif",           tag: "Arabic"   },
              { value: "almarai"    as const, label: "Almarai",       preview: "Aa مرحبا", family: "'Almarai', sans-serif",           tag: isArabic ? "عربي عريض" : "AR Bold" },
              { value: "readex"     as const, label: "Readex Pro",    preview: "Aa مرحبا", family: "'Readex Pro', sans-serif",        tag: isArabic ? "ثنائي" : "Bilingual" },
              { value: "ibm"        as const, label: "IBM Plex AR",   preview: "Aa مرحبا", family: "'IBM Plex Arabic', sans-serif",   tag: "Pro"      },
            ];
            return (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Type className="w-3.5 h-3.5" />
                  {isArabic ? "عائلة الخط" : "Font Family"}
                </Label>
                <div
                  className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
                  style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                >
                  {fontOpts.map(opt => {
                    const isSelected = fontFamily === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFontFamily(opt.value as any)}
                        className={`snap-start shrink-0 flex flex-col items-center justify-between gap-1 rounded-xl border px-3 py-2.5 transition-all w-[88px] text-center ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <span
                          className="text-lg leading-tight font-semibold"
                          style={{ fontFamily: opt.family }}
                        >
                          {opt.preview}
                        </span>
                        <span className="text-[10px] font-medium text-foreground/80 truncate w-full text-center">
                          {opt.label}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full truncate max-w-full ${
                          isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {opt.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Font Weight ── */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Type className="w-3.5 h-3.5" /> {isArabic ? "وزن الخط (سُمك الخط)" : "Font Weight"}
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {([
                { value: "light",    labelAr: "خفيف",   labelEn: "Light",    sample: "أ A",   css: "300" },
                { value: "normal",   labelAr: "عادي",   labelEn: "Normal",   sample: "أ A",   css: "400" },
                { value: "semibold", labelAr: "نصف عريض", labelEn: "Semi",  sample: "أ A",   css: "600" },
                { value: "bold",     labelAr: "عريض",   labelEn: "Bold",     sample: "أ A",   css: "700" },
                { value: "heavy",    labelAr: "ثقيل",   labelEn: "Heavy",    sample: "أ A",   css: "800" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setFontWeight(opt.value); applyFontWeight(opt.value); }}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all",
                    fontWeight === opt.value
                      ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <span className="text-base leading-none" style={{ fontWeight: opt.css }}>{opt.sample}</span>
                  <span className="text-[10px] leading-tight text-center text-muted-foreground">
                    {isArabic ? opt.labelAr : opt.labelEn}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Interface Layout ── */}
          <div className="border-t border-border pt-3 space-y-4">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Paintbrush className="w-3.5 h-3.5" /> {isArabic ? t("customize_interface") : "Interface Customization"}
            </Label>

            {/* ── Live Preview ── */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? t("live_preview") : "Live Preview"}</Label>
              <div className="relative w-full h-36 rounded-2xl border-2 border-border overflow-hidden bg-background shadow-inner select-none">
                {/* Sidebar */}
                <div className={cn(
                  "absolute inset-y-0 start-0 bg-muted/60 border-e border-border flex flex-col gap-1 p-1.5 transition-all duration-300",
                  sidebarStyle === "icon-only" ? "w-8"  :
                  sidebarStyle === "compact"   ? "w-14" :
                  sidebarStyle === "wide"      ? "w-24" : "w-16"
                )}>
                  {/* Logo */}
                  <div className={cn(
                    "rounded-md mb-1 flex-shrink-0",
                    sidebarStyle === "icon-only" ? "w-4 h-4 mx-auto" : "h-4 w-full",
                    "bg-primary/30"
                  )} />
                  {[0,1,2,3].map(i => (
                    <div key={i} className={cn(
                      "flex items-center gap-1 px-1 py-0.5 rounded-md flex-shrink-0",
                      i === 0 ? "bg-primary/20" : ""
                    )}>
                      <div className="w-2 h-2 rounded-sm bg-muted-foreground/50 flex-shrink-0" />
                      {sidebarStyle !== "icon-only" && <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/30" />}
                    </div>
                  ))}
                </div>

                {/* Main area */}
                <div className={cn(
                  "absolute inset-y-0 end-0 p-2 flex flex-col gap-1.5 overflow-hidden transition-all duration-300",
                  sidebarStyle === "icon-only" ? "start-9"  :
                  sidebarStyle === "compact"   ? "start-15" :
                  sidebarStyle === "wide"      ? "start-25" : "start-17"
                )}>
                  {/* Cards row */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[0,1].map(i => (
                      <div key={i} className={cn(
                        "bg-card border border-border h-10 p-1.5 flex flex-col gap-0.5 justify-center transition-all duration-300",
                        cardStyle === "sharp"  ? "rounded-sm" :
                        cardStyle === "glass"  ? "rounded-xl bg-white/30 dark:bg-black/20 backdrop-blur-sm border-white/40" :
                        "rounded-xl"
                      )}>
                        <div className="h-1.5 w-8 rounded-full bg-primary/50" />
                        <div className="h-1 w-12 rounded-full bg-muted-foreground/30" />
                        <div className="h-1 w-6 rounded-full bg-muted-foreground/20" />
                      </div>
                    ))}
                  </div>

                  {/* Table rows */}
                  <div className="border border-border rounded-lg overflow-hidden flex-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={cn(
                        "flex items-center gap-1 border-b border-border/40 last:border-0 px-1.5 transition-all duration-300",
                        tableStyle === "compact"     ? "py-0.5" :
                        tableStyle === "comfortable" ? "py-1.5" : "py-1",
                        i === 0 ? "bg-muted/40 text-[9px] font-semibold text-muted-foreground" : ""
                      )}>
                        <div className="w-3 h-2 rounded bg-muted-foreground/20 flex-shrink-0" />
                        <div className="flex-1 h-1.5 rounded-full bg-muted-foreground/20" />
                        <div className="w-4 h-1.5 rounded-full bg-primary/30" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Style Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? t("sidebar_shape") : "Sidebar Style"}</Label>
              <Select value={sidebarStyle} onValueChange={v => setSidebarStyle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{isArabic ? t("sidebar_normal_desc") : "Default — Balanced width"}</SelectItem>
                  <SelectItem value="compact">{isArabic ? t("sidebar_compact_desc") : "Compact — Less space"}</SelectItem>
                  <SelectItem value="icon-only">{isArabic ? t("sidebar_icon_only_desc") : "Icons only — Max space"}</SelectItem>
                  <SelectItem value="wide">{isArabic ? t("sidebar_wide_desc") : "Wide — With full labels"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Card Style Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? t("card_shape") : "Card Style"}</Label>
              <Select value={cardStyle} onValueChange={v => setCardStyle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">{isArabic ? t("card_shape_curved_desc") : "Rounded — Soft corners"}</SelectItem>
                  <SelectItem value="sharp">{isArabic ? t("card_shape_sharp_desc") : "Sharp — Straight edges"}</SelectItem>
                  <SelectItem value="glass">{isArabic ? t("card_shape_glass_desc") : "Glass — Frosted effect"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table Style Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? t("table_shape") : "Table Style"}</Label>
              <Select value={tableStyle} onValueChange={v => setTableStyle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">{isArabic ? t("table_comfortable_desc") : "Comfortable — Tall rows"}</SelectItem>
                  <SelectItem value="cozy">{isArabic ? t("table_warm_desc") : "Cozy — Medium rows"}</SelectItem>
                  <SelectItem value="compact">{isArabic ? t("table_compact_desc") : "Compact — Dense rows"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Card Color */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{isArabic ? "لون الكروت" : "Card Color"}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={cardColorMode === "auto" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCardColorMode("auto")}
                >
                  {isArabic ? "تلقائي" : "Automatic"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardColorMode === "custom" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCardColorMode("custom")}
                >
                  {isArabic ? "مخصص" : "Custom"}
                </Button>
              </div>

              {cardColorMode === "custom" && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "#ffffff", "#f8fafc", "#1e293b", "#0f172a",
                      "#1e1b4b", "#3730a3", "#164e63", "#134e4a",
                      "#3f1d38", "#4c1d24", "#422006", "#292524",
                    ].map(hex => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setCardColor(hex)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110",
                          cardColor.toLowerCase() === hex ? "border-primary ring-2 ring-primary/40" : "border-border"
                        )}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      >
                        {cardColor.toLowerCase() === hex && (
                          <Check className={cn("w-3.5 h-3.5", hex === "#ffffff" || hex === "#f8fafc" ? "text-slate-800" : "text-white")} />
                        )}
                      </button>
                    ))}
                    <label
                      className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden relative"
                      title={isArabic ? "لون مخصص" : "Custom color"}
                    >
                      <input
                        type="color"
                        value={cardColor}
                        onChange={e => setCardColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Plus className="w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </label>
                  </div>
                  <div
                    className="rounded-lg border p-3 text-xs flex items-center gap-2"
                    style={{
                      background: cardColor,
                      borderColor: "hsl(var(--card-border))",
                      color: (() => {
                        const h = cardColor.slice(1);
                        const r = parseInt(h.slice(0,2), 16), g = parseInt(h.slice(2,4), 16), b = parseInt(h.slice(4,6), 16);
                        return (r*0.299 + g*0.587 + b*0.114) > 150 ? "#0f172a" : "#f8fafc";
                      })(),
                    }}
                  >
                    {isArabic ? "معاينة لون الكرت" : "Card color preview"}
                  </div>
                </div>
              )}
            </div>

            {/* Font Color */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{isArabic ? "لون الخط" : "Font Color"}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={fontColorMode === "auto" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setFontColorMode("auto")}
                >
                  {isArabic ? "تلقائي" : "Automatic"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={fontColorMode === "custom" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setFontColorMode("custom")}
                >
                  {isArabic ? "مخصص" : "Custom"}
                </Button>
              </div>

              {fontColorMode === "custom" && (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "#0f172a", "#1e293b", "#334155", "#111827",
                      "#f8fafc", "#e2e8f0", "#3730a3", "#164e63",
                      "#134e4a", "#4c1d24", "#422006", "#292524",
                    ].map(hex => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setFontColor(hex)}
                        className={cn(
                          "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110",
                          fontColor.toLowerCase() === hex ? "border-primary ring-2 ring-primary/40" : "border-border"
                        )}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      >
                        {fontColor.toLowerCase() === hex && (
                          <Check className={cn("w-3.5 h-3.5", ["#f8fafc", "#e2e8f0"].includes(hex) ? "text-slate-800" : "text-white")} />
                        )}
                      </button>
                    ))}
                    <label
                      className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden relative"
                      title={isArabic ? "لون مخصص" : "Custom color"}
                    >
                      <input
                        type="color"
                        value={fontColor}
                        onChange={e => setFontColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Plus className="w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </label>
                  </div>
                  <div
                    className="rounded-lg border p-3 text-xs flex items-center gap-2 bg-card"
                    style={{ color: fontColor }}
                  >
                    {isArabic ? "معاينة لون الخط" : "Font color preview"}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border" />

            {/* ── 3D Glass & Background customization ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> {t("glass_3d_bg_title")}
                </Label>
                <button
                  type="button"
                  onClick={() => { resetAppearance(); toast({ title: t("restored_default_toast") }); }}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline"
                >
                  <RotateCcw className="w-3 h-3" /> {t("restore_original")}
                </button>
              </div>

              {/* Glass intensity — only affects cards when Card Style above is set to "Glass" */}
              <div className={cn("space-y-1.5", cardStyle !== "glass" && "opacity-50")}>
                <Label className="text-xs text-muted-foreground">{t("glass_intensity_label")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { val: "off", key: "glass_off" },
                    { val: "light", key: "glass_light" },
                    { val: "medium", key: "glass_medium" },
                    { val: "strong", key: "glass_strong" },
                  ] as const).map(({ val, key }) => (
                    <button key={val} type="button" disabled={cardStyle !== "glass"} onClick={() => setGlassIntensity(val)}
                      className={cn(
                        "py-2 rounded-lg border text-[11px] font-medium transition-colors",
                        cardStyle !== "glass" ? "cursor-not-allowed" :
                        glassIntensity === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      )}>
                      {t(key)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {cardStyle !== "glass"
                    ? (isArabic ? "متاح فقط عند اختيار نمط الكرت \"زجاجي\" أعلاه — الكروت المدوّرة والحادة دائمًا مصمتة." : "Only applies when Card Style above is set to \"Glass\" — Rounded and Sharp cards are always solid.")
                    : t("glass_intensity_desc")}
                </p>
              </div>

              {/* Background mode */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("app_background_label")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: "default", key: "bg_default" },
                    { val: "gradient", key: "bg_gradient" },
                    { val: "image", key: "bg_image" },
                  ] as const).map(({ val, key }) => (
                    <button key={val} type="button" onClick={() => setBackgroundMode(val)}
                      className={cn(
                        "py-2 rounded-lg border text-[11px] font-medium transition-colors",
                        backgroundMode === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                      )}>
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>

              {backgroundMode === "gradient" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {[
                      { val: "aurora",     label: isArabic ? "أورورا"       : "Aurora",     css: "linear-gradient(135deg,#1a1f3a,#312e81,#0891b2)" },
                      { val: "deepPurple", label: isArabic ? "بنفسجي غامق"  : "Deep Purple", css: "linear-gradient(135deg,#0f0a1e,#3b0764,#7c3aed)" },
                      { val: "violet",     label: isArabic ? "بنفسجي ساطع"  : "Violet",      css: "linear-gradient(135deg,#100d24,#4c1d95,#8b5cf6)" },
                      { val: "sunset",     label: isArabic ? "غروب"         : "Sunset",      css: "linear-gradient(135deg,#2a1230,#be185d,#f97316)" },
                      { val: "ocean",      label: isArabic ? "محيط"         : "Ocean",       css: "linear-gradient(135deg,#0a2540,#0284c7,#22d3ee)" },
                      { val: "emerald",    label: isArabic ? "زمردي"        : "Emerald",     css: "linear-gradient(135deg,#0a2e24,#059669,#14b8a6)" },
                      { val: "roseDark",   label: isArabic ? "وردي داكن"    : "Rose Dark",   css: "linear-gradient(135deg,#1a0a12,#9f1239,#ec4899)" },
                      { val: "darkSlate",  label: isArabic ? "أردوازي"      : "Dark Slate",  css: "linear-gradient(135deg,#050810,#1e293b,#334155)" },
                      { val: "copper",     label: isArabic ? "نحاسي"        : "Copper",      css: "linear-gradient(135deg,#1a0e08,#92400e,#d97706)" },
                      { val: "sakura",     label: isArabic ? "ساكورا"       : "Sakura",      css: "linear-gradient(135deg,#1a0a14,#9d174d,#f472b6)" },
                      { val: "arctic",     label: isArabic ? "قطبي"         : "Arctic",      css: "linear-gradient(135deg,#060f18,#0c4a6e,#38bdf8)" },
                    ].map(g => (
                      <button key={g.val} type="button" onClick={() => setBackgroundGradient(g.val)}
                        className={cn(
                          "h-12 rounded-lg border-2 relative overflow-hidden",
                          backgroundGradient === g.val ? "border-primary ring-2 ring-primary/40" : "border-border"
                        )}
                        style={{ background: g.css }}
                        title={g.label}
                      >
                        {backgroundGradient === g.val && <CheckCircle2 className="w-4 h-4 text-white absolute top-1 end-1 drop-shadow" />}
                      </button>
                    ))}
                  </div>

                  <Label className="text-xs text-muted-foreground">
                    {isArabic ? "ألوان فاتحة ومتوسطة" : "Light & Medium Tones"}
                  </Label>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {[
                      { val: "ivory",            label: isArabic ? "عاجي"        : "Ivory",       css: "linear-gradient(135deg,#fdf9f2,#f7ecd9,#f2ead9)" },
                      { val: "skyLight",         label: isArabic ? "سماء فاتحة"  : "Sky Light",   css: "linear-gradient(135deg,#f0f9ff,#dbeeff,#bae6fd)" },
                      { val: "blossom",          label: isArabic ? "أزهار"       : "Blossom",     css: "linear-gradient(135deg,#fdf2f8,#f3e8ff,#e9d5ff)" },
                      { val: "coral",            label: isArabic ? "كورال"       : "Coral",       css: "linear-gradient(135deg,#ffedd5,#fed7aa,#fdba8c)" },
                      { val: "sageMedium",       label: isArabic ? "سيج"         : "Sage",        css: "linear-gradient(135deg,#dcfce7,#bbf7d0,#86c590)" },
                      { val: "periwinkleMedium", label: isArabic ? "بنفسجي مزرق" : "Periwinkle",  css: "linear-gradient(135deg,#e0e7ff,#c7d2fe,#a5b4fc)" },
                    ].map(g => (
                      <button key={g.val} type="button" onClick={() => setBackgroundGradient(g.val)}
                        className={cn(
                          "h-12 rounded-lg border-2 relative overflow-hidden",
                          backgroundGradient === g.val ? "border-primary ring-2 ring-primary/40" : "border-border"
                        )}
                        style={{ background: g.css }}
                        title={g.label}
                      >
                        {backgroundGradient === g.val && <CheckCircle2 className="w-4 h-4 text-slate-800 absolute top-1 end-1 drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {backgroundMode === "image" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          if (file.size > 2_000_000) { toast({ title: t("max_2mb_error"), variant: "destructive" }); return; }
                          const reader = new FileReader();
                          reader.onload = ev => setBackgroundImage(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted cursor-pointer">
                        <Database className="w-3.5 h-3.5" /> {t("choose_image_bg")}
                      </span>
                    </label>
                    {backgroundImage && (
                      <button type="button" onClick={() => setBackgroundImage("")} className="px-3 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10">
                        {isArabic ? t("remove_action") : "Remove"}
                      </button>
                    )}
                  </div>
                  {backgroundImage && (
                    <div className="w-full h-20 rounded-lg overflow-hidden border border-border">
                      <img src={backgroundImage} alt="background" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">PNG/JPG/WebP — {t("max_2mb")}</p>
                </div>
              )}
            </div>

            <div className="border-t border-border" />

            {/* ── Accent Color ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{isArabic ? t("accent_color") : "Accent Color"}</Label>
                {accentColor && (
                  <button
                    onClick={() => setAccentColor("")}
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> {isArabic ? t("reset_action") : "Reset"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
                  "#eab308","#22c55e","#14b8a6","#3b82f6","#06b6d4",
                  "#64748b","#1e293b",
                ].map(hex => (
                  <button
                    key={hex}
                    onClick={() => setAccentColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all hover:scale-110 flex-shrink-0",
                      accentColor === hex
                        ? "border-foreground ring-2 ring-offset-1 ring-foreground scale-110"
                        : "border-transparent"
                    )}
                  />
                ))}
                {/* Custom color picker */}
                <label className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/50 hover:border-primary cursor-pointer flex-shrink-0 hover:scale-110 transition-all" title={isArabic ? t("custom_color") : "Custom color"}>
                  <input
                    type="color"
                    value={accentColor || "#6366f1"}
                    onChange={e => setAccentColor(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                  <Paintbrush className="w-3.5 h-3.5 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                </label>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Language Section ── */}
        <Section
          id="language" open={isOpen("language")} onToggle={() => toggleSection("language")}
          icon={<Globe className="w-4 h-4" />}
          title={t("language_section") ?? t("language")}
          accent="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              { code: "ar", flag: "🇸🇦", label: t("lang_arabic_native"),  native: "Arabic" },
              { code: "en", flag: "🇬🇧", label: "English",  native: "English" },
              { code: "sv", flag: "🇸🇪", label: "Svenska",  native: "Swedish" },
              { code: "fr", flag: "🇫🇷", label: "Français", native: "French" },
              { code: "de", flag: "🇩🇪", label: "Deutsch",  native: "German" },
              { code: "es", flag: "🇪🇸", label: "Español",  native: "Spanish" },
              { code: "tr", flag: "🇹🇷", label: "Türkçe",   native: "Turkish" },
              { code: "ur", flag: "🇵🇰", label: t("lang_urdu_native"),     native: "Urdu" },
            ] as { code: string; flag: string; label: string; native: string }[]).map(l => (
              <button
                key={l.code}
                onClick={() => handleSettings("language", l.code)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-start",
                  language === l.code
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                )}
              >
                <span className="text-xl leading-none">{l.flag}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{l.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{l.native}</p>
                </div>
                {language === l.code && (
                  <div className="ms-auto w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* ── 3. Clock Settings ── */}
        <Section
          id="clock" open={isOpen("clock")} onToggle={() => toggleSection("clock")}
          icon={<Clock className="w-4 h-4" />}
          title={isArabic ? t("clock_settings") : "Clock Settings"}
          accent="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        >
          {/* Live preview */}
          <div className="flex justify-center items-center min-h-[120px] rounded-xl bg-muted/40 border border-border overflow-hidden">
            <ClockWidget />
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isArabic ? t("clock_pattern") : "Format"}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["12h", "24h"] as const).map(fmt => (
                <button key={fmt} onClick={() => setClockFormat(fmt)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${clockFormat === fmt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {fmt === "12h" ? (isArabic ? t("clock_12h") : "12h AM/PM") : (isArabic ? t("clock_24h") : "24h")}
                </button>
              ))}
            </div>
          </div>

          {/* Locale */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isArabic ? t("time_language") : "Time Locale"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[{ val: "en", label: "🇬🇧 EN" }, { val: "ar", label: "🇸🇦 AR" }, { val: "sv", label: "🇸🇪 SV" }].map(({ val, label }) => (
                <button key={val} onClick={() => setClockLocale(val as any)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${clockLocale === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Style Grid */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isArabic ? t("clock_shape") : "Clock Style"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "digital",  icon: "🔢", labelAr: t("clock_style_digital"),       labelEn: "Digital"   },
                { val: "boxed",    icon: "⬛", labelAr: t("clock_style_squares"),     labelEn: "Boxed"     },
                { val: "neon",     icon: "🌈", labelAr: t("clock_style_neon2"),       labelEn: "Neon"      },
                { val: "neontube", icon: "💡", labelAr: t("clock_style_neon_tube"), labelEn: "Tube"      },
                { val: "retro",    icon: "🖥️", labelAr: t("clock_style_retro"),      labelEn: "Retro"     },
                { val: "gradient", icon: "✨", labelAr: t("clock_style_gradient"),       labelEn: "Gradient"  },
                { val: "glass",    icon: "🪟", labelAr: t("clock_style_glass"),      labelEn: "Glass"     },
                { val: "flip",     icon: "🃏", labelAr: t("clock_style_flip"),      labelEn: "Flip"      },
                { val: "analog",   icon: "🕐", labelAr: t("clock_style_analog"),     labelEn: "Analog"    },
                { val: "minimal",  icon: "✦",  labelAr: t("style_simple"),       labelEn: "Minimal"   },
                { val: "aurora",   icon: "🌌", labelAr: t("clock_style_aurora"),     labelEn: "Aurora"    },
                { val: "matrix",   icon: "🟩", labelAr: t("clock_style_matrix"),    labelEn: "Matrix"    },
                { val: "neonring", icon: "🔵", labelAr: t("clock_style_neon_ring"),  labelEn: "Neon Ring" },
                { val: "wave",     icon: "🌊", labelAr: t("clock_style_wave"),       labelEn: "Wave"      },
                { val: "calendar", icon: "📅", labelAr: t("calendar_label2"),      labelEn: "Calendar"  },
                { val: "pixel",    icon: "👾", labelAr: t("clock_style_pixel"),       labelEn: "Pixel"     },
                { val: "sunburst", icon: "☀️", labelAr: t("clock_style_sunray"),   labelEn: "Sunburst"  },
                { val: "holographic", icon: "🔮", labelAr: t("clock_style_hologram"), labelEn: "Holographic" },
                { val: "glass3d",  icon: "🧊", labelAr: t("clock_style_glass3d"), labelEn: "Glass 3D" },
                { val: "orbit3d",  icon: "🪐", labelAr: t("clock_style_orbit3d"), labelEn: "Orbit 3D" },
                { val: "watch3d",  icon: "⌚", labelAr: "ساعة يد 3D",  labelEn: "Watch 3D"   },
                { val: "desk3d",   icon: "🕰️", labelAr: "ساعة مكتب 3D", labelEn: "Desk 3D"   },
                { val: "crystal3d",icon: "🔮", labelAr: "كريستال 3D",  labelEn: "Crystal 3D" },
                { val: "scifi",    icon: "🛸", labelAr: "خيال علمي",   labelEn: "Sci-Fi"     },
                { val: "holo",     icon: "📡", labelAr: "هولوغرام",    labelEn: "Holo Beam"  },
                { val: "techroom", icon: "⚙️", labelAr: "غرفة تقنية",  labelEn: "Tech Room"  },
                { val: "cardash",  icon: "🚗", labelAr: "عداد سيارة",  labelEn: "Car Dash"   },
              ] as const).map(({ val, icon, labelAr, labelEn }) => (
                <button key={val} onClick={() => setClockStyle(val)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all",
                    clockStyle === val ? "bg-primary text-primary-foreground border-primary scale-105 shadow" : "border-border hover:border-primary/40 hover:bg-muted"
                  )}>
                  <span className="text-xl">{icon}</span>
                  <span className="text-[10px] text-center leading-tight">{isArabic ? labelAr : labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isArabic ? t("clock_size") : "Clock Size"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "small", labelAr: t("small_label2"), labelEn: "Small", icon: <Minimize2 className="w-3 h-3" /> },
                { val: "medium", labelAr: t("medium_label2"), labelEn: "Medium", icon: <AlignCenter className="w-3.5 h-3.5" /> },
                { val: "large", labelAr: t("large_label2"), labelEn: "Large", icon: <Maximize2 className="w-4 h-4" /> },
              ].map(({ val, labelAr, labelEn, icon }) => (
                <button key={val} onClick={() => setClockSize(val as any)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${clockSize === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {icon} {isArabic ? labelAr : labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Floating Clock */}
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{isArabic ? t("floating_clock") : "Floating Clock"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? t("draggable_clock_all_pages") : "Draggable clock on all pages"}</p>
              </div>
              <Toggle enabled={floatingClockEnabled} onChange={v => { setFloatingClockEnabled(v); toast({ title: v ? t("clock_enabled") : t("clock_hidden") }); }} />
            </div>
            {floatingClockEnabled && (
              <div className="flex items-center justify-between gap-4 ps-4 border-s-2 border-primary/20">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1"><LogIn className="w-3.5 h-3.5 text-green-500" /> {isArabic ? t("quick_checkin") : "Quick Check-in"}</p>
                  <p className="text-xs text-muted-foreground">{isArabic ? t("checkin_button_in_clock") : "Check-in button in the clock"}</p>
                </div>
                <Toggle enabled={floatingClockCheckIn} onChange={v => { setFloatingClockCheckIn(v); toast({ title: v ? t("quick_checkin_enabled") : t("quick_checkin_disabled") }); }} />
              </div>
            )}
          </div>
        </Section>

        {/* ── 4. AI Assistant ── */}
        <Section
          id="ai" open={isOpen("ai")} onToggle={() => toggleSection("ai")}
          icon={<Bot className="w-4 h-4" />}
          title={isArabic ? t("customize_ai_assistant") : "AI Assistant"}
          badge={!aiEnabled ? <span className="text-[10px] bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">{isArabic ? "مُعطَّل" : "Off"}</span> : undefined}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        >
          {/* ── Enable / Disable AI ── */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-2.5">
              <PowerOff className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{isArabic ? "تفعيل المساعد الذكي" : "Enable AI Assistant"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "إظهار / إخفاء زر المساعد العائم" : "Show or hide the floating button"}</p>
              </div>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          {/* Assistant Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? t("assistant_name") : "Assistant Name"}</Label>
            <div className="flex gap-2">
              <Input value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder={t("assistant_wake_hint")} className="flex-1" maxLength={30} />
              <Button variant="outline" size="sm" onClick={() => { setAssistantName(t("my_assistant")); toast({ title: t("reset_done") }); }}>{isArabic ? t("default_option") : "Reset"}</Button>
            </div>
          </div>

          {/* Personality */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? t("assistant_persona") : "Personality"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "friendly", label: t("style_friendly"), icon: "😊" },
                { value: "professional", label: t("professional_style"), icon: "💼" },
                { value: "concise", label: t("style_brief"), icon: "⚡" },
              ] as { value: AssistantPersonality; label: string; icon: string }[]).map(p => (
                <button key={p.value} onClick={() => setAssistantPersonality(p.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${assistantPersonality === p.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}>
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs font-semibold">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Wake Word */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? t("wake_word") : "Wake Word"}</Label>
            <div className="flex gap-2">
              <Input value={wakeWord} onChange={e => setWakeWord(e.target.value)} placeholder='مثال: مساعد، بلس...' className="flex-1" maxLength={30} />
              <Button variant="outline" size="sm" onClick={() => { setWakeWord(t("assistant_label")); toast({ title: 'تمت إعادة الضبط' }); }}>{isArabic ? t("default_option") : "Reset"}</Button>
            </div>
          </div>

          {/* ── Voice / TTS ── */}
          <div className="border-t border-border pt-3 space-y-2">
            {/* Always-speak AI responses */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-medium">{isArabic ? "رد المساعد دائماً بالصوت" : "AI Always Speaks Responses"}</p>
                  <p className="text-xs text-muted-foreground">{isArabic ? "يتكلم المساعد بكل رد تلقائياً (نص وصوت)" : "Assistant always speaks every reply aloud"}</p>
                </div>
              </div>
              <Switch checked={aiVoiceResponse} onCheckedChange={v => { setAiVoiceResponse(v); applyAiVoiceResponse(v); toast({ title: v ? (isArabic ? "🔊 المساعد سيرد بالصوت دائماً" : "🔊 AI will always speak") : (isArabic ? "🔇 الرد الصوتي التلقائي معطّل" : "🔇 Auto-speech disabled") }); }} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center gap-2.5">
                {ttsEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium">{isArabic ? "صوت المساعد عند الكلام" : "Voice When Speaking"}</p>
                  <p className="text-xs text-muted-foreground">{isArabic ? "يرد بالصوت عند استخدام الميكروفون" : "Speaks when using microphone input"}</p>
                </div>
              </div>
              <Switch checked={ttsEnabled} onCheckedChange={v => { setTtsEnabled(v); applyTtsEnabled(v); toast({ title: v ? (isArabic ? "🔊 صوت المساعد مفعّل" : "🔊 Voice enabled") : (isArabic ? "🔇 صوت المساعد معطّل" : "🔇 Voice disabled") }); }} />
            </div>
            {(ttsEnabled || aiVoiceResponse) && (
              <button
                onClick={() => {
                  if (!("speechSynthesis" in window)) { toast({ title: isArabic ? "غير مدعوم في هذا المتصفح" : "Not supported in this browser", variant: "destructive" }); return; }
                  window.speechSynthesis.cancel();
                  const u = new SpeechSynthesisUtterance(isArabic ? "مرحباً، أنا مساعدك الذكي. يمكنني الرد عليك بالصوت." : "Hello, I am your AI assistant. I can speak my responses aloud.");
                  u.lang = isArabic ? "ar-SA" : "en-US"; u.rate = 0.95;
                  window.speechSynthesis.speak(u);
                  toast({ title: isArabic ? "🔊 جارٍ التشغيل..." : "🔊 Playing..." });
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 w-full justify-center transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> {isArabic ? "تجربة صوت المساعد" : "Test AI Voice"}
              </button>
            )}
          </div>

          <div className="border-t border-border" />

          {/* ── Button Size ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">{isArabic ? "حجم الزر العائم" : "Button Size"}</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "small",  labelAr: "صغير",  labelEn: "Small",  size: "w-8 h-8" },
                { val: "medium", labelAr: "متوسط", labelEn: "Medium", size: "w-10 h-10" },
                { val: "large",  labelAr: "كبير",  labelEn: "Large",  size: "w-12 h-12" },
              ] as { val: AiButtonSize; labelAr: string; labelEn: string; size: string }[]).map(opt => (
                <button key={opt.val} onClick={() => setAiButtonSize(opt.val)}
                  className={cn("flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all",
                    aiButtonSize === opt.val ? "border-primary bg-primary/10 text-primary scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                  )}>
                  <div className={cn(opt.size, "rounded-full bg-current opacity-40")} />
                  <span className="text-xs font-medium">{isArabic ? opt.labelAr : opt.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Avatar Style ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SmilePlus className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">{isArabic ? "نمط أفاتار المساعد" : "Assistant Avatar"}</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "human", emoji: "👤", labelAr: "إنسان",  labelEn: "Human"  },
                { val: "robot", emoji: "🤖", labelAr: "روبوت",  labelEn: "Robot"  },
                { val: "cat",   emoji: "🐱", labelAr: "قطة",    labelEn: "Cat"    },
                { val: "alien", emoji: "👽", labelAr: "فضائي",  labelEn: "Alien"  },
                { val: "panda", emoji: "🐼", labelAr: "باندا",  labelEn: "Panda"  },
                { val: "fox",   emoji: "🦊", labelAr: "ثعلب",   labelEn: "Fox"    },
              ] as { val: AvatarStyle; emoji: string; labelAr: string; labelEn: string }[]).map(opt => (
                <button key={opt.val} onClick={() => setAiAvatarStyle(opt.val)}
                  className={cn("flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all",
                    aiAvatarStyle === opt.val ? "border-primary bg-primary/10 text-primary scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                  )}>
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className="text-[10px] font-medium">{isArabic ? opt.labelAr : opt.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Button Appearance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{isArabic ? t("floating_button_shape") : "Floating Button"}</Label>
              <button onClick={() => { setAiButtonIcon("bot"); setAiButtonShape("circle"); setAiButtonColor("primary"); setAiButtonCustomColor("#6366f1"); setAiButtonSize("medium"); setAiAvatarStyle("human"); setAiEnabled(true); toast({ title: t("reset_done") }); }}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> {isArabic ? t("reset_action") : "Reset"}
              </button>
            </div>

            {/* Live Preview */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
              <div
                className={cn(
                  "w-14 h-14 flex items-center justify-center shadow-lg flex-shrink-0",
                  aiButtonShape === "circle"   ? "rounded-full" :
                  aiButtonShape === "rounded"  ? "rounded-2xl"  :
                  aiButtonShape === "square"   ? "rounded-lg"   :
                  aiButtonShape === "gradient" ? "rounded-full" :
                  aiButtonShape === "neon"     ? "rounded-full" :
                  aiButtonShape === "glass"    ? "rounded-2xl"  :
                  aiButtonShape === "ring"     ? "rounded-full" : "rounded-full",
                  aiButtonShape === "neon" || aiButtonShape === "ring" ? "" : aiButtonColor === "primary" ? "bg-primary text-primary-foreground" : ""
                )}
                style={(() => {
                  const c = AI_PREVIEW_COLORS[aiButtonColor] ?? "hsl(var(--primary))";
                  const textC = aiButtonColor === "white" ? "#1e293b" : "#fff";
                  switch (aiButtonShape) {
                    case "gradient": return { background: `linear-gradient(135deg, ${c}, #7c3aed)`, color: "#fff", boxShadow: `0 0 20px ${c}60` };
                    case "neon": return { background: "transparent", color: c, border: `2px solid ${c}`, boxShadow: `0 0 12px ${c}, 0 0 30px ${c}50` };
                    case "glass": return { background: `${c}30`, backdropFilter: "blur(12px)", border: `1px solid ${c}60`, color: "#fff" };
                    case "ring": return { background: "transparent", border: `3px solid ${c}`, color: c };
                    default: return aiButtonColor !== "primary" ? { backgroundColor: c, color: textC } : {};
                  }
                })()}
              >
                {/* Render the selected icon in the live preview */}
                {((): React.ReactNode => {
                  const iconMap: Record<string, React.ReactNode> = {
                    bot: <Bot className="w-6 h-6" />, sparkles: <Sparkles className="w-6 h-6" />,
                    brain: <Brain className="w-6 h-6" />, zap: <Zap className="w-6 h-6" />,
                    star: <Star className="w-6 h-6" />, heart: <Heart className="w-6 h-6" />,
                    message: <MessageCircle className="w-6 h-6" />, cpu: <Cpu className="w-6 h-6" />,
                    wand: <Wand2 className="w-6 h-6" />, rocket: <Rocket className="w-6 h-6" />,
                    shield: <Shield className="w-6 h-6" />, globe: <Globe2 className="w-6 h-6" />,
                    atom: <Atom className="w-6 h-6" />, compass: <Compass className="w-6 h-6" />,
                    gem: <Gem className="w-6 h-6" />, ghost: <Ghost className="w-6 h-6" />,
                    crown: <Crown className="w-6 h-6" />, coffee: <Coffee className="w-6 h-6" />,
                    flame: <Flame className="w-6 h-6" />, target: <Target className="w-6 h-6" />,
                    // 3D icons
                    robot3d:    <Robot3DIcon    size={6} />,
                    gem3d:      <Gem3DIcon      size={6} />,
                    brain3d:    <Brain3DIcon    size={6} />,
                    fire3d:     <Flame3DIcon    size={6} />,
                    star3d:     <Star3DIcon     size={6} />,
                    orb3d:      <Orb3DIcon      size={6} />,
                    shield3d:   <Shield3DIcon   size={6} />,
                    crown3d:    <Crown3DIcon    size={6} />,
                    rocket3d:   <Rocket3DIcon   size={6} />,
                    eye3d:      <Eye3DIcon      size={6} />,
                    neural3d:   <Neural3DIcon   size={6} />,
                    hologram3d: <Hologram3DIcon size={6} />,
                    infinity3d: <Infinity3DIcon size={6} />,
                    dna3d:      <Dna3DIcon      size={6} />,
                    chip3d:     <Chip3DIcon     size={6} />,
                  };
                  return iconMap[aiButtonIcon] ?? <Bot className="w-6 h-6" />;
                })()}
              </div>
              <div>
                <p className="text-sm font-medium">{isArabic ? t("live_preview") : "Live Preview"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? t("appears_all_pages") : "Appears like this on all pages"}</p>
              </div>
            </div>

            {/* Icon Picker — 20 icons in 5 columns */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? t("icon_label") : "Icon"}</p>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { val: "bot",      icon: <Bot className="w-5 h-5" />,           labelAr: "روبوت",   labelEn: "Bot" },
                  { val: "sparkles", icon: <Sparkles className="w-5 h-5" />,      labelAr: "بريق",    labelEn: "Sparkles" },
                  { val: "brain",    icon: <Brain className="w-5 h-5" />,          labelAr: "دماغ",    labelEn: "Brain" },
                  { val: "zap",      icon: <Zap className="w-5 h-5" />,            labelAr: "برق",     labelEn: "Zap" },
                  { val: "star",     icon: <Star className="w-5 h-5" />,            labelAr: "نجمة",    labelEn: "Star" },
                  { val: "heart",    icon: <Heart className="w-5 h-5" />,           labelAr: "قلب",     labelEn: "Heart" },
                  { val: "message",  icon: <MessageCircle className="w-5 h-5" />,  labelAr: "رسالة",   labelEn: "Msg" },
                  { val: "cpu",      icon: <Cpu className="w-5 h-5" />,             labelAr: "معالج",   labelEn: "CPU" },
                  { val: "wand",     icon: <Wand2 className="w-5 h-5" />,           labelAr: "عصا",     labelEn: "Wand" },
                  { val: "rocket",   icon: <Rocket className="w-5 h-5" />,          labelAr: "صاروخ",   labelEn: "Rocket" },
                  { val: "shield",   icon: <Shield className="w-5 h-5" />,          labelAr: "درع",     labelEn: "Shield" },
                  { val: "globe",    icon: <Globe2 className="w-5 h-5" />,          labelAr: "كرة أرضية", labelEn: "Globe" },
                  { val: "atom",     icon: <Atom className="w-5 h-5" />,            labelAr: "ذرة",     labelEn: "Atom" },
                  { val: "compass",  icon: <Compass className="w-5 h-5" />,         labelAr: "بوصلة",   labelEn: "Compass" },
                  { val: "gem",      icon: <Gem className="w-5 h-5" />,             labelAr: "جوهرة",   labelEn: "Gem" },
                  { val: "ghost",    icon: <Ghost className="w-5 h-5" />,           labelAr: "شبح",     labelEn: "Ghost" },
                  { val: "crown",    icon: <Crown className="w-5 h-5" />,           labelAr: "تاج",     labelEn: "Crown" },
                  { val: "coffee",   icon: <Coffee className="w-5 h-5" />,          labelAr: "قهوة",    labelEn: "Coffee" },
                  { val: "flame",    icon: <Flame className="w-5 h-5" />,           labelAr: "لهب",     labelEn: "Flame" },
                  { val: "target",   icon: <Target className="w-5 h-5" />,          labelAr: "هدف",     labelEn: "Target" },
                ] as { val: AiButtonIcon; icon: React.ReactNode; labelAr: string; labelEn: string }[]).map(opt => (
                  <button key={opt.val} onClick={() => { setAiButtonIcon(opt.val); toast({ title: isArabic ? `أيقونة: ${opt.labelAr}` : `Icon: ${opt.labelEn}` }); }}
                    className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs transition-all",
                      aiButtonIcon === opt.val ? "border-primary bg-primary/10 text-primary scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                    )}>
                    {opt.icon}
                    <span className="text-[9px]">{isArabic ? opt.labelAr : opt.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Icon Picker */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-muted-foreground">{isArabic ? "أيقونات ثلاثية الأبعاد" : "3D Icons"}</p>
                <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">3D</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { val: "robot3d",    icon: <Robot3DIcon    size={5} />, labelAr: "روبوت",    labelEn: "Robot" },
                  { val: "gem3d",      icon: <Gem3DIcon      size={5} />, labelAr: "جوهرة",   labelEn: "Gem" },
                  { val: "brain3d",    icon: <Brain3DIcon    size={5} />, labelAr: "دماغ",    labelEn: "Brain" },
                  { val: "fire3d",     icon: <Flame3DIcon    size={5} />, labelAr: "نار",     labelEn: "Fire" },
                  { val: "star3d",     icon: <Star3DIcon     size={5} />, labelAr: "نجمة",   labelEn: "Star" },
                  { val: "orb3d",      icon: <Orb3DIcon      size={5} />, labelAr: "كرة",     labelEn: "Orb" },
                  { val: "shield3d",   icon: <Shield3DIcon   size={5} />, labelAr: "درع",     labelEn: "Shield" },
                  { val: "crown3d",    icon: <Crown3DIcon    size={5} />, labelAr: "تاج",     labelEn: "Crown" },
                  { val: "rocket3d",   icon: <Rocket3DIcon   size={5} />, labelAr: "صاروخ",  labelEn: "Rocket" },
                  { val: "eye3d",      icon: <Eye3DIcon      size={5} />, labelAr: "عين",     labelEn: "Eye" },
                  { val: "neural3d",   icon: <Neural3DIcon   size={5} />, labelAr: "شبكة عصبية", labelEn: "Neural" },
                  { val: "hologram3d", icon: <Hologram3DIcon size={5} />, labelAr: "هولوجرام",  labelEn: "Holo" },
                  { val: "infinity3d", icon: <Infinity3DIcon size={5} />, labelAr: "لانهاية",  labelEn: "∞" },
                  { val: "dna3d",      icon: <Dna3DIcon      size={5} />, labelAr: "دنا",       labelEn: "DNA" },
                  { val: "chip3d",     icon: <Chip3DIcon     size={5} />, labelAr: "شريحة",    labelEn: "Chip" },
                ] as { val: AiButtonIcon; icon: React.ReactNode; labelAr: string; labelEn: string }[]).map(opt => (
                  <button key={opt.val} onClick={() => { setAiButtonIcon(opt.val); toast({ title: isArabic ? `أيقونة: ${opt.labelAr}` : `Icon: ${opt.labelEn}` }); }}
                    className={cn("flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs transition-all",
                      aiButtonIcon === opt.val ? "border-primary bg-primary/10 scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                    )}>
                    {opt.icon}
                    <span className="text-[9px]">{isArabic ? opt.labelAr : opt.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Shape Picker — 10 shapes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? t("button_shape") : "Button Shape"}</p>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { val: "circle",   labelAr: "دائرة",   labelEn: "Circle",   demo: <div className="w-6 h-6 rounded-full bg-primary/40" /> },
                  { val: "rounded",  labelAr: "ناعم",    labelEn: "Rounded",  demo: <div className="w-6 h-6 rounded-2xl bg-primary/40" /> },
                  { val: "square",   labelAr: "مربع",    labelEn: "Square",   demo: <div className="w-6 h-6 rounded-lg bg-primary/40" /> },
                  { val: "pill",     labelAr: "حبة",     labelEn: "Pill",     demo: <div className="h-4 w-8 rounded-full bg-primary/40" /> },
                  { val: "hexagon",  labelAr: "سداسي",   labelEn: "Hexagon",  demo: <div className="w-6 h-6 bg-primary/40" style={{ clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)" }} /> },
                  { val: "blob",     labelAr: "فقاعة",   labelEn: "Blob",     demo: <div className="w-6 h-6 bg-primary/40" style={{ borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%" }} /> },
                  { val: "gradient", labelAr: "تدرج",    labelEn: "Gradient", demo: <div className="w-6 h-6 rounded-full" style={{ background: "linear-gradient(135deg,hsl(var(--primary)),#7c3aed)" }} /> },
                  { val: "neon",     labelAr: "نيون",    labelEn: "Neon",     demo: <div className="w-6 h-6 rounded-full border-2 border-primary" style={{ boxShadow: "0 0 8px hsl(var(--primary))" }} /> },
                  { val: "glass",    labelAr: "زجاج",    labelEn: "Glass",    demo: <div className="w-6 h-6 rounded-2xl bg-primary/20 border border-primary/40" /> },
                  { val: "ring",     labelAr: "حلقة",    labelEn: "Ring",     demo: <div className="w-6 h-6 rounded-full" style={{ border: "3px solid hsl(var(--primary))" }} /> },
                ] as { val: AiButtonShape; labelAr: string; labelEn: string; demo: React.ReactNode }[]).map(opt => (
                  <button key={opt.val} onClick={() => { setAiButtonShape(opt.val); toast({ title: isArabic ? opt.labelAr : opt.labelEn }); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-xs transition-all",
                      aiButtonShape === opt.val ? "border-primary bg-primary/10 text-primary scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                    )}>
                    <div className="h-6 flex items-center justify-center">{opt.demo}</div>
                    <span className="text-[9px]">{isArabic ? opt.labelAr : opt.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? t("button_color") : "Button Color"}</p>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { val: "primary", labelAr: t("primary_label"), labelEn: "Primary", swatch: "hsl(var(--primary))" },
                  { val: "violet",  labelAr: t("theme_purple"),  labelEn: "Violet",  swatch: "#7c3aed" },
                  { val: "rose",    labelAr: t("theme_pink"),     labelEn: "Rose",    swatch: "#e11d48" },
                  { val: "amber",   labelAr: t("color_amber"),  labelEn: "Amber",   swatch: "#d97706" },
                  { val: "emerald", labelAr: t("color_emerald"),    labelEn: "Emerald", swatch: "#059669" },
                  { val: "sky",     labelAr: t("color_sky"),    labelEn: "Sky",     swatch: "#0284c7" },
                  { val: "slate",   labelAr: t("color_gray"),    labelEn: "Slate",   swatch: "#475569" },
                  { val: "black",   labelAr: t("color_black"),     labelEn: "Black",   swatch: "#18181b" },
                  { val: "white",   labelAr: t("color_white"),     labelEn: "White",   swatch: "#f8fafc" },
                  { val: "custom",  labelAr: t("custom_label"),     labelEn: "Custom",  swatch: aiButtonCustomColor },
                ] as { val: AiButtonColor; labelAr: string; labelEn: string; swatch: string }[]).map(opt => (
                  <button key={opt.val} onClick={() => { setAiButtonColor(opt.val); toast({ title: isArabic ? opt.labelAr : opt.labelEn }); }}
                    className={cn("flex flex-col items-center gap-1.5 py-2 rounded-xl border-2 text-xs transition-all",
                      aiButtonColor === opt.val ? "border-primary bg-primary/5 scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                    )}>
                    <span className="w-7 h-7 rounded-full border border-border shadow-sm" style={{ background: opt.swatch }} />
                    <span className="text-[9px]">{isArabic ? opt.labelAr : opt.labelEn}</span>
                  </button>
                ))}
              </div>
              {aiButtonColor === "custom" && (
                <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg mt-2">
                  <input type="color" value={aiButtonCustomColor} onChange={e => setAiButtonCustomColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                  <div>
                    <p className="text-xs font-medium">{isArabic ? t("custom_color") : "Custom Color"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{aiButtonCustomColor}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── 6. Notifications ── */}
        <Section
          id="notif" open={isOpen("notif")} onToggle={() => toggleSection("notif")}
          icon={<BellRing className="w-4 h-4" />}
          title={isArabic ? t("notification_preferences") : "Notifications"}
          accent="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        >
          {notifPermission === "denied" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <BellOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{isArabic ? t("notif_blocked_msg") : "Notifications blocked — allow in browser settings"}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isArabic ? t("daily_attendance_reminders") : "Daily Reminders"}</p>
              <p className="text-xs text-muted-foreground">
                {isArabic
                  ? `${alarmSettings.startTime} صباحاً (حضور) و ${alarmSettings.endTime} (انصراف)`
                  : `At ${alarmSettings.startTime} (check-in) and ${alarmSettings.endTime} (check-out)`}
              </p>
            </div>
            <Toggle enabled={remindersEnabled} onChange={handleToggleReminders} />
          </div>
          {/* Notification sound picker */}
          <div>
            <Label className="text-xs mb-1.5 block">{isArabic ? "صوت الإشعار" : "Notification Sound"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "ding",    emoji: "🔔", ar: "دينج",    en: "Ding" },
                { val: "chime",   emoji: "🎵", ar: "نغمة",    en: "Chime" },
                { val: "ping",    emoji: "🔊", ar: "بينج",    en: "Ping" },
                { val: "pop",     emoji: "💬", ar: "فرقعة",   en: "Pop" },
                { val: "whistle", emoji: "🎶", ar: "صفير",    en: "Whistle" },
                { val: "none",    emoji: "🔇", ar: "بدون",    en: "None" },
              ] as { val: NotifSoundType; emoji: string; ar: string; en: string }[]).map(opt => (
                <button
                  key={opt.val}
                  onClick={async () => {
                    setNotifSoundTypeState(opt.val);
                    saveNotifSoundType(opt.val);
                    if (opt.val !== "none") {
                      try { await playNotifSound(opt.val, 0.8); } catch {}
                    }
                    toast({ title: isArabic ? `صوت: ${opt.ar}` : `Sound: ${opt.en}` });
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs transition-all",
                    notifSoundType === opt.val
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 scale-105"
                      : "border-border text-muted-foreground hover:border-orange-300"
                  )}
                >
                  <span className="text-lg leading-none">{opt.emoji}</span>
                  <span className="font-medium">{isArabic ? opt.ar : opt.en}</span>
                </button>
              ))}
            </div>
          </div>

          {remindersEnabled && notifPermission === "granted" && (
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={async () => {
              await sendTestNotification((localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "en");
              toast({ title: isArabic ? t("test_notif_sent") : "✅ Test notification sent" });
            }}>
              <Bell className="w-4 h-4" /> {isArabic ? t("test_notification") : "Test notification"}
            </Button>
          )}
        </Section>

        {/* ── 7. Shift Alarm ── */}
        <Section
          id="alarm" open={isOpen("alarm")} onToggle={() => toggleSection("alarm")}
          icon={<Bell className="w-4 h-4" />}
          title={isArabic ? t("shift_start_end_alarm") : "Shift Alarm"}
          accent="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isArabic ? t("enable_alarm") : "Enable Alarm"}</p>
              <p className="text-xs text-muted-foreground">{isArabic ? t("sound_shift_start_end") : "Sound at shift start and end"}</p>
            </div>
            <Switch checked={alarmSettings.enabled} onCheckedChange={async v => {
              setAlarmSettingsState(s => ({ ...s, enabled: v }));
              if (v) {
                // MUST be called here — this is a direct user-gesture handler.
                // It creates and warms up the shared AudioContext so it stays
                // "running" even when the alarm setTimeout fires later with no gesture.
                warmUpAudioContext();
                if ("Notification" in window && Notification.permission === "default") {
                  await Notification.requestPermission();
                }
                // Auto-subscribe to server push so alarm fires when screen is locked
                const newSettings = { ...alarmSettings, enabled: true };
                subscribeToPush(newSettings);
              } else {
                stopAudioKeepAlive();
                unsubscribeFromPush();
              }
            }} />
          </div>
          {alarmSettings.enabled && (
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span>🔗</span>
                {isArabic ? "مزامنة تلقائية من جدول الدوام — يمكنك تعديلها هنا" : "Auto-synced from Work Schedule — you can still adjust"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">{isArabic ? t("shift_start") : "Start"}</Label>
                  <Input type="time" value={alarmSettings.startTime} onChange={e => setAlarmSettingsState(s => ({ ...s, startTime: e.target.value }))} />
                </div>
                <div className="space-y-1"><Label className="text-xs">{isArabic ? t("shift_end") : "End"}</Label>
                  <Input type="time" value={alarmSettings.endTime} onChange={e => setAlarmSettingsState(s => ({ ...s, endTime: e.target.value }))} />
                </div>
              </div>
              {/* Sound type picker */}
              <div>
                <Label className="text-xs mb-1.5 block">{isArabic ? t("sound_type") : "Alarm Sound"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: "marimba",   emoji: "🎹", ar: "ماريمبا 🍎",     en: "Marimba 🍎" },
                    { val: "crystal",   emoji: "💎", ar: "كريستال 🍎",     en: "Crystal 🍎" },
                    { val: "pulse",     emoji: "💓", ar: "نبض 🍎",          en: "Pulse 🍎" },
                    { val: "galaxy",    emoji: "🌌", ar: "جالاكسي 🤖",      en: "Galaxy 🤖" },
                    { val: "xylophone", emoji: "🎶", ar: "إكسيلوفون 🤖",    en: "Xylophone 🤖" },
                    { val: "radar",     emoji: "📡", ar: "رادار",           en: "Radar" },
                    { val: "digital",   emoji: "⏰", ar: "رقمي",            en: "Digital" },
                    { val: "siren",     emoji: "🚨", ar: "صفارة",           en: "Siren" },
                    { val: "bell",      emoji: "🔔", ar: "جرس",             en: "Bell" },
                    { val: "chime",     emoji: "🎵", ar: "نغمة",            en: "Chime" },
                    { val: "horn",      emoji: "📯", ar: "بوق",             en: "Horn" },
                  ] as { val: AlarmSoundType; emoji: string; ar: string; en: string }[]).map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setAlarmSettingsState(s => ({ ...s, soundType: opt.val }))}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs transition-all",
                        alarmSettings.soundType === opt.val
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 scale-105"
                          : "border-border text-muted-foreground hover:border-red-300"
                      )}
                    >
                      <span className="text-lg leading-none">{opt.emoji}</span>
                      <span className="font-medium">{isArabic ? opt.ar : opt.en}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume */}
              <div>
                <Label className="text-xs">{isArabic ? t("volume_level") : "Volume"} ({Math.round(alarmSettings.volume * 100)}%)</Label>
                <input type="range" min="0.2" max="1" step="0.05" value={alarmSettings.volume}
                  onChange={e => setAlarmSettingsState(s => ({ ...s, volume: parseFloat(e.target.value) }))}
                  className="w-full accent-red-500 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isArabic ? "يُوصى بأعلى مستوى للمنبّه" : "Maximum volume recommended for alarms"}
                </p>
              </div>

              {/* Repeat count */}
              <div>
                <Label className="text-xs">{isArabic ? "عدد التكرارات" : "Repeat Count"} ({alarmSettings.repeatCount ?? 3}x)</Label>
                <input
                  type="range" min="1" max="5" step="1"
                  value={alarmSettings.repeatCount ?? 3}
                  onChange={e => setAlarmSettingsState(s => ({ ...s, repeatCount: parseInt(e.target.value) }))}
                  className="w-full accent-red-500 mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {isArabic ? "عدد مرات تكرار النغمة عند قرع المنبّه" : "How many times the alarm pattern repeats"}
                </p>
              </div>

              {/* Test button */}
              <Button variant="outline" size="sm" className="gap-1.5 w-full border-red-200 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:hover:bg-red-900/20" onClick={async () => {
                try {
                  // Warm up here too — ensures the context is running before playback
                  warmUpAudioContext();
                  await playAlarmSound(alarmSettings.soundType, alarmSettings.volume, alarmSettings.repeatCount ?? 3);
                  toast({ title: isArabic ? "✅ تشغيل المنبّه" : "✅ Alarm played" });
                } catch {
                  toast({ title: isArabic ? t("sound_play_failed") : "❌ Sound failed - check volume", variant: "destructive" });
                }
              }}>
                <Volume2 className="w-3.5 h-3.5 text-red-500" /> {isArabic ? "اختبار المنبّه 🔊" : "Test Alarm 🔊"}
              </Button>

              {/* Push notification subscription for locked-screen alarm */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  {isArabic ? t("alarm_on_lock") : "Alarm while screen is locked"}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {isArabic
                    ? t("subscribe_bg_notif_desc")
                    : "Subscribe to receive a server push notification even when the screen is locked"}
                </p>
                {/* Subscription status row */}
                {pushStatus === "subscribed" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {isArabic ? t("device_subscribed_alarm") : "Device subscribed to alarm push"}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={unsubscribeFromPush}>
                      {isArabic ? t("cancel_action2") : "Unsubscribe"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-full"
                    disabled={pushStatus === "subscribing"}
                    onClick={() => subscribeToPush(alarmSettings)}
                  >
                    {pushStatus === "subscribing" ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isArabic ? t("subscribing") : "Subscribing..."}</>
                    ) : (
                      <><Bell className="w-3.5 h-3.5" />{isArabic ? t("enable_alarm_lock") : "Enable locked-screen alarm"}</>
                    )}
                  </Button>
                )}

                {/* Test push button — always visible when alarm is enabled */}
                {alarmSettings.enabled && (
                  <div className="space-y-1.5 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 w-full text-xs border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20"
                      onClick={async () => {
                        if (pushStatus !== "subscribed") {
                          // Auto-subscribe first, then test
                          await subscribeToPush(alarmSettings);
                          await new Promise(r => setTimeout(r, 1000));
                        }
                        try {
                          const r = await authFetch("/api/push/test", { method: "POST" });
                          const j = await r.json().catch(() => ({}));
                          if (!r.ok) {
                            alert((isArabic ? "فشل: " : "Failed: ") + (j.error ?? r.status));
                          } else {
                            // success — notification should arrive within seconds
                          }
                        } catch { alert(isArabic ? "تعذّر الاتصال بالخادم" : "Could not reach server"); }
                      }}
                    >
                      <Bell className="w-3.5 h-3.5 text-blue-500" />
                      {isArabic ? "🔔 اختبار الإشعار الآن (أغلق الشاشة أولاً)" : "🔔 Test push now (lock screen first)"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {isArabic
                        ? "📱 iPhone: تأكد أن مفتاح الجرس الجانبي ليس في وضع الصامت وأن الإشعارات مفعّلة في الإعدادات"
                        : "📱 iPhone: ring/silent switch must be ON · Settings → Notifications → [App] → Sounds → ON"}
                    </p>
                  </div>
                )}
                {pushStatus === "error" && (
                  pushErrorMsg === "IOS_PWA_REQUIRED" ? (
                    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 space-y-2">
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 flex-shrink-0" />
                        {isArabic ? "مطلوب تثبيت التطبيق على الشاشة الرئيسية" : "Install app on Home Screen required"}
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-300">
                        {isArabic
                          ? "Safari على iOS يحتاج التطبيق مثبّتاً كـ PWA لدعم الإشعارات في الخلفية:"
                          : "Safari on iOS requires the app installed as a PWA for background notifications:"}
                      </p>
                      <ol className="text-xs text-orange-600 dark:text-orange-300 space-y-1 list-decimal list-inside">
                        {isArabic ? (
                          <>
                            <li>اضغط على زر <strong>المشاركة</strong> <span className="font-mono bg-orange-100 dark:bg-orange-900/40 px-1 rounded">□↑</span> في شريط Safari</li>
                            <li>اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong></li>
                            <li>افتح التطبيق من الشاشة الرئيسية وفعّل المنبّه مجدداً</li>
                          </>
                        ) : (
                          <>
                            <li>Tap the <strong>Share</strong> button <span className="font-mono bg-orange-100 dark:bg-orange-900/40 px-1 rounded">□↑</span> in Safari</li>
                            <li>Choose <strong>"Add to Home Screen"</strong></li>
                            <li>Open the app from your Home Screen and enable the alarm again</li>
                          </>
                        )}
                      </ol>
                    </div>
                  ) : (
                    <p className="text-xs text-destructive mt-1">
                      {pushErrorMsg || (isArabic ? t("subscription_failed_check_perm") : "Subscription failed. Please allow notifications.")}
                    </p>
                  )
                )}
              </div>
            </div>
          )}
        </Section>

        {/* ── Dashboard & Visual Effects ── */}
        <Section
          id="dashboard_effects" open={isOpen("dashboard_effects")} onToggle={() => toggleSection("dashboard_effects")}
          icon={<Sparkles className="w-4 h-4" />}
          title={isArabic ? "لوحة التحكم والمؤثرات البصرية" : "Dashboard & Visual Effects"}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        >
          {/* Welcome Banner */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isArabic ? "بانر الترحيب المتغير" : "Dynamic Welcome Banner"}</p>
              <p className="text-xs text-muted-foreground">{isArabic ? "يتغير لون البانر حسب وقت اليوم" : "Banner colour shifts with time of day"}</p>
            </div>
            <Toggle enabled={welcomeBannerEnabled} onChange={setWelcomeBannerEnabled} />
          </div>

          {/* Welcome Page Full Customization */}
          {welcomeBannerEnabled && (
            <div className="space-y-4 border border-border rounded-xl p-4 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isArabic ? "🎨 تخصيص صفحة الترحيب" : "🎨 Welcome Page Customization"}
              </p>

              {/* Title override */}
              <div className="space-y-1.5">
                <Label className="text-sm">{isArabic ? "عنوان التطبيق في شاشة البداية" : "App Title on Splash Screen"}</Label>
                <div className="flex gap-2">
                  <Input
                    value={welcomeTitle}
                    onChange={e => setWelcomeTitle(e.target.value)}
                    placeholder={isArabic ? "مثال: حضور، نظامي، HRX..." : "e.g. MyApp, HR System..."}
                    className="flex-1"
                    maxLength={30}
                  />
                  {welcomeTitle && (
                    <Button variant="outline" size="sm" onClick={() => setWelcomeTitle("")}>
                      {isArabic ? "مسح" : "Clear"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? "يستبدل كلمة 'AttendX' في شاشة البداية والبانر" : "Replaces 'AttendX' on the splash screen and banner"}
                </p>
              </div>

              {/* Welcome Message */}
              <div className="space-y-1.5">
                <Label className="text-sm">{isArabic ? "رسالة الترحيب" : "Welcome Message"}</Label>
                <div className="flex gap-2">
                  <Input
                    value={welcomeMessage}
                    onChange={e => setWelcomeMessage(e.target.value)}
                    placeholder={isArabic ? "مثال: أهلاً بك في نظام الحضور..." : "e.g. Welcome to your system..."}
                    className="flex-1"
                    maxLength={120}
                  />
                  {welcomeMessage && (
                    <Button variant="outline" size="sm" onClick={() => setWelcomeMessage("")}>
                      {isArabic ? "مسح" : "Clear"}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? "تظهر في البانر وشاشة البداية · اتركها فارغة لعرض التاريخ" : "Shown in the banner & splash · leave blank to show the date"}
                </p>
              </div>

              {/* Custom Icon / Emoji / Image Upload */}
              <div className="space-y-1.5">
                <Label className="text-sm">{isArabic ? "أيقونة / صورة مخصصة في البانر" : "Custom Icon / Image in Banner"}</Label>

                {/* Emoji quick-pick */}
                <div className="flex gap-2 flex-wrap">
                  {["🏢","🌟","⭐","🎯","🚀","💼","🌙","☀️","🌊","🔥","💎","🏆","🎨","🌿","✨"].map(em => (
                    <button
                      key={em}
                      onClick={() => setWelcomeImage(welcomeImage === em ? "" : em)}
                      className={`text-xl p-2 rounded-lg border-2 transition-all ${welcomeImage === em ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                    >
                      {em}
                    </button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setWelcomeImage("")} className="text-muted-foreground text-xs">
                    {isArabic ? "إزالة" : "Remove"}
                  </Button>
                </div>

                {/* Uploaded image preview */}
                {welcomeImage && welcomeImage.startsWith("/uploads/") && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-primary">
                    <img src={apiUrl(welcomeImage)} alt="preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setWelcomeImage("")}
                      className="absolute top-0.5 end-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >✕</button>
                  </div>
                )}

                {/* Upload button + manual input row */}
                <div className="flex gap-2 mt-1">
                  <Input
                    value={welcomeImage}
                    onChange={e => setWelcomeImage(e.target.value)}
                    placeholder={isArabic ? "أدخل إيموجي أو رابط صورة..." : "Enter emoji or image URL..."}
                    className="flex-1 text-sm"
                    maxLength={200}
                  />
                  {/* Hidden file input */}
                  <input
                    ref={welcomeImgRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setWelcomeImgUploading(true);
                      try {
                        const fileData = await compressImage(file, 800, 0.85);
                        const res = await authFetch("/api/uploads", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ fileName: file.name, contentType: file.type, fileData }),
                        });
                        if (!res.ok) throw new Error("upload failed");
                        const { path } = await res.json();
                        setWelcomeImage(path);
                      } catch {
                        toast({ title: isArabic ? "فشل رفع الصورة" : "Upload failed", variant: "destructive" });
                      } finally {
                        setWelcomeImgUploading(false);
                        if (welcomeImgRef.current) welcomeImgRef.current.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => welcomeImgRef.current?.click()}
                    disabled={welcomeImgUploading}
                    className="shrink-0 gap-1.5"
                  >
                    {welcomeImgUploading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Camera className="w-4 h-4" />}
                    {isArabic ? "رفع صورة" : "Upload"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArabic ? "ارفع صورة من جهازك أو أدخل إيموجي أو رابط" : "Upload an image or enter an emoji / URL"}
                </p>
              </div>

              {/* 3D Shape Selector */}
              <div className="space-y-1.5">
                <Label className="text-sm">{isArabic ? "شكل ثلاثي الأبعاد في البانر" : "3D Shape in Banner"}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: "none",    icon: "✕",  labelAr: "بلا شكل",  labelEn: "None" },
                    { val: "sphere",  icon: "⚪",  labelAr: "كرة",       labelEn: "Sphere" },
                    { val: "cube",    icon: "⬜",  labelAr: "مكعب",      labelEn: "Cube" },
                    { val: "ring",    icon: "⭕",  labelAr: "حلقة",      labelEn: "Ring" },
                    { val: "diamond", icon: "🔷",  labelAr: "ماسة",      labelEn: "Diamond" },
                    { val: "pyramid", icon: "🔺",  labelAr: "هرم",       labelEn: "Pyramid" },
                  ] as { val: string; icon: string; labelAr: string; labelEn: string }[]).map(s => (
                    <button
                      key={s.val}
                      onClick={() => setWelcomeShape(s.val as any)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center ${welcomeShape === s.val ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"}`}
                    >
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xs font-medium">{isArabic ? s.labelAr : s.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Banner Style Selector */}
              <div className="space-y-1.5">
                <Label className="text-sm">{isArabic ? "🖼️ شكل البانر" : "🖼️ Banner Style"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    {
                      val: "gradient",
                      labelAr: "متدرج",
                      labelEn: "Gradient",
                      preview: "linear-gradient(135deg,#f59e0b,#f97316,#ef4444)",
                      desc: isArabic ? "ألوان تتغير حسب الوقت" : "Color shifts by time of day",
                    },
                    {
                      val: "glass",
                      labelAr: "زجاج",
                      labelEn: "Glass",
                      preview: "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(167,139,250,0.2))",
                      desc: isArabic ? "زجاج شفاف عصري" : "Modern frosted glass",
                    },
                    {
                      val: "card",
                      labelAr: "بطاقة داكنة",
                      labelEn: "Dark Card",
                      preview: "linear-gradient(135deg,#0f172a,#1e293b)",
                      desc: isArabic ? "بطاقة أنيقة داكنة" : "Sleek dark card",
                    },
                    {
                      val: "minimal",
                      labelAr: "بسيط",
                      labelEn: "Minimal",
                      preview: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
                      desc: isArabic ? "نظيف وبسيط" : "Clean & minimal",
                    },
                  ] as { val: WelcomeStyle; labelAr: string; labelEn: string; preview: string; desc: string }[]).map(s => (
                    <button
                      key={s.val}
                      onClick={() => setWelcomeStyle(s.val)}
                      className={`flex flex-col gap-1.5 p-2.5 rounded-xl border-2 transition-all text-start ${welcomeStyle === s.val ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:border-primary/40"}`}
                    >
                      <div className="w-full h-8 rounded-lg" style={{ background: s.preview }} />
                      <span className={`text-xs font-semibold ${welcomeStyle === s.val ? "text-primary" : "text-foreground"}`}>
                        {isArabic ? s.labelAr : s.labelEn}
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sounds */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isArabic ? "الأصوات" : "Sound Effects"}</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{isArabic ? "أصوات واجهة المستخدم" : "UI Sound Effects"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "نغمات عند الإشعارات والتنبيهات والسحب" : "Tones for notifications, alerts, drag & drop"}</p>
              </div>
              <Toggle enabled={soundEnabled} onChange={setSoundEnabled} />
            </div>
            {soundEnabled && (
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "مستوى الصوت" : "Volume"} ({soundVolume}%)</Label>
                <input type="range" min="10" max="100" step="5" value={soundVolume}
                  onChange={e => setSoundVolume(Number(e.target.value))}
                  className="w-full accent-primary mt-1"
                />
                <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => { primeAudio(); playSoundTest(soundVolume); }}>
                  <Play className="w-3.5 h-3.5" /> {isArabic ? "تجربة الصوت" : "Test Sound"}
                </Button>
              </div>
            )}
          </div>

          {/* Lateness Alert */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{isArabic ? "تنبيه التأخير المتكرر" : "Recurring Lateness Alert"}</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{isArabic ? "تنبيه التأخير المتكرر" : "Lateness Alert"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "يكتشف الموظفين الذين يتأخرون بانتظام" : "Flags employees with repeated late check-ins"}</p>
              </div>
              <Toggle enabled={latenessAlertEnabled} onChange={setLatenessAlertEnabled} />
            </div>
            {latenessAlertEnabled && (
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "عدد مرات التأخير قبل التنبيه" : "Alert after N late days"}</Label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setLatenessAlertDays(n)}
                      className={cn(
                        "w-9 h-9 rounded-lg border text-sm font-semibold transition-all",
                        latenessAlertDays === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                      )}
                    >{n}</button>
                  ))}
                  <span className="text-xs text-muted-foreground">{isArabic ? "مرات" : "times"}</span>
                </div>
              </div>
            )}
          </div>

          {/* Dashboard card customization info */}
          <div className="border-t border-border pt-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <span className="text-base">💡</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isArabic
                  ? "يمكنك سحب بطاقات الإحصائيات في لوحة التحكم لإعادة ترتيبها، وإخفاء أي بطاقة بالضغط على أيقونة العين."
                  : "You can drag stat cards on the dashboard to reorder them, and hide any card by clicking its eye icon."}
              </p>
            </div>
          </div>
        </Section>

        {/* ── Splash Screen Customization — admin/manager only ── */}
        {isAdmin && <Section
          id="splash_screen" open={isOpen("splash_screen")} onToggle={() => toggleSection("splash_screen")}
          icon={<Smartphone className="w-4 h-4" />}
          title={isArabic ? "تخصيص شاشة البداية" : "Splash Screen"}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        >
          {/* Mini preview */}
          <div className="rounded-xl overflow-hidden border border-border" style={{ height: 140 }}>
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2 relative"
              style={{
                background: {
                  cosmic:   "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
                  ocean:    "linear-gradient(135deg,#0a2342,#1a4a8a,#0d2137)",
                  forest:   "linear-gradient(135deg,#0a2e1a,#1a5c34,#0a1e12)",
                  midnight: "linear-gradient(135deg,#0a0a0a,#1a1a2e,#16213e)",
                  rose:     "linear-gradient(135deg,#1a0a0e,#3d1020,#2a0f1f)",
                  amber:    "linear-gradient(135deg,#1a0f00,#3d2500,#1a0f00)",
                  dark:     "linear-gradient(135deg,#050505,#111111,#090909)",
                }[splashBgGradient] || "linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
              }}
            >
              <div className="flex flex-col items-center gap-1.5 px-8 py-4 rounded-2xl border border-white/15" style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)" }}>
                {splashLogoUrl ? (
                  <img src={splashLogoUrl.startsWith("data:") ? splashLogoUrl : (splashLogoUrl.startsWith("/uploads/") ? apiUrl(splashLogoUrl) : splashLogoUrl)} alt="" className="w-8 h-8 object-contain rounded-lg" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/70 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-white font-bold text-sm">{splashTagline || "Powered by AttendX © 2025"}</span>
              </div>
              <p className="absolute bottom-2 text-white/30 text-[9px] tracking-widest uppercase">{splashTagline || "Powered by AttendX © 2025"}</p>
            </div>
          </div>

          {/* ── Splash style selector ── */}
          <div className="space-y-2">
            <Label className="text-sm">{isArabic ? "تصميم شاشة البداية" : "Splash Screen Style"}</Label>
            <div className="grid grid-cols-2 gap-3">
              {([
                {
                  val: "style1" as SplashStyle,
                  label: isArabic ? "كرت زجاجي" : "Glass Card",
                  desc:  isArabic ? "كرت ثري دي + دائرة طاقة دوّارة" : "3D card · spinning energy orb",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"radial-gradient(circle at center,#123b70,#02040b 70%)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ width:52, height:38, borderRadius:10, border:"1px solid rgba(255,255,255,.3)",
                        background:"linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.04))",
                        backdropFilter:"blur(6px)", display:"flex", flexDirection:"column",
                        alignItems:"center", justifyContent:"center", gap:3, position:"relative" }}>
                        <div style={{ width:18, height:18, borderRadius:4, background:"white", opacity:0.85 }} />
                        <div style={{ width:28, height:3, borderRadius:2, background:"linear-gradient(90deg,#00eaff,#7c3cff)" }} />
                      </div>
                    </div>
                  ),
                },
                {
                  val: "style2" as SplashStyle,
                  label: isArabic ? "بريميوم حلقات" : "Premium Rings",
                  desc:  isArabic ? "حلقات طاقة + ضوء عابر" : "Energy rings · shine sweep",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"radial-gradient(circle at center,#163a70,#02030a 70%)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ position:"absolute", width:60, height:60, borderRadius:"50%", border:"1.5px solid #00eaff66" }} />
                      <div style={{ position:"absolute", width:40, height:40, borderRadius:"50%", border:"1.5px solid #8b5cf666" }} />
                      <div style={{ width:16, height:16, borderRadius:3, background:"white", opacity:0.9 }} />
                    </div>
                  ),
                },
                {
                  val: "style3" as SplashStyle,
                  label: isArabic ? "هولوغرام" : "Hologram",
                  desc:  isArabic ? "شبكة متحركة + حلقة هولوغرامية + مسح ضوئي" : "Grid · holo ring · scan line",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"radial-gradient(circle,#062b45,#000 70%)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{
                        position:"absolute", inset:0,
                        backgroundImage:"linear-gradient(#00ffff15 1px,transparent 1px),linear-gradient(90deg,#00ffff15 1px,transparent 1px)",
                        backgroundSize:"10px 10px",
                      }} />
                      <div style={{ position:"absolute", width:52, height:52, borderRadius:"50%", border:"1.5px solid #00ffff", boxShadow:"0 0 8px #00ffff" }} />
                      <div style={{ width:16, height:16, borderRadius:3, background:"white", boxShadow:"0 0 10px #00ffff" }} />
                    </div>
                  ),
                },
                {
                  val: "style4" as SplashStyle,
                  label: isArabic ? "ثري دي بريميوم" : "3D Premium",
                  desc:  isArabic ? "ضوء + حلقتان + شعاع سينمائي + 200 جزيء" : "Light · 2 rings · beam · 200 particles",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"radial-gradient(circle at center,#123c70,#000 75%)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ position:"absolute", width:56, height:56, borderRadius:"50%", border:"1.5px solid #00ffff55" }} />
                      <div style={{ position:"absolute", width:36, height:36, borderRadius:"50%", border:"1.5px solid #8b5cf655" }} />
                      <div style={{ position:"absolute", width:"100%", height:1, background:"white", opacity:0.3, boxShadow:"0 0 8px cyan" }} />
                      <div style={{ width:18, height:18, borderRadius:4, background:"white", boxShadow:"0 0 12px #00ffff" }} />
                    </div>
                  ),
                },
                {
                  val: "style5" as SplashStyle,
                  label: isArabic ? "فضاء ثري دي" : "Space 3D",
                  desc:  isArabic ? "نجوم + كرة ضوئية + مدارات + كاميرا Z" : "Stars · core · orbits · Z-camera",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"radial-gradient(circle at center,#123b66,#000 80%)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ position:"absolute", width:54, height:54, borderRadius:"50%", border:"1px solid #00ffff66" }} />
                      <div style={{ position:"absolute", width:34, height:34, borderRadius:"50%", border:"1px solid #8b5cf666" }} />
                      <div style={{ position:"absolute", width:28, height:28, borderRadius:"50%",
                        background:"radial-gradient(circle,#00ffffaa,transparent 70%)", filter:"blur(4px)" }} />
                      <div style={{ width:14, height:14, borderRadius:3, background:"white", boxShadow:"0 0 10px #00ffff", zIndex:2 }} />
                    </div>
                  ),
                },
                {
                  val: "style6" as SplashStyle,
                  label: isArabic ? "جسيمات 3D" : "Particles 3D",
                  desc:  isArabic ? "1200 جسيم يتجمع · فلاش · لوغو ينبثق" : "1200 particles · flash · logo reveal",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"radial-gradient(circle,#082c4a,#000)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {[...Array(18)].map((_,i) => (
                        <div key={i} style={{
                          position:"absolute", width:2, height:2, borderRadius:"50%",
                          background:"#00eaff", boxShadow:"0 0 4px #00ffff",
                          left:`${10+(i*5.2)%80}%`, top:`${10+(i*7.3)%80}%`,
                        }} />
                      ))}
                      <div style={{ width:18, height:18, borderRadius:4, background:"white",
                        boxShadow:"0 0 14px cyan", zIndex:2 }} />
                    </div>
                  ),
                },
                {
                  val: "style7" as SplashStyle,
                  label: isArabic ? "دخان سيان" : "Smoke Reveal",
                  desc:  isArabic ? "دخان · ضوء سيان · لوغو دوراني 3D · شرارات" : "Smoke · cyan glow · 3D logo spin · sparks",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"#000",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ position:"absolute", width:80, height:80, borderRadius:"50%",
                        background:"radial-gradient(circle,rgba(80,80,80,.4),transparent 70%)",
                        filter:"blur(8px)", left:"10%", top:"10%" }} />
                      <div style={{ position:"absolute", width:50, height:50, borderRadius:"50%",
                        background:"radial-gradient(circle,#00ffff55,transparent 70%)",
                        filter:"blur(6px)" }} />
                      {[...Array(10)].map((_,i) => (
                        <div key={i} style={{ position:"absolute", width:2, height:2, borderRadius:"50%",
                          background:"#fff", boxShadow:"0 0 4px cyan",
                          left:`${8+(i*9)%84}%`, top:`${15+(i*13)%65}%` }} />
                      ))}
                      <div style={{ width:18, height:18, borderRadius:4, background:"white",
                        boxShadow:"0 0 12px cyan", zIndex:2 }} />
                    </div>
                  ),
                },
                {
                  val: "style8" as SplashStyle,
                  label: isArabic ? "فاخر ذهبي" : "Luxury Intro",
                  desc:  isArabic ? "ستارة حمراء · كشاف · منصة ذهبية · لوغو يصعد · غبار" : "Red curtain · spotlight · gold stage · logo rise · dust",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"#050505",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ position:"absolute", left:0, top:0, width:"30%", height:"100%",
                        background:"linear-gradient(90deg,#400000,#900000)", opacity:0.7 }} />
                      <div style={{ position:"absolute", right:0, top:0, width:"30%", height:"100%",
                        background:"linear-gradient(90deg,#900000,#400000)", opacity:0.7 }} />
                      <div style={{ position:"absolute", top:0, width:40, height:72,
                        background:"linear-gradient(180deg,rgba(255,255,255,.25),transparent)",
                        clipPath:"polygon(40% 0,60% 0,85% 100%,15% 100%)" }} />
                      <div style={{ position:"absolute", bottom:6, width:70, height:8, borderRadius:"50%",
                        background:"linear-gradient(#d4af37,#5b4300)", boxShadow:"0 0 10px gold" }} />
                      <div style={{ width:18, height:18, borderRadius:3, background:"white",
                        boxShadow:"0 0 12px gold", zIndex:2 }} />
                      {[...Array(8)].map((_,i) => (
                        <div key={i} style={{ position:"absolute", width:2, height:2, borderRadius:"50%",
                          background:"gold", boxShadow:"0 0 3px gold",
                          left:`${10+(i*11)%80}%`, top:`${10+(i*17)%70}%` }} />
                      ))}
                    </div>
                  ),
                },
                {
                  val: "style9" as SplashStyle,
                  label: isArabic ? "قطرة ماء" : "Water Drop",
                  desc:  isArabic ? "قطرة تسقط · موجة دائرية · ضوء سيان · لوغو ينبثق" : "Drop falls · ripple wave · cyan glow · logo reveal",
                  preview: (
                    <div style={{ width:"100%", height:72, borderRadius:10, overflow:"hidden", position:"relative",
                      background:"linear-gradient(#07121f,#000)",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {/* ضوء سيان */}
                      <div style={{ position:"absolute", width:60, height:60, borderRadius:"50%",
                        background:"radial-gradient(circle,#00ffff33,transparent)",
                        filter:"blur(8px)", top:0, left:"20%" }} />
                      {/* قطرة */}
                      <div style={{ position:"absolute", top:4, width:22, height:28,
                        background:"linear-gradient(135deg,rgba(255,255,255,.5),rgba(0,255,255,.2))",
                        borderRadius:"50% 50% 55% 55%",
                        boxShadow:"0 0 8px cyan" }} />
                      {/* موجة */}
                      <div style={{ position:"absolute", width:40, height:12, borderRadius:"50%",
                        border:"1.5px solid cyan", opacity:0.6 }} />
                      {/* لوغو */}
                      <div style={{ width:18, height:18, borderRadius:4, background:"white",
                        boxShadow:"0 0 12px cyan", zIndex:2 }} />
                    </div>
                  ),
                },
              ]).map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setSplashStyle(item.val)}
                  className={`flex flex-col rounded-xl border-2 overflow-hidden transition-all text-left ${splashStyle === item.val ? "border-primary" : "border-border hover:border-primary/40"}`}
                >
                  {item.preview}
                  <div className="px-2.5 py-2">
                    <div className={`text-xs font-semibold ${splashStyle === item.val ? "text-primary" : "text-foreground"}`}>{item.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Background gradient picker */}
          <div className="space-y-2">
            <Label className="text-sm">{isArabic ? "خلفية شاشة البداية" : "Splash Background"}</Label>
            <div className="grid grid-cols-4 gap-2">
              {([
                { val: "cosmic",   label: isArabic ? "كوني"  : "Cosmic",   bg: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
                { val: "ocean",    label: isArabic ? "محيطي" : "Ocean",    bg: "linear-gradient(135deg,#0a2342,#1a4a8a,#0d2137)" },
                { val: "forest",   label: isArabic ? "غابة"  : "Forest",   bg: "linear-gradient(135deg,#0a2e1a,#1a5c34,#0a1e12)" },
                { val: "midnight", label: isArabic ? "منتصف الليل" : "Midnight", bg: "linear-gradient(135deg,#0a0a0a,#1a1a2e,#16213e)" },
                { val: "rose",     label: isArabic ? "وردي"  : "Rose",     bg: "linear-gradient(135deg,#1a0a0e,#3d1020,#2a0f1f)" },
                { val: "amber",    label: isArabic ? "عنبري" : "Amber",    bg: "linear-gradient(135deg,#1a0f00,#3d2500,#1a0f00)" },
                { val: "dark",     label: isArabic ? "داكن"  : "Dark",     bg: "linear-gradient(135deg,#050505,#111111,#090909)" },
              ] as { val: SplashBgGradient; label: string; bg: string }[]).map(item => (
                <button
                  key={item.val}
                  onClick={() => setSplashBgGradient(item.val)}
                  className={`flex flex-col gap-1 rounded-xl border-2 overflow-hidden transition-all ${splashBgGradient === item.val ? "border-primary" : "border-border hover:border-primary/40"}`}
                >
                  <div className="w-full h-8" style={{ background: item.bg }} />
                  <span className={`text-[10px] font-medium pb-1 text-center ${splashBgGradient === item.val ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Logo upload */}
          <div className="space-y-2">
            <Label className="text-sm">{isArabic ? "لوغو شاشة البداية" : "Splash Screen Logo"}</Label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                {splashLogoUrl ? (
                  <img src={splashLogoUrl.startsWith("data:") ? splashLogoUrl : (splashLogoUrl.startsWith("/uploads/") ? apiUrl(splashLogoUrl) : splashLogoUrl)} alt="logo" className="w-full h-full object-contain" />
                ) : (
                  <Smartphone className="w-6 h-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <input
                  ref={splashLogoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setSplashLogoUploading(true);
                    try {
                      // Store directly as base64 data URL in localStorage —
                      // logo stays intact regardless of server restarts or any updates.
                      const fileData = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                      // Persist immediately so logo survives page reload even before Save is clicked
                      setSplashLogoUrl(fileData);
                      applySplashLogoUrl(fileData);
                    } catch {
                      toast({ title: isArabic ? "فشل رفع الصورة" : "Upload failed", variant: "destructive" });
                    } finally {
                      setSplashLogoUploading(false);
                      if (splashLogoRef.current) splashLogoRef.current.value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => splashLogoRef.current?.click()}
                  disabled={splashLogoUploading}
                  className="gap-1.5"
                >
                  {splashLogoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {isArabic ? "رفع لوغو" : "Upload Logo"}
                </Button>
                {splashLogoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => setSplashLogoUrl("")}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {isArabic ? "حذف" : "Remove"}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{isArabic ? "يستبدل الأيقونة الافتراضية في شاشة البداية" : "Replaces the default icon in the splash screen"}</p>
          </div>

          {/* App name on splash */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? "اسم البرنامج في الشاشة" : "App Name on Splash"}</Label>
            <div className="flex gap-2">
              <Input
                value={splashAppName}
                onChange={e => setSplashAppName(e.target.value)}
                placeholder={welcomeTitle || "AttendX"}
                className="flex-1"
                maxLength={30}
              />
              {splashAppName && (
                <Button type="button" variant="outline" size="sm" onClick={() => setSplashAppName("")}>
                  {isArabic ? "افتراضي" : "Reset"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isArabic ? "اتركه فارغاً لاستخدام اسم البرنامج العام" : "Leave empty to use the global app name"}
            </p>
          </div>

          {/* Logo size + radius */}
          <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            <p className="text-sm font-medium">{isArabic ? "اللوغو — الحجم والشكل" : "Logo — Size & Shape"}</p>

            {/* Preview box */}
            <div className="flex justify-center">
              <div style={{
                width: Math.min(splashLogoWidth, 120),
                height: Math.min(splashLogoHeight, 120),
                borderRadius: splashLogoRadius,
                background: "white",
                boxShadow: "0 0 20px #00ffff88",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", transition: "all .2s",
              }}>
                {splashLogoUrl ? (
                  <img
                    src={splashLogoUrl.startsWith("data:") ? splashLogoUrl : (splashLogoUrl.startsWith("/uploads/") ? apiUrl(splashLogoUrl) : splashLogoUrl)}
                    alt="preview"
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
                  />
                ) : (
                  <Smartphone className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
            </div>

            {/* Width */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isArabic ? `العرض: ${splashLogoWidth} بكسل` : `Width: ${splashLogoWidth}px`}
              </Label>
              <input type="range" min={40} max={300} step={4}
                value={splashLogoWidth}
                onChange={e => setSplashLogoWidth(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>40px</span><span>300px</span></div>
            </div>

            {/* Height */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isArabic ? `الارتفاع: ${splashLogoHeight} بكسل` : `Height: ${splashLogoHeight}px`}
              </Label>
              <input type="range" min={40} max={300} step={4}
                value={splashLogoHeight}
                onChange={e => setSplashLogoHeight(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>40px</span><span>300px</span></div>
            </div>

            {/* Border radius */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isArabic ? `استدارة الزوايا: ${splashLogoRadius} بكسل` : `Corner Radius: ${splashLogoRadius}px`}
              </Label>
              <input type="range" min={0} max={150} step={2}
                value={splashLogoRadius}
                onChange={e => setSplashLogoRadius(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{isArabic ? "مربع" : "Square"}</span>
                <span>{isArabic ? "دائرة" : "Circle"}</span>
              </div>
            </div>

            {/* Offset X */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isArabic ? `الموضع الأفقي: ${splashLogoOffsetX > 0 ? "+" : ""}${splashLogoOffsetX} بكسل` : `Horizontal Position: ${splashLogoOffsetX > 0 ? "+" : ""}${splashLogoOffsetX}px`}
              </Label>
              <input type="range" min={-200} max={200} step={2}
                value={splashLogoOffsetX}
                onChange={e => setSplashLogoOffsetX(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{isArabic ? "يسار ◀" : "◀ Left"}</span>
                <span>{isArabic ? "▶ يمين" : "Right ▶"}</span>
              </div>
            </div>

            {/* Offset Y */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isArabic ? `الموضع الرأسي: ${splashLogoOffsetY > 0 ? "+" : ""}${splashLogoOffsetY} بكسل` : `Vertical Position: ${splashLogoOffsetY > 0 ? "+" : ""}${splashLogoOffsetY}px`}
              </Label>
              <input type="range" min={-200} max={200} step={2}
                value={splashLogoOffsetY}
                onChange={e => setSplashLogoOffsetY(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{isArabic ? "لأعلى ▲" : "▲ Up"}</span>
                <span>{isArabic ? "▼ لأسفل" : "Down ▼"}</span>
              </div>
            </div>

            {/* Background box size */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {isArabic ? `حجم المربع الخلفي: ${splashLogoBgSize} بكسل` : `Background Box Padding: ${splashLogoBgSize}px`}
              </Label>
              <input type="range" min={0} max={60} step={2}
                value={splashLogoBgSize}
                onChange={e => setSplashLogoBgSize(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{isArabic ? "بلا مربع" : "No box"}</span>
                <span>{isArabic ? "كبير" : "Large"}</span>
              </div>
            </div>

            <Button type="button" variant="outline" size="sm"
              onClick={() => { setSplashLogoWidth(100); setSplashLogoHeight(100); setSplashLogoRadius(40); setSplashLogoOffsetX(0); setSplashLogoOffsetY(0); setSplashLogoBgSize(15); }}
            >
              {isArabic ? "إعادة تعيين" : "Reset to default"}
            </Button>
          </div>

          {/* Tagline */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? "النص السفلي (Tagline)" : "Bottom Tagline"}</Label>
            <div className="flex gap-2">
              <Input
                value={splashTagline}
                onChange={e => setSplashTagline(e.target.value)}
                placeholder="Powered by AttendX © 2025"
                className="flex-1"
                maxLength={80}
              />
              {splashTagline && (
                <Button variant="outline" size="sm" onClick={() => setSplashTagline("")}>{isArabic ? "افتراضي" : "Reset"}</Button>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label className="text-xs">{isArabic ? `مدة الظهور: ${splashDuration} ثانية` : `Display Duration: ${splashDuration}s`}</Label>
            <input
              type="range" min={3} max={15} step={1}
              value={splashDuration}
              onChange={e => setSplashDuration(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{isArabic ? "3 ث" : "3s"}</span>
              <span>{isArabic ? "15 ث" : "15s"}</span>
            </div>
          </div>

          {/* Stars / Particles toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{isArabic ? "النجوم المتلألئة" : "Twinkling Stars"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "نجوم تتلألأ في الخلفية" : "Stars twinkling in the background"}</p>
              </div>
              <Toggle enabled={splashShowStars} onChange={setSplashShowStars} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{isArabic ? "الجسيمات المتطايرة" : "Floating Particles"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "جسيمات ملونة تطفو عند الظهور" : "Coloured particles floating on load"}</p>
              </div>
              <Toggle enabled={splashShowParticles} onChange={setSplashShowParticles} />
            </div>
          </div>

          {/* Reset splash key */}
          <div className="pt-1">
            <Button
              variant="outline" size="sm"
              className="w-full gap-1.5 text-muted-foreground"
              onClick={() => {
                try { sessionStorage.removeItem("attendx_splash_v2"); } catch {}
                toast({ title: isArabic ? "سيتم عرض الشاشة مجدداً عند التحديث" : "Splash will show again on next reload" });
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isArabic ? "معاينة الشاشة عند التحديث" : "Preview on Next Reload"}
            </Button>
          </div>
        </Section>}

        {/* ── 8. Biometric ── */}
        <Section
          id="biometric" open={isOpen("biometric")} onToggle={() => toggleSection("biometric")}
          icon={<Fingerprint className="w-4 h-4" />}
          title={t("biometric_settings")}
          accent="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("biometric_enabled")}</p>
              <p className="text-xs text-muted-foreground">{t("biometric_desc")}</p>
            </div>
            <Toggle enabled={biometricEnabled} onChange={v => { setBiometricEnabled(v); }} />
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
            <p>• Fingerprint sensor</p>
            <p>• Face ID / Face Recognition</p>
            <p>• PIN fallback</p>
          </div>
        </Section>

        {/* ── 9. GPS & Location ── */}
        <Section
          id="gps" open={isOpen("gps")} onToggle={() => toggleSection("gps")}
          icon={<Navigation className="w-4 h-4" />}
          title={isArabic ? t("gps_locations_settings") : "GPS & Location"}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        >
          {/* GPS toggle — admin/manager only */}
          {isAdmin && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t("gps_enabled")}</p>
                <p className="text-xs text-muted-foreground">{t("gps_desc")}</p>
              </div>
              <Toggle enabled={gpsEnabled} onChange={v => setGpsEnabled(v)} />
            </div>
          )}
          {/* النطاق المسموح — admin/manager فقط يقدرون يغيرونه */}
          {gpsEnabled && isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-sm">{t("gps_radius")} (m)</Label>
              <Input type="number" min={50} max={50000} value={gpsRadius} onChange={e => setGpsRadius(e.target.value)} className="w-40" />
            </div>
          )}
          {gpsEnabled && !isAdmin && (
            <p className="text-xs text-muted-foreground">
              {isArabic ? `النطاق المسموح: ${gpsRadius} م (يضبطه مدير النظام)` : `Allowed radius: ${gpsRadius} m (set by admin)`}
            </p>
          )}
          {/* Location search — admin/manager only */}
          {isAdmin && (
            <div className="border-t border-border pt-3">
              <GpsLocationSearch isArabic={isArabic} />
            </div>
          )}
        </Section>

        {/* ── Photo Documentation Toggle ── */}
        <Section
          id="photo" open={isOpen("photo")} onToggle={() => toggleSection("photo")}
          icon={<Camera className="w-4 h-4" />}
          title={isArabic ? t("work_photo_documentation") : "Photo Documentation"}
          accent="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {isArabic ? t("enable_photo_documentation") : "Enable Photo Documentation"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isArabic
                  ? t("enabled_mandatory_photo")
                  : "When enabled, a photo is required before each check-in"}
              </p>
            </div>
            <Toggle
              enabled={photoDocEnabled}
              onChange={v => {
                setPhotoDocEnabled(v);
                /* Persisted on Save — not immediately */
              }}
            />
          </div>
          {photoDocEnabled ? (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/20 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
              <Camera className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {isArabic ? t("documentation_enabled") : "Documentation enabled"}
                </p>
                <p className="opacity-75 mt-0.5">
                  {isArabic
                    ? t("camera_auto_open_desc")
                    : "Camera will open automatically when you tap the check-in button"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-1">
              {isArabic
                ? t("disabled_direct_checkin")
                : "When disabled, check-in works directly without a photo"}
            </p>
          )}

          {/* Delete all own work reports */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium mb-1 text-muted-foreground">
              {isArabic ? t("manage_records") : "Manage Records"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={async () => {
                if (!confirm(isArabic ? t("confirm_delete_all_work_docs") : "Delete all your work documentation records?")) return;
                try {
                  const res = await authFetch("/api/work-reports/mine", { method: "DELETE" });
                  if (res.ok) toast({ title: isArabic ? t("all_records_deleted") : "✅ All records deleted" });
                  else throw new Error();
                } catch {
                  toast({ title: isArabic ? t("delete_failed") : "Delete failed", variant: "destructive" });
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isArabic ? t("delete_daily_doc_record") : "Delete all documentation records"}
            </Button>
          </div>
        </Section>

        {/* ── 10. API Keys & Integrations ── */}
        {(isAdminOnly || (me?.role === "manager" && managerApiAccess)) && (
          <Section
            id="api_keys" open={isOpen("api_keys")} onToggle={() => toggleSection("api_keys")}
            icon={<KeyRound className="w-4 h-4" />}
            title={isArabic ? "🔑 مفاتيح API والتكاملات" : "🔑 API Keys & Integrations"}
            accent="bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400"
            badge={
              (currentKeyInfo?.hasKey || brevoConfigured || resendConfigured || clConfigured || vapidConfigured)
                ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">✓ {isArabic ? "مفعّل" : "Active"}</span>
                : undefined
            }
          >
            <p className="text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
              🔒 {isArabic ? "هذه المفاتيح مخصصة لمدير النظام فقط — لا تظهر للموظفين." : "These keys are for system admin only — hidden from all employees."}
            </p>

            {/* ── Manager access toggle (admin-only control) ── */}
            {isAdminOnly && (
              <div className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    {isArabic ? "السماح لمدير الشركة برؤية هذا القسم" : "Allow company managers to view this section"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isArabic
                      ? managerApiAccess ? "✅ مدير الشركة يستطيع رؤية المفاتيح حالياً" : "🔒 مدير الشركة لا يرى هذا القسم حالياً"
                      : managerApiAccess ? "✅ Company managers can currently view the keys" : "🔒 Company managers cannot view this section"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={managerApiAccessSaving}
                  onClick={async () => {
                    setManagerApiAccessSaving(true);
                    try {
                      const next = !managerApiAccess;
                      const res = await authFetch("/api/settings/integrations/manager-api-access", {
                        method: "POST",
                        body: JSON.stringify({ allowed: next }),
                      });
                      if (res.ok) {
                        setManagerApiAccess(next);
                        toast({ title: isArabic
                          ? next ? "✅ تم السماح لمدير الشركة" : "🔒 تم إلغاء صلاحية المدير"
                          : next ? "✅ Manager access enabled" : "🔒 Manager access disabled"
                        });
                      }
                    } finally { setManagerApiAccessSaving(false); }
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${managerApiAccess ? "bg-primary" : "bg-muted-foreground/30"} ${managerApiAccessSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${managerApiAccess ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            )}

            {/* ── 1. Gemini AI ── */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                🤖 {isArabic ? "مفتاح Gemini AI" : "Gemini AI Key"}
                {currentKeyInfo?.hasKey && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">✓ {isArabic ? "مفعّل" : "Active"}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{t("api_config_desc")}</p>
              {currentKeyInfo && (
                <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm ${currentKeyInfo.hasKey ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-muted border border-border"}`}>
                  <div className="flex items-center gap-2">
                    {currentKeyInfo.hasKey ? <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div>
                      <p className={`font-medium text-xs ${currentKeyInfo.hasKey ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                        {currentKeyInfo.hasKey ? t("key_already_configured") : t("key_not_configured")}
                      </p>
                      {currentKeyInfo.maskedKey && <p className="text-xs text-muted-foreground font-mono mt-0.5">{currentKeyInfo.maskedKey}</p>}
                    </div>
                  </div>
                  {currentKeyInfo.hasKey && <Button variant="ghost" size="sm" className="text-destructive text-xs h-7" onClick={handleRemoveKey}>{t("remove")}</Button>}
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("gemini_api_key")}</Label>
                <div className="relative">
                  <Input type="text" value={apiKey} onChange={e => { setApiKey(e.target.value); setKeyStatus("idle"); setKeyError(""); }}
                    placeholder={t("gemini_api_key_placeholder")} className="pe-9 font-mono text-sm"
                    autoComplete="off" spellCheck={false}
                    style={showKey ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties} />
                  <button type="button" onClick={() => setShowKey(v => !v)} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {keyStatus === "valid" && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {isArabic ? t("key_verified_saved") : "Key verified and saved"}</p>}
                {keyStatus === "verifying" && <p className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {isArabic ? t("checking_gemini_connection") : "Testing Gemini connection…"}</p>}
                {keyStatus === "invalid" && <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {keyError || (isArabic ? t("key_invalid2") : "Invalid key")}</p>}
                <Button onClick={handleSaveKey} disabled={!apiKey.trim() || isSavingKey} className="gap-2 w-full">
                  {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {isArabic ? t("test_and_save_key") : "Test Connection & Save Key"}
                </Button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* ── 2. Email (Brevo + Resend) ── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {isArabic ? "البريد الإلكتروني" : "Email"}
                {(brevoConfigured || resendConfigured) && (
                  <span className="text-[10px] bg-green-500/15 text-green-600 border border-green-500/30 rounded-full px-2 py-0.5 font-medium">{isArabic ? "مُفعَّل" : "Active"}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {isArabic ? "أرسل تقارير الراتب والإشعارات للموظفين تلقائياً." : "Send payroll reports and notifications to employees automatically."}
              </p>

              {/* Brevo */}
              <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-base">✉️</span>
                    {isArabic ? "Brevo — الأفضل لـ Render ⭐" : "Brevo — Best for Render ⭐"}
                  </p>
                  {brevoConfigured && (
                    <span className="text-[10px] bg-green-500/15 text-green-600 border border-green-500/30 rounded-full px-2 py-0.5 font-medium">
                      {isArabic ? "مُفعَّل" : "Active"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? "مجاني (300 إيميل/يوم) · لا يحتاج دومين · يرسل لأي إيميل · يعمل على Render بدون قيود."
                    : "Free (300 emails/day) · No domain needed · Sends to any email · Works on Render without restrictions."}
                </p>
                <div className="bg-green-100/70 dark:bg-green-900/30 rounded-lg px-3 py-2 text-xs text-green-800 dark:text-green-300 space-y-0.5">
                  <p className="font-semibold">📌 {isArabic ? "كيف تحصل على مفتاح Brevo؟" : "How to get a Brevo API key?"}</p>
                  <p>{isArabic ? "1. افتح brevo.com وسجّل حساباً مجانياً" : "1. Go to brevo.com and sign up free"}</p>
                  <p>{isArabic ? "2. اذهب إلى: SMTP & API ← API Keys" : "2. Go to: SMTP & API → API Keys"}</p>
                  <p>{isArabic ? "3. اضغط Generate a new API key وانسخه هنا" : '3. Click "Generate a new API key" and paste it here'}</p>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{isArabic ? "مفتاح API" : "API Key"}</Label>
                    <div className="flex gap-2">
                      <Input
                        type={brevoShowKey ? "text" : "password"}
                        placeholder={brevoConfigured ? (isArabic ? "•••• المفتاح محفوظ — الصق مفتاحاً جديداً للتغيير ••••" : "•••• Key saved — paste new key to change ••••") : "xkeysib-..."}
                        value={brevoKey}
                        onChange={e => setBrevoKey(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        dir="ltr"
                      />
                      <Button variant="outline" size="sm" onClick={() => setBrevoShowKey(v => !v)}>
                        {brevoShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{isArabic ? "إيميل المُرسِل (اختياري)" : "Sender Email (optional)"}</Label>
                    <Input
                      type="email"
                      placeholder={isArabic ? "مثال: noreply@شركتك.com — أو اتركه فارغاً" : "e.g. noreply@yourcompany.com — or leave blank"}
                      value={brevoFrom}
                      onChange={e => setBrevoFrom(e.target.value)}
                      className="text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
                {brevoTestResult && (
                  <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${brevoTestResult.ok ? "bg-green-50 dark:bg-green-950/30 border-green-200 text-green-700 dark:text-green-300" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
                    {brevoTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    <span>{brevoTestResult.ok
                      ? (isArabic ? "✅ تم إرسال بريد اختباري! تحقق من صندوق الوارد." : "✅ Test email sent! Check your inbox.")
                      : (brevoTestResult.error ?? "Error")}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5 flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={brevoSaving || !brevoKey.trim()} onClick={handleBrevoSave}>
                    {brevoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isArabic ? "حفظ المفتاح" : "Save Key"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={brevoTesting || !brevoConfigured} onClick={handleBrevoTest}>
                    {brevoTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                    {isArabic ? "اختبار" : "Test"}
                  </Button>
                  {brevoConfigured && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleBrevoClear}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {isArabic ? "حذف" : "Clear"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Resend */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    {isArabic ? "Resend (مُوصى به)" : "Resend (Recommended)"}
                  </p>
                  {resendConfigured && (
                    <span className="text-[10px] bg-green-500/15 text-green-600 border border-green-500/30 rounded-full px-2 py-0.5 font-medium">
                      {isArabic ? "مُفعَّل" : "Active"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? "يعمل على جميع خوادم الاستضافة بدون قيود. مجاني حتى 3000 إيميل/شهر."
                    : "Works on all hosting providers without restrictions. Free up to 3,000 emails/month."}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{isArabic ? "مفتاح API" : "API Key"}</Label>
                  <div className="flex gap-2">
                    <Input
                      type={resendShowKey ? "text" : "password"}
                      placeholder={resendConfigured ? (isArabic ? "•••• المفتاح محفوظ — الصق مفتاحاً جديداً للتغيير ••••" : "•••• Key saved — paste new key to change ••••") : "re_xxxxxxxxxxxxxxxxxxxx"}
                      value={resendKey}
                      onChange={e => setResendKey(e.target.value)}
                      className="flex-1 font-mono text-sm"
                      dir="ltr"
                    />
                    <Button variant="outline" size="sm" onClick={() => setResendShowKey(v => !v)}>
                      {resendShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {resendTestResult && (
                  <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${resendTestResult.ok ? "bg-green-50 dark:bg-green-950/30 border-green-200 text-green-700 dark:text-green-300" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
                    {resendTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                    <span>{resendTestResult.ok
                      ? (isArabic ? "✅ تم إرسال بريد اختباري! تحقق من صندوق الوارد." : "✅ Test email sent! Check your inbox.")
                      : (resendTestResult.error ?? "Error")}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5 flex-1" disabled={resendSaving || !resendKey.trim()} onClick={handleResendSave}>
                    {resendSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isArabic ? "حفظ المفتاح" : "Save Key"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={resendTesting || !resendConfigured} onClick={handleResendTest}>
                    {resendTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
                    {isArabic ? "اختبار" : "Test"}
                  </Button>
                  {resendConfigured && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleResendClear}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {isArabic ? "حذف" : "Clear"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* ── 3. Cloudinary ── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                🖼️ {isArabic ? "رفع الصور (Cloudinary)" : "Image Upload (Cloudinary)"}
                {clConfigured && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">✓ {isArabic ? "مفعّل" : "Active"}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{isArabic ? "مفاتيح Cloudinary لرفع صور الموظفين والشعار. احصل عليها من لوحة Cloudinary." : "Cloudinary keys for uploading employee photos and logos. Get them from the Cloudinary dashboard."}</p>
              {clConfigured && (
                <div className="space-y-1 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800 text-xs font-mono text-muted-foreground">
                  {clMasked.cloudName  && <p><span className="text-foreground font-semibold not-italic">Cloud Name: </span>{clMasked.cloudName}</p>}
                  {clMasked.apiKey     && <p><span className="text-foreground font-semibold not-italic">API Key: </span>{clMasked.apiKey}</p>}
                  {clMasked.apiSecret  && <p><span className="text-foreground font-semibold not-italic">API Secret: </span>{clMasked.apiSecret}</p>}
                </div>
              )}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">{isArabic ? "اسم السحابة" : "Cloud Name"}</Label>
                  <Input value={clCloudName} onChange={e => setClCloudName(e.target.value)} placeholder="e.g. z1mf87qo" className="font-mono text-sm" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isArabic ? "مفتاح API" : "API Key"}</Label>
                  <Input value={clApiKey} onChange={e => setClApiKey(e.target.value)} placeholder="e.g. 748697499718614" className="font-mono text-sm" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isArabic ? "سر API" : "API Secret"}</Label>
                  <div className="relative">
                    <Input value={clApiSecret} onChange={e => setClApiSecret(e.target.value)} placeholder="••••••••" className="font-mono text-sm pe-9" autoComplete="off"
                      style={showClSecret ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties} />
                    <button type="button" onClick={() => setShowClSecret(v => !v)} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showClSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 gap-1.5" disabled={!clCloudName.trim() || !clApiKey.trim() || !clApiSecret.trim() || clSaving} onClick={async () => {
                    setClSaving(true);
                    try {
                      const res = await authFetch("/api/settings/integrations/cloudinary", { method: "POST", body: JSON.stringify({ cloudName: clCloudName.trim(), apiKey: clApiKey.trim(), apiSecret: clApiSecret.trim() }) });
                      if (res.ok) {
                        setClConfigured(true); setClCloudName(""); setClApiKey(""); setClApiSecret("");
                        toast({ title: isArabic ? "✅ تم حفظ مفاتيح Cloudinary" : "✅ Cloudinary keys saved" });
                      }
                    } finally { setClSaving(false); }
                  }}>
                    {clSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isArabic ? "حفظ" : "Save"}
                  </Button>
                  {clConfigured && (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={async () => {
                      await authFetch("/api/settings/integrations/cloudinary", { method: "DELETE" });
                      setClConfigured(false); setClMasked({ cloudName: null, apiKey: null, apiSecret: null });
                      toast({ title: isArabic ? "تم حذف مفاتيح Cloudinary" : "Cloudinary keys removed" });
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* ── 4. VAPID ── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                🔔 {isArabic ? "الإشعارات الفورية (VAPID)" : "Push Notifications (VAPID)"}
                {vapidConfigured && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">✓ {isArabic ? "مفعّل" : "Active"}</span>}
              </p>
              <p className="text-xs text-muted-foreground">{isArabic ? "مفاتيح VAPID لإرسال الإشعارات الفورية للموظفين. يمكن توليدها عبر web-push." : "VAPID keys for sending push notifications. Generate them via web-push or vapidkeys.com."}</p>
              {vapidConfigured && (
                <div className="space-y-1 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-800 text-xs font-mono text-muted-foreground">
                  {vapidMasked.publicKey  && <p><span className="text-foreground font-semibold not-italic">Public Key: </span>{vapidMasked.publicKey}</p>}
                  {vapidMasked.privateKey && <p><span className="text-foreground font-semibold not-italic">Private Key: </span>{vapidMasked.privateKey}</p>}
                  {vapidMasked.email      && <p><span className="text-foreground font-semibold not-italic">Email: </span>{vapidMasked.email}</p>}
                </div>
              )}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">{isArabic ? "المفتاح العام" : "Public Key"}</Label>
                  <Input value={vapidPub} onChange={e => setVapidPub(e.target.value)} placeholder="BNt..." className="font-mono text-sm" autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isArabic ? "المفتاح الخاص" : "Private Key"}</Label>
                  <div className="relative">
                    <Input value={vapidPriv} onChange={e => setVapidPriv(e.target.value)} placeholder="••••••••" className="font-mono text-sm pe-9" autoComplete="off"
                      style={showVapidPriv ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties} />
                    <button type="button" onClick={() => setShowVapidPriv(v => !v)} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showVapidPriv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email {isArabic ? "(اختياري)" : "(optional)"}</Label>
                  <Input value={vapidEmail} onChange={e => setVapidEmail(e.target.value)} placeholder="mailto:admin@example.com" className="font-mono text-sm" autoComplete="off" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1 gap-1.5" disabled={!vapidPub.trim() || !vapidPriv.trim() || vapidSaving} onClick={async () => {
                    setVapidSaving(true);
                    try {
                      const res = await authFetch("/api/settings/integrations/vapid", { method: "POST", body: JSON.stringify({ publicKey: vapidPub.trim(), privateKey: vapidPriv.trim(), email: vapidEmail.trim() || undefined }) });
                      if (res.ok) {
                        setVapidConfigured(true); setVapidPub(""); setVapidPriv("");
                        toast({ title: isArabic ? "✅ تم حفظ مفاتيح VAPID" : "✅ VAPID keys saved" });
                      }
                    } finally { setVapidSaving(false); }
                  }}>
                    {vapidSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isArabic ? "حفظ" : "Save"}
                  </Button>
                  {vapidConfigured && (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={async () => {
                      await authFetch("/api/settings/integrations/vapid", { method: "DELETE" });
                      setVapidConfigured(false); setVapidMasked({ publicKey: null, privateKey: null, email: null });
                      toast({ title: isArabic ? "تم حذف مفاتيح VAPID" : "VAPID keys removed" });
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

          </Section>
        )}

        {/* ── 11. النسخ الاحتياطي (admin فقط — المدير لا يراه) ── */}
        {isAdminOnly && (
        <Section
          id="backup" open={isOpen("backup")} onToggle={() => toggleSection("backup")}
          icon={<Database className="w-4 h-4" />}
          title={isArabic ? "النسخ الاحتياطي" : "Data Backup"}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        >
          <BackupSection isArabic={isArabic} />
        </Section>
        )}

        {/* ── 11b. مسح السجل (admin فقط) ── */}
        {isAdminOnly && (
        <Section
          id="clear-records" open={isOpen("clear-records")} onToggle={() => toggleSection("clear-records")}
          icon={<Trash2 className="w-4 h-4" />}
          title={isArabic ? "مسح السجل" : "Clear Records"}
          accent="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          <p className="text-xs text-muted-foreground mb-3">
            {isArabic
              ? "احذف بيانات محددة من سجلات الموظفين بشكل دائم. هذا الإجراء لا يمكن التراجع عنه."
              : "Permanently delete selected employee record types. This action cannot be undone."}
          </p>
          <ClearRecordsDialog isArabic={isArabic} />
        </Section>
        )}

        {/* ── 12. Login Page (admin) ── */}
        {isAdmin && (
          <Section
            id="login" open={isOpen("login")} onToggle={() => toggleSection("login")}
            icon={<LogIn className="w-4 h-4" />}
            title={isArabic ? t("customize_login_page") : "Login Page"}
            accent="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
          >
            <div className="space-y-2">
              <Label className="text-sm">{isArabic ? t("login_page_background") : "Login Background"}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "default",         label: isArabic ? t("default_option") : "Default",  cls: "bg-background border" },
                  { val: "gradient-blue",   label: isArabic ? t("color_blue") : "Blue",        cls: "bg-gradient-to-br from-blue-100 to-indigo-200" },
                  { val: "gradient-purple", label: isArabic ? t("theme_purple") : "Purple",    cls: "bg-gradient-to-br from-purple-100 to-violet-200" },
                  { val: "gradient-green",  label: isArabic ? t("color_green") : "Green",       cls: "bg-gradient-to-br from-emerald-100 to-teal-200" },
                  { val: "gradient-warm",   label: isArabic ? t("style_warm") : "Warm",        cls: "bg-gradient-to-br from-orange-100 to-rose-200" },
                  { val: "gradient-ocean",  label: isArabic ? t("theme_ocean") : "Ocean",      cls: "bg-gradient-to-br from-cyan-100 to-teal-200" },
                  { val: "gradient-forest", label: isArabic ? t("theme_forest") : "Forest",    cls: "bg-gradient-to-br from-green-100 to-emerald-300" },
                  { val: "gradient-rose",   label: isArabic ? t("theme_pink") : "Rose",        cls: "bg-gradient-to-br from-rose-100 to-pink-200" },
                  { val: "gradient-sunset", label: isArabic ? t("theme_sunset") : "Sunset",    cls: "bg-gradient-to-br from-orange-200 via-rose-200 to-purple-200" },
                  { val: "gradient-gold",   label: isArabic ? t("theme_gold") : "Gold",        cls: "bg-gradient-to-br from-yellow-100 to-amber-300" },
                  { val: "gradient-ruby",   label: isArabic ? t("theme_ruby") : "Ruby",        cls: "bg-gradient-to-br from-red-200 to-rose-400" },
                  { val: "gradient-slate",  label: isArabic ? t("color_gray") : "Slate",       cls: "bg-gradient-to-br from-slate-700 to-slate-900" },
                  { val: "gradient-aurora",       label: isArabic ? "أورورا"        : "Aurora",      cls: "bg-gradient-to-br from-indigo-200 via-purple-200 to-pink-200" },
                   { val: "gradient-deep-purple", label: isArabic ? "بنفسجي غامق"   : "Deep Purple", cls: "bg-gradient-to-br from-violet-950 via-purple-900 to-indigo-950" },
                   { val: "gradient-midnight",    label: isArabic ? "منتصف الليل"   : "Midnight",    cls: "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900" },
                   { val: "gradient-night-sky",   label: isArabic ? "سماء الليل"    : "Night Sky",   cls: "bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950" },
                   { val: "gradient-crimson",     label: isArabic ? "قرمزي"         : "Crimson",     cls: "bg-gradient-to-br from-rose-900 via-red-950 to-rose-950" },
                   { val: "gradient-teal",        label: isArabic ? "فيروزي"        : "Teal",        cls: "bg-gradient-to-br from-teal-100 to-cyan-200" },
                   { val: "gradient-lavender",    label: isArabic ? "لافندر"        : "Lavender",    cls: "bg-gradient-to-br from-purple-100 via-violet-100 to-fuchsia-200" },
                ].map(({ val, label, cls }) => (
                  <button key={val} onClick={() => saveLoginBgStyle(val)}
                    className={cn("h-12 rounded-lg border-2 transition-all text-xs font-medium", cls,
                      loginBgStyle === val ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
                    )}>
                    {loginBgStyle === val && <CheckCircle2 className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />}
                    <span className="text-foreground/80">{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{isArabic ? t("custom_secondary_text") : "Custom Subtitle"}</Label>
              <Input value={loginSubtitle} onChange={e => setLoginSubtitleState(e.target.value)} placeholder={isArabic ? t("example_app_name") : "e.g. Attendance Management System..."} />
              <p className="text-xs text-muted-foreground">{isArabic ? t("leave_empty_default") : "Leave empty for default"}</p>
            </div>
            <div className="border-t border-border pt-3">
              <Label className="text-sm flex items-center gap-1.5"><SendHorizonal className="w-3.5 h-3.5" /> {isArabic ? t("daily_summary") : "Daily Summary"}</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">{isArabic ? t("send_attendance_report_desc") : "Send attendance report to each employee"}</p>
              <Button variant="outline" onClick={sendDailySummary} disabled={dailySummarySending} className="gap-2">
                {dailySummarySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                {isArabic ? t("send_summary_now") : "Send Summary Now"}
              </Button>
            </div>
          </Section>
        )}

        {/* ── 13. Change Password ── */}
        <Section
          id="password" open={isOpen("password")} onToggle={() => toggleSection("password")}
          icon={<Lock className="w-4 h-4" />}
          title={t("change_password")}
          accent="bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400"
        >
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("current_password")}</Label>
              <Input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("new_password")}</Label>
              <Input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required minLength={6} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("confirm_password")}</Label>
              <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
            </div>
            <Button type="submit" disabled={changePasswordMut.isPending} className="gap-2">
              {changePasswordMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("update_password")}
            </Button>
          </form>
        </Section>

        {/* ══════════════════════════════════════════════════════
            MASTER SAVE BUTTON
        ══════════════════════════════════════════════════════ */}
        <div className="sticky bottom-4 mt-6">
          <button
            onClick={handleSaveAll}
            disabled={globalSaving}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-base transition-all shadow-xl",
              "bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground",
              "hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99]",
              "disabled:opacity-70 disabled:cursor-not-allowed"
            )}
          >
            {globalSaving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {isArabic ? t("saving2") : "Saving..."}</>
            ) : (
              <><Save className="w-5 h-5" /> {isArabic ? t("save_settings2") : "Save Settings"}</>
            )}
          </button>
        </div>

      </div>
    </Layout>
  );
}
