import Layout from "@/components/Layout";
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
  Paintbrush, SendHorizonal, Save, Navigation, Search, Camera, Trash2, Smartphone,
} from "lucide-react";
import type { AiButtonIcon, AiButtonShape, AiButtonColor } from "@/hooks/use-settings";
import ClockWidget from "@/components/ClockWidget";
import {
  getDailyRemindersEnabled, setDailyRemindersEnabled,
  requestNotificationPermission, getNotificationPermission,
  scheduleDailyReminders, cancelDailyReminders, sendTestNotification,
} from "@/lib/notifications";
import {
  getAlarmSettings, saveAlarmSettings, scheduleShiftAlarms,
  cancelShiftAlarms, playAlarmSound, type ShiftAlarmSettings,
} from "@/lib/alarm";
import type { AssistantPersonality } from "@/hooks/use-settings";
import { authFetch } from "@/lib/api-url";

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
    <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
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

const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
  </button>
);

/* ─────────────────────────────────────────────────────────────
   GPS Location Map Component
───────────────────────────────────────────────────────────── */
function GpsLocationSearch({ isArabic }: { isArabic: boolean }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ lat: string; lon: string; display_name: string } | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResult(null); setError(""); return; }
    setSearching(true); setError(""); setResult(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { "Accept-Language": isArabic ? "ar" : "en" } }
      );
      const data = await res.json();
      if (data.length > 0) {
        setResult({ lat: data[0].lat, lon: data[0].lon, display_name: data[0].display_name });
      } else {
        setError(isArabic ? "لم يُعثر على الموقع" : "Location not found");
      }
    } catch {
      setError(isArabic ? "فشل الاتصال" : "Connection failed");
    } finally {
      setSearching(false);
    }
  }, [isArabic]);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 700);
  };

  const mapSrc = result
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(result.lon)-0.02},${parseFloat(result.lat)-0.02},${parseFloat(result.lon)+0.02},${parseFloat(result.lat)+0.02}&layer=mapnik&marker=${result.lat},${result.lon}`
    : null;

  return (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-1.5 mb-1.5">
          <Search className="w-3.5 h-3.5" />
          {isArabic ? "ابحث عن موقع جغرافي" : "Search for a location"}
        </Label>
        <div className="relative">
          <Input
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={isArabic ? "مثال: الرياض، برج خليفة، مطار الملك..." : "e.g. Dubai, Eiffel Tower, London..."}
          />
          {searching && (
            <Loader2 className="absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 px-3 py-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-xs">
            <MapPin className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-300 line-clamp-2">{result.display_name}</p>
              <p className="text-green-600/70 dark:text-green-400/70 font-mono mt-0.5">
                {parseFloat(result.lat).toFixed(5)}, {parseFloat(result.lon).toFixed(5)}
              </p>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }}>
            <iframe
              title="map"
              src={mapSrc!}
              width="100%"
              height="220"
              style={{ border: 0 }}
              loading="lazy"
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>
          </p>
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
  const {
    theme, fontSize, language, ttsEnabled, wakeWord, assistantName, assistantPersonality,
    aiButtonIcon, aiButtonShape, aiButtonColor, aiButtonCustomColor,
    setTheme, setFontSize, setLanguage, setTtsEnabled, setWakeWord, setAssistantName, setAssistantPersonality,
    setAiButtonIcon, setAiButtonShape, setAiButtonColor, setAiButtonCustomColor,
    clockFormat, clockLocale, clockStyle, clockSize, floatingClockEnabled, floatingClockCheckIn,
    setClockFormat, setClockLocale, setClockStyle, setClockSize, setFloatingClockEnabled, setFloatingClockCheckIn,
    sidebarStyle, cardStyle, tableStyle, accentColor,
    setSidebarStyle, setCardStyle, setTableStyle, setAccentColor,
  } = useSettings();

  const AI_PREVIEW_COLORS: Record<string, string> = {
    primary: "hsl(var(--primary))", violet: "#7c3aed", rose: "#e11d48",
    amber: "#d97706", emerald: "#059669", sky: "#0284c7",
    slate: "#475569", black: "#18181b", white: "#f8fafc", custom: aiButtonCustomColor,
  };
  const { data: me, refetch: refetchMe } = useGetMe();
  const {
    appName, appLogo, logoWidth, logoHeight, logoRotation, logoOffsetX, logoOffsetY,
    setAppName, setAppLogo, setLogoWidth, setLogoHeight, setLogoRotation, setLogoOffsetX, setLogoOffsetY,
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
        toast({ title: isArabic ? "لم يتم منح إذن الإشعارات" : "Notification permission denied", variant: "destructive" });
        return;
      }
      setDailyRemindersEnabled(true); setRemindersEnabledState(true);
      scheduleDailyReminders((localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "en");
      toast({ title: isArabic ? "✅ التذكيرات مفعّلة" : "✅ Reminders enabled" });
    } else {
      setDailyRemindersEnabled(false); setRemindersEnabledState(false);
      cancelDailyReminders();
      toast({ title: isArabic ? "🔕 التذكيرات موقوفة" : "🔕 Reminders disabled" });
    }
  };

  /* ── Biometric / GPS / Photo ── */
  const [biometricEnabled, setBiometricEnabled] = useState(() => localStorage.getItem("setting_biometric") !== "false");
  const [gpsEnabled, setGpsEnabled] = useState(() => localStorage.getItem("setting_gps") !== "false");
  const [gpsRadius, setGpsRadius] = useState(() => localStorage.getItem("setting_gps_radius") ?? "200");
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

  /* ── Work Schedule ── */
  const [workStartTime, setWorkStartTime] = useState("09:00");
  const [lateGraceMinutes, setLateGraceMinutes] = useState(15);

  /* ── Login customization ── */
  const [loginBgStyle, setLoginBgStyleState] = useState(() => localStorage.getItem("login_bg_style") || "default");
  const [loginSubtitle, setLoginSubtitleState] = useState(() => localStorage.getItem("login_custom_subtitle") || "");
  const [dailySummarySending, setDailySummarySending] = useState(false);

  /* ── Alarm ── */
  const [alarmSettings, setAlarmSettingsState] = useState<ShiftAlarmSettings>(() => getAlarmSettings());
  const [pushStatus, setPushStatus] = useState<"idle" | "subscribing" | "subscribed" | "error">("idle");
  const [pushErrorMsg, setPushErrorMsg] = useState("");

  /* Subscribe this device to server-sent push notifications for the alarm */
  const subscribeToPush = useCallback(async (settings: ShiftAlarmSettings) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("error");
      setPushErrorMsg(isArabic ? "المتصفح لا يدعم الإشعارات في الخلفية" : "This browser does not support background push notifications");
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
          ? "تم رفض إذن الإشعارات. فعّله من إعدادات المتصفح للموقع ثم أعد المحاولة."
          : "Notification permission was denied. Enable it in the browser's site settings and try again.");
        return;
      }

      const vapidRes = await authFetch("/api/push/vapid-key");
      const vapidData = await vapidRes.json().catch(() => ({}));
      const publicKey = vapidData?.publicKey;
      if (!publicKey) {
        setPushStatus("error");
        setPushErrorMsg(isArabic
          ? "الخادم غير مهيأ لإرسال إشعارات (مفتاح VAPID مفقود). تواصل مع المسؤول."
          : "The server is not configured for push notifications (missing VAPID key). Contact your administrator.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await authFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: sub.toJSON(),
          enabled:   settings.enabled,
          startTime: settings.startTime,
          endTime:   settings.endTime,
        }),
      });
      setPushStatus("subscribed");
    } catch (err: any) {
      setPushStatus("error");
      setPushErrorMsg(
        err?.name === "NotAllowedError"
          ? (isArabic ? "تم رفض إذن الإشعارات من المتصفح." : "Notification permission was denied by the browser.")
          : (isArabic ? "فشل الاشتراك. تأكد من السماح بالإشعارات." : "Subscription failed. Please allow notifications.")
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

  /* ── Global saving ── */
  const [globalSaving, setGlobalSaving] = useState(false);

  const isAdmin = me?.role === "admin";

  useEffect(() => {
    setAdminForm({ appName, username: me?.name ?? "", email: me?.email ?? "" });
  }, [appName, me?.name, me?.email]);

  useEffect(() => {
    if (!isAdmin) return;
    authFetch("/api/settings/app").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.workStartTime) setWorkStartTime(data.workStartTime);
      if (data?.lateGraceMinutes != null) setLateGraceMinutes(data.lateGraceMinutes);
    }).catch(() => {});
  }, [isAdmin]);

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
  const handleSettings = async (field: "theme" | "fontSize" | "language", value: string) => {
    if (field === "theme") setTheme(value as any);
    if (field === "fontSize") setFontSize(value as any);
    if (field === "language") setLanguage(value as any);
    try {
      await updateSettingsMut.mutateAsync({ data: { [field]: value } as any });
      qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    } catch { toast({ title: "Could not save setting", variant: "destructive" }); }
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
        toast({ title: isArabic ? "✅ تم التحقق وحفظ المفتاح" : "✅ Key verified and saved" });
      } else {
        const REASON_MAP: Record<string, string> = {
          unauthorized: isArabic ? "المفتاح غير مصرح به أو منتهي الصلاحية" : "Key is unauthorized or expired",
          invalid_key:  isArabic ? "المفتاح غير صحيح" : "Invalid API key",
          bad_request:  isArabic ? "طلب غير صحيح" : "Bad request",
        };
        const reason = data?.reason ?? "";
        const friendly = REASON_MAP[reason] || reason || (isArabic ? "غير صالح" : "Invalid key");
        setKeyStatus("invalid"); setKeyError(friendly);
      }
    } catch {
      setKeyStatus("invalid"); setKeyError(isArabic ? "فشل الاتصال" : "Could not reach server");
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
        toast({ title: isArabic ? "✅ تم التحقق وحفظ المفتاح بنجاح" : "✅ Key verified and saved successfully" });
      } else {
        const REASON_MAP: Record<string, string> = {
          unauthorized:       isArabic ? "المفتاح غير مصرح به أو منتهي الصلاحية" : "Key unauthorized or expired",
          invalid_key:        isArabic ? "المفتاح غير صحيح" : "Invalid API key",
          bad_request:        isArabic ? "طلب غير صحيح" : "Bad request",
          INVALID_ARGUMENT:   isArabic ? "المفتاح غير صالح أو التنسيق خاطئ" : "Invalid key or format",
          API_KEY_INVALID:    isArabic ? "مفتاح API غير صالح" : "API key is invalid",
          PERMISSION_DENIED:  isArabic ? "الوصول مرفوض – تحقق من صلاحيات المفتاح" : "Permission denied – check key permissions",
          RESOURCE_EXHAUSTED: isArabic ? "تم استنفاد الحصة – المفتاح صالح لكن الحصة منتهية" : "Quota exhausted – key is valid but quota exceeded",
        };
        const rawReason = data?.reason ?? "";
        const reason = rawReason.length > 80 ? rawReason.slice(0, 80) + "..." : rawReason;
        const friendly = REASON_MAP[reason] || REASON_MAP[rawReason] || reason || (isArabic ? "فشل التحقق من المفتاح" : "Key verification failed");
        setKeyStatus("invalid"); setKeyError(friendly);
        toast({ title: isArabic ? `❌ ${friendly}` : `❌ ${friendly}`, variant: "destructive" });
      }
    } catch {
      setKeyStatus("invalid"); setKeyError(isArabic ? "فشل الاتصال بالخادم" : "Could not reach server");
      toast({ title: isArabic ? "❌ فشل الاتصال بالخادم" : "❌ Could not reach server", variant: "destructive" });
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
    a.href = url; a.download = `attendx_backup_${new Date().toISOString().split("T")[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("export_data") + " ✓" });
  };

  const saveLoginBgStyle = (val: string) => {
    setLoginBgStyleState(val); localStorage.setItem("login_bg_style", val);
  };

  const sendDailySummary = async () => {
    setDailySummarySending(true);
    try {
      const res = await authFetch("/api/attendance/daily-summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل");
      toast({ title: `✅ تم الإرسال لـ ${data.sent} موظف` });
    } catch (err: any) {
      toast({ title: "فشل الإرسال", description: err.message, variant: "destructive" });
    } finally { setDailySummarySending(false); }
  };

  /* ── Master Save All ── */
  const handleSaveAll = async () => {
    setGlobalSaving(true);
    const tasks: Promise<any>[] = [];

    // Save alarm
    saveAlarmSettings(alarmSettings);
    const lang = (localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "ar";
    if (alarmSettings.enabled) scheduleShiftAlarms(alarmSettings, lang); else cancelShiftAlarms();

    // Save logo transform (only applied globally on Save)
    setLogoWidth(logoW);
    setLogoHeight(logoH);
    setLogoRotation(logoRot);
    setLogoOffsetX(logoOX);
    setLogoOffsetY(logoOY);

    // Save GPS radius
    localStorage.setItem("setting_gps", String(gpsEnabled));
    localStorage.setItem("setting_biometric", String(biometricEnabled));
    localStorage.setItem("setting_gps_radius", gpsRadius);
    localStorage.setItem("photo_doc_enabled", String(photoDocEnabled));

    // Save login subtitle
    localStorage.setItem("login_custom_subtitle", loginSubtitle);

    if (isAdmin) {
      // Save work schedule
      tasks.push(
        authFetch("/api/settings/app", {
          method: "PATCH",
          body: JSON.stringify({ workStartTime, lateGraceMinutes }),
        }).catch(() => {})
      );

      // Save admin profile if changed
      const nameChanged = adminForm.username.trim() !== (me?.name ?? "");
      const emailChanged = adminForm.email.trim() !== (me?.email ?? "");
      if (!isValidEmail(adminForm.email)) { setEmailError(t("invalid_email")); setGlobalSaving(false); return; }
      setEmailError("");

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
      toast({ title: isArabic ? "✅ تم حفظ جميع الإعدادات" : "✅ All settings saved" });
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
      <div className="space-y-3 max-w-xl pb-8">

        {/* Page Title */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{t("settings")}</h1>
          <p className="text-sm text-muted-foreground">{isArabic ? "انقر على أي قسم للتوسيع" : "Tap a section to expand"}</p>
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
              <Label>{isArabic ? "شعار التطبيق" : "App Logo"}</Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border-2 border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain" /> : <AppWindow className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex gap-2 flex-wrap">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 500_000) { toast({ title: isArabic ? "الحجم > 500KB" : "Max 500KB", variant: "destructive" }); return; }
                          const reader = new FileReader();
                          reader.onload = ev => setLogoPreview(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted cursor-pointer">
                        <Database className="w-3.5 h-3.5" /> {isArabic ? "اختر صورة" : "Choose Image"}
                      </span>
                    </label>
                    {logoPreview && (
                      <button onClick={() => setLogoPreview("")} className="px-3 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10">
                        {isArabic ? "إزالة" : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP — {isArabic ? "أقصى 500KB" : "max 500KB"}</p>
                </div>
              </div>
              {logoPreview !== appLogo && (
                <button disabled={logoSaving} onClick={async () => {
                  setLogoSaving(true);
                  try {
                    const r = await authFetch("/api/settings/app", { method: "PATCH", body: JSON.stringify({ appLogo: logoPreview }) });
                    const d = await r.json();
                    setAppLogo(d.appLogo ?? ""); setLogoPreview(d.appLogo ?? "");
                    toast({ title: isArabic ? "تم حفظ الشعار" : "Logo saved" });
                  } catch { toast({ title: t("failed"), variant: "destructive" }); }
                  finally { setLogoSaving(false); }
                }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60">
                  {logoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                  {isArabic ? "حفظ الشعار" : "Save Logo"}
                </button>
              )}

              {/* Logo Size Controls */}
              <div className="space-y-3 pt-1">
                <Label className="text-xs font-medium text-muted-foreground">{isArabic ? "حجم الشعار في صفحة الدخول" : "Logo size on login page"}</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? "العرض" : "Width"}</Label>
                      <span className="text-xs font-mono text-primary">{logoW}px</span>
                    </div>
                    <input
                      type="range" min={24} max={300} step={4}
                      value={logoW}
                      onChange={e => { const v = Number(e.target.value); setLogoW(v); }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? "الارتفاع" : "Height"}</Label>
                      <span className="text-xs font-mono text-primary">{logoH}px</span>
                    </div>
                    <input
                      type="range" min={24} max={300} step={4}
                      value={logoH}
                      onChange={e => { const v = Number(e.target.value); setLogoH(v); }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{isArabic ? "عرض (px)" : "W (px)"}</Label>
                      <Input
                        type="number" min={24} max={300}
                        value={logoW}
                        onChange={e => { const v = Math.max(24, Math.min(300, Number(e.target.value))); setLogoW(v); }}
                        className="w-20 h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{isArabic ? "ارتفاع (px)" : "H (px)"}</Label>
                      <Input
                        type="number" min={24} max={300}
                        value={logoH}
                        onChange={e => { const v = Math.max(24, Math.min(300, Number(e.target.value))); setLogoH(v); }}
                        className="w-20 h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div
                    className="rounded-xl bg-primary/10 overflow-hidden flex items-center justify-center border border-border flex-shrink-0"
                    style={{ width: Math.min(logoW, 120), height: Math.min(logoH, 120), maxWidth: 120, maxHeight: 120 }}
                    title={isArabic ? "معاينة" : "Preview"}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ transform: `translate(${logoOX * 0.4}px, ${logoOY * 0.4}px) rotate(${logoRot}deg)` }}
                    >
                      {logoPreview
                        ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain" />
                        : <span className="text-[10px] text-muted-foreground">{logoW}×{logoH}</span>
                      }
                    </div>
                  </div>
                </div>

                {/* Free rotation + position controls */}
                <Label className="text-xs font-medium text-muted-foreground pt-2 block">
                  {isArabic ? "التحكم الحر بالاتجاه والموضع" : "Free rotation & position control"}
                </Label>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{isArabic ? "الدوران" : "Rotation"}</Label>
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
                      <Label className="text-xs">{isArabic ? "أفقي" : "Horizontal"}</Label>
                      <span className="text-xs font-mono text-primary">{logoOX}px</span>
                    </div>
                    <input
                      type="range" min={-100} max={100} step={1}
                      value={logoOX}
                      onChange={e => { const v = Number(e.target.value); setLogoOX(v); }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{isArabic ? "عمودي" : "Vertical"}</Label>
                      <span className="text-xs font-mono text-primary">{logoOY}px</span>
                    </div>
                    <input
                      type="range" min={-100} max={100} step={1}
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
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {isArabic ? "إعادة تعيين الكل" : "Reset all"}
                </button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Work Schedule */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium"><Clock className="w-3.5 h-3.5" /> {isArabic ? "جدول الدوام" : "Work Schedule"}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? "وقت البداية (UTC)" : "Start Time (UTC)"}</Label>
                  <Input type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? "فترة السماح (دقيقة)" : "Grace Period (min)"}</Label>
                  <Input type="number" min={0} max={120} value={lateGraceMinutes} onChange={e => setLateGraceMinutes(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))} className="font-mono" />
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                {isArabic ? (
                  <span>يُعد متأخراً بعد: <strong className="font-mono text-primary">{(() => { const [hh, mm] = workStartTime.split(":").map(Number); const t = hh * 60 + mm + lateGraceMinutes; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })()} UTC</strong></span>
                ) : (
                  <span>Late after: <strong className="font-mono text-primary">{(() => { const [hh, mm] = workStartTime.split(":").map(Number); const t = hh * 60 + mm + lateGraceMinutes; return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; })()} UTC</strong></span>
                )}
              </div>
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
            <Label className="flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> {isArabic ? "المظهر" : "Theme"}</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "light",  label: isArabic ? "فاتح"   : "Light",  icon: <Sun className="w-4 h-4 text-yellow-500" />,  bg: "bg-white border-gray-200" },
                { value: "dark",   label: isArabic ? "داكن"   : "Dark",   icon: <Moon className="w-4 h-4 text-slate-400" />,  bg: "bg-gray-900 border-gray-700" },
                { value: "system", label: isArabic ? "تلقائي" : "Auto",   icon: <Monitor className="w-4 h-4 text-blue-400" />,bg: "bg-gradient-to-br from-white to-gray-700 border-gray-400" },
                { value: "ocean",  label: isArabic ? "المحيط" : "Ocean",  dot: "bg-teal-500",   bg: "bg-teal-50 border-teal-200" },
                { value: "forest", label: isArabic ? "الغابة" : "Forest", dot: "bg-green-600",  bg: "bg-green-50 border-green-200" },
                { value: "rose",   label: isArabic ? "وردي"   : "Rose",   dot: "bg-rose-500",   bg: "bg-rose-50 border-rose-200" },
                { value: "sunset", label: isArabic ? "غروب"   : "Sunset", dot: "bg-orange-500", bg: "bg-orange-50 border-orange-200" },
                { value: "purple", label: isArabic ? "بنفسجي" : "Purple", dot: "bg-purple-600", bg: "bg-purple-50 border-purple-200" },
                { value: "gold",   label: isArabic ? "ذهبي"   : "Gold",   dot: "bg-yellow-500", bg: "bg-yellow-50 border-yellow-200" },
                { value: "ruby",   label: isArabic ? "ياقوت"  : "Ruby",   dot: "bg-red-600",    bg: "bg-red-50 border-red-200" },
                { value: "slate",  label: isArabic ? "رمادي"  : "Slate",  dot: "bg-slate-500",  bg: "bg-slate-100 border-slate-300" },
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

          {/* ── Interface Layout ── */}
          <div className="border-t border-border pt-3 space-y-4">
            <Label className="flex items-center gap-1.5 text-xs font-semibold">
              <Paintbrush className="w-3.5 h-3.5" /> {isArabic ? "تخصيص الواجهة" : "Interface Customization"}
            </Label>

            {/* ── Live Preview ── */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? "معاينة مباشرة" : "Live Preview"}</Label>
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
              <Label className="text-xs text-muted-foreground">{isArabic ? "شكل القائمة الجانبية" : "Sidebar Style"}</Label>
              <Select value={sidebarStyle} onValueChange={v => setSidebarStyle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{isArabic ? "عادي — عرض متوازن" : "Default — Balanced width"}</SelectItem>
                  <SelectItem value="compact">{isArabic ? "مضغوط — أقل مساحة" : "Compact — Less space"}</SelectItem>
                  <SelectItem value="icon-only">{isArabic ? "أيقونات فقط — أقصى مساحة" : "Icons only — Max space"}</SelectItem>
                  <SelectItem value="wide">{isArabic ? "واسع — مع التسميات" : "Wide — With full labels"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Card Style Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? "شكل البطاقات" : "Card Style"}</Label>
              <Select value={cardStyle} onValueChange={v => setCardStyle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">{isArabic ? "منحنية — زوايا ناعمة" : "Rounded — Soft corners"}</SelectItem>
                  <SelectItem value="sharp">{isArabic ? "حادة — خطوط مستقيمة" : "Sharp — Straight edges"}</SelectItem>
                  <SelectItem value="glass">{isArabic ? "زجاجية — شفافية وضبابية" : "Glass — Frosted effect"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table Style Dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{isArabic ? "شكل الجداول" : "Table Style"}</Label>
              <Select value={tableStyle} onValueChange={v => setTableStyle(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">{isArabic ? "مريح — صفوف عالية" : "Comfortable — Tall rows"}</SelectItem>
                  <SelectItem value="cozy">{isArabic ? "دافئ — صفوف متوسطة" : "Cozy — Medium rows"}</SelectItem>
                  <SelectItem value="compact">{isArabic ? "مضغوط — صفوف قصيرة" : "Compact — Dense rows"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Accent Color ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{isArabic ? "لون التمييز" : "Accent Color"}</Label>
                {accentColor && (
                  <button
                    onClick={() => { setAccentColor(""); document.documentElement.style.removeProperty("--primary"); document.documentElement.style.removeProperty("--ring"); document.documentElement.style.removeProperty("--sidebar-primary"); }}
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> {isArabic ? "إعادة" : "Reset"}
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
                <label className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/50 hover:border-primary cursor-pointer flex-shrink-0 hover:scale-110 transition-all" title={isArabic ? "لون مخصص" : "Custom color"}>
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
              { code: "ar", flag: "🇸🇦", label: "العربية",  native: "Arabic" },
              { code: "en", flag: "🇬🇧", label: "English",  native: "English" },
              { code: "sv", flag: "🇸🇪", label: "Svenska",  native: "Swedish" },
              { code: "fr", flag: "🇫🇷", label: "Français", native: "French" },
              { code: "de", flag: "🇩🇪", label: "Deutsch",  native: "German" },
              { code: "es", flag: "🇪🇸", label: "Español",  native: "Spanish" },
              { code: "tr", flag: "🇹🇷", label: "Türkçe",   native: "Turkish" },
              { code: "ur", flag: "🇵🇰", label: "اردو",     native: "Urdu" },
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
          title={isArabic ? "إعدادات الساعة" : "Clock Settings"}
          accent="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        >
          {/* Live preview */}
          <div className="flex justify-center items-center min-h-[120px] rounded-xl bg-muted/40 border border-border overflow-hidden">
            <ClockWidget />
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isArabic ? "نمط الساعة" : "Format"}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["12h", "24h"] as const).map(fmt => (
                <button key={fmt} onClick={() => setClockFormat(fmt)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${clockFormat === fmt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {fmt === "12h" ? (isArabic ? "12 ساعة" : "12h AM/PM") : (isArabic ? "24 ساعة" : "24h")}
                </button>
              ))}
            </div>
          </div>

          {/* Locale */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{isArabic ? "لغة الوقت" : "Time Locale"}</Label>
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
            <Label className="text-xs text-muted-foreground">{isArabic ? "شكل الساعة" : "Clock Style"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "digital",  icon: "🔢", labelAr: "رقمي",       labelEn: "Digital"   },
                { val: "boxed",    icon: "⬛", labelAr: "مربعات",     labelEn: "Boxed"     },
                { val: "neon",     icon: "🌈", labelAr: "نيون",       labelEn: "Neon"      },
                { val: "neontube", icon: "💡", labelAr: "أنبوب نيون", labelEn: "Tube"      },
                { val: "retro",    icon: "🖥️", labelAr: "ريترو",      labelEn: "Retro"     },
                { val: "gradient", icon: "✨", labelAr: "تدرج",       labelEn: "Gradient"  },
                { val: "glass",    icon: "🪟", labelAr: "زجاجي",      labelEn: "Glass"     },
                { val: "flip",     icon: "🃏", labelAr: "قلّاب",      labelEn: "Flip"      },
                { val: "analog",   icon: "🕐", labelAr: "تناظري",     labelEn: "Analog"    },
                { val: "minimal",  icon: "✦",  labelAr: "بسيط",       labelEn: "Minimal"   },
                { val: "aurora",   icon: "🌌", labelAr: "أورورا",     labelEn: "Aurora"    },
                { val: "matrix",   icon: "🟩", labelAr: "ماتريكس",    labelEn: "Matrix"    },
                { val: "neonring", icon: "🔵", labelAr: "حلقة نيون",  labelEn: "Neon Ring" },
                { val: "wave",     icon: "🌊", labelAr: "موجي",       labelEn: "Wave"      },
                { val: "calendar", icon: "📅", labelAr: "تقويم",      labelEn: "Calendar"  },
                { val: "pixel",    icon: "👾", labelAr: "بكسل",       labelEn: "Pixel"     },
                { val: "sunburst", icon: "☀️", labelAr: "أشعة شمس",   labelEn: "Sunburst"  },
                { val: "holographic", icon: "🔮", labelAr: "هولوغرام", labelEn: "Holographic" },
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
            <Label className="text-xs text-muted-foreground">{isArabic ? "حجم الساعة" : "Clock Size"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "small", labelAr: "صغير", labelEn: "Small", icon: <Minimize2 className="w-3 h-3" /> },
                { val: "medium", labelAr: "متوسط", labelEn: "Medium", icon: <AlignCenter className="w-3.5 h-3.5" /> },
                { val: "large", labelAr: "كبير", labelEn: "Large", icon: <Maximize2 className="w-4 h-4" /> },
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
                <p className="text-sm font-medium">{isArabic ? "الساعة العائمة" : "Floating Clock"}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "ساعة قابلة للسحب على كل الصفحات" : "Draggable clock on all pages"}</p>
              </div>
              <Toggle enabled={floatingClockEnabled} onChange={v => { setFloatingClockEnabled(v); toast({ title: v ? "✅ الساعة مفعّلة" : "🔕 الساعة مخفية" }); }} />
            </div>
            {floatingClockEnabled && (
              <div className="flex items-center justify-between gap-4 ps-4 border-s-2 border-primary/20">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1"><LogIn className="w-3.5 h-3.5 text-green-500" /> {isArabic ? "تسجيل سريع" : "Quick Check-in"}</p>
                  <p className="text-xs text-muted-foreground">{isArabic ? "زر تسجيل داخل الساعة" : "Check-in button in the clock"}</p>
                </div>
                <Toggle enabled={floatingClockCheckIn} onChange={v => { setFloatingClockCheckIn(v); toast({ title: v ? "✅ تسجيل سريع مفعّل" : "🔕 تسجيل سريع معطّل" }); }} />
              </div>
            )}
          </div>
        </Section>

        {/* ── 4. AI Assistant ── */}
        <Section
          id="ai" open={isOpen("ai")} onToggle={() => toggleSection("ai")}
          icon={<Bot className="w-4 h-4" />}
          title={isArabic ? "تخصيص المساعد الذكي" : "AI Assistant"}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        >
          {/* Assistant Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? "اسم المساعد" : "Assistant Name"}</Label>
            <div className="flex gap-2">
              <Input value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder="مساعدي، أتندي..." className="flex-1" maxLength={30} />
              <Button variant="outline" size="sm" onClick={() => { setAssistantName("مساعدي"); toast({ title: "تم إعادة الضبط" }); }}>{isArabic ? "افتراضي" : "Reset"}</Button>
            </div>
          </div>

          {/* Personality */}
          <div className="space-y-1.5">
            <Label className="text-sm">{isArabic ? "شخصية المساعد" : "Personality"}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "friendly", label: "ودود", icon: "😊" },
                { value: "professional", label: "احترافي", icon: "💼" },
                { value: "concise", label: "مختصر", icon: "⚡" },
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
            <Label className="text-sm">{isArabic ? "كلمة التنشيط" : "Wake Word"}</Label>
            <div className="flex gap-2">
              <Input value={wakeWord} onChange={e => setWakeWord(e.target.value)} placeholder='مثال: مساعد، أتندكس...' className="flex-1" maxLength={30} />
              <Button variant="outline" size="sm" onClick={() => { setWakeWord("مساعد"); toast({ title: 'تمت إعادة الضبط' }); }}>{isArabic ? "افتراضي" : "Reset"}</Button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Button Appearance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{isArabic ? "شكل الزر العائم" : "Floating Button"}</Label>
              <button onClick={() => { setAiButtonIcon("bot"); setAiButtonShape("circle"); setAiButtonColor("primary"); setAiButtonCustomColor("#6366f1"); toast({ title: "تم إعادة الضبط" }); }}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> {isArabic ? "إعادة" : "Reset"}
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
                {aiButtonIcon === "bot" && <Bot className="w-6 h-6" />}
                {aiButtonIcon === "sparkles" && <Sparkles className="w-6 h-6" />}
                {aiButtonIcon === "brain" && <Brain className="w-6 h-6" />}
                {aiButtonIcon === "zap" && <Zap className="w-6 h-6" />}
                {aiButtonIcon === "star" && <Star className="w-6 h-6" />}
                {aiButtonIcon === "heart" && <Heart className="w-6 h-6" />}
                {aiButtonIcon === "message" && <MessageCircle className="w-6 h-6" />}
                {aiButtonIcon === "cpu" && <Cpu className="w-6 h-6" />}
                {aiButtonIcon === "wand" && <Wand2 className="w-6 h-6" />}
                {aiButtonIcon === "rocket" && <Rocket className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-sm font-medium">{isArabic ? "معاينة مباشرة" : "Live Preview"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? "يظهر هكذا في كل الصفحات" : "Appears like this on all pages"}</p>
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? "الأيقونة" : "Icon"}</p>
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

            {/* Shape Picker — 7 shapes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? "شكل الزر" : "Button Shape"}</p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { val: "circle",   labelAr: "دائري",     labelEn: "Circle",   preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full bg-primary/40" /> },
                  { val: "rounded",  labelAr: "مدوّر",     labelEn: "Rounded",  preview: "rounded-2xl",   demo: <div className="w-6 h-6 rounded-2xl bg-primary/40" /> },
                  { val: "square",   labelAr: "مربع",      labelEn: "Square",   preview: "rounded-lg",    demo: <div className="w-6 h-6 rounded-lg bg-primary/40" /> },
                  { val: "gradient", labelAr: "تدرج",      labelEn: "Gradient", preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full" style={{ background: "linear-gradient(135deg,hsl(var(--primary)),#7c3aed)" }} /> },
                  { val: "neon",     labelAr: "نيون",      labelEn: "Neon",     preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full border-2 border-primary" style={{ boxShadow: "0 0 8px hsl(var(--primary))" }} /> },
                  { val: "glass",    labelAr: "زجاجي",     labelEn: "Glass",    preview: "rounded-2xl",   demo: <div className="w-6 h-6 rounded-2xl bg-primary/20 border border-primary/40" /> },
                  { val: "ring",     labelAr: "حلقة",      labelEn: "Ring",     preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full border-3 border-primary" style={{ border: "3px solid hsl(var(--primary))" }} /> },
                ] as { val: AiButtonShape; labelAr: string; labelEn: string; preview: string; demo: React.ReactNode }[]).map(opt => (
                  <button key={opt.val} onClick={() => { setAiButtonShape(opt.val); toast({ title: isArabic ? opt.labelAr : opt.labelEn }); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 text-xs transition-all",
                      aiButtonShape === opt.val ? "border-primary bg-primary/10 text-primary scale-105" : "border-border text-muted-foreground hover:border-primary/40"
                    )}>
                    {opt.demo}
                    <span className="text-[9px]">{isArabic ? opt.labelAr : opt.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? "لون الزر" : "Button Color"}</p>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { val: "primary", labelAr: "الرئيسي", labelEn: "Primary", swatch: "hsl(var(--primary))" },
                  { val: "violet",  labelAr: "بنفسجي",  labelEn: "Violet",  swatch: "#7c3aed" },
                  { val: "rose",    labelAr: "وردي",     labelEn: "Rose",    swatch: "#e11d48" },
                  { val: "amber",   labelAr: "كهرماني",  labelEn: "Amber",   swatch: "#d97706" },
                  { val: "emerald", labelAr: "زمردي",    labelEn: "Emerald", swatch: "#059669" },
                  { val: "sky",     labelAr: "سماوي",    labelEn: "Sky",     swatch: "#0284c7" },
                  { val: "slate",   labelAr: "رمادي",    labelEn: "Slate",   swatch: "#475569" },
                  { val: "black",   labelAr: "أسود",     labelEn: "Black",   swatch: "#18181b" },
                  { val: "white",   labelAr: "أبيض",     labelEn: "White",   swatch: "#f8fafc" },
                  { val: "custom",  labelAr: "مخصص",     labelEn: "Custom",  swatch: aiButtonCustomColor },
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
                    <p className="text-xs font-medium">{isArabic ? "لون مخصص" : "Custom Color"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{aiButtonCustomColor}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ── 5. Voice / TTS ── */}
        <Section
          id="voice" open={isOpen("voice")} onToggle={() => toggleSection("voice")}
          icon={ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          title={t("voice_narrator") ?? "الناطق الصوتي"}
          accent="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("tts_enabled") ?? "الناطق الصوتي"}</p>
              <p className="text-xs text-muted-foreground">{t("tts_desc") ?? "يقرأ ردود المساعد والإشعارات"}</p>
            </div>
            <Toggle enabled={ttsEnabled} onChange={v => { setTtsEnabled(v); toast({ title: v ? "✅ الصوت مفعّل" : "🔇 الصوت معطّل" }); }} />
          </div>
          {ttsEnabled && (
            <button onClick={() => {
              if (!("speechSynthesis" in window)) { toast({ title: "❌ غير مدعوم", variant: "destructive" }); return; }
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(isArabic ? "الناطق الصوتي يعمل" : "Voice narrator is working");
              u.lang = isArabic ? "ar-SA" : "en-US"; u.rate = 0.95;
              window.speechSynthesis.speak(u);
              toast({ title: isArabic ? "🔊 جارٍ التشغيل..." : "🔊 Playing..." });
            }} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 w-full justify-center">
              <Play className="w-3.5 h-3.5" /> {isArabic ? "تجربة الصوت" : "Test Voice"}
            </button>
          )}
        </Section>

        {/* ── 6. Notifications ── */}
        <Section
          id="notif" open={isOpen("notif")} onToggle={() => toggleSection("notif")}
          icon={<BellRing className="w-4 h-4" />}
          title={isArabic ? "تفضيلات الإشعارات" : "Notifications"}
          accent="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        >
          {notifPermission === "denied" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <BellOff className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{isArabic ? "الإشعارات محظورة — افتح إعدادات المتصفح وأذن لهذا الموقع" : "Notifications blocked — allow in browser settings"}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isArabic ? "تذكيرات الحضور اليومية" : "Daily Reminders"}</p>
              <p className="text-xs text-muted-foreground">{isArabic ? "7:00 صباحاً و 4:00 مساءً" : "At 07:00 (check-in) and 16:00 (check-out)"}</p>
            </div>
            <Toggle enabled={remindersEnabled} onChange={handleToggleReminders} />
          </div>
          {remindersEnabled && notifPermission === "granted" && (
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={async () => {
              await sendTestNotification((localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "en");
              toast({ title: isArabic ? "✅ إشعار تجريبي أُرسل" : "✅ Test notification sent" });
            }}>
              <Bell className="w-4 h-4" /> {isArabic ? "إشعار تجريبي" : "Test notification"}
            </Button>
          )}
        </Section>

        {/* ── 7. Shift Alarm ── */}
        <Section
          id="alarm" open={isOpen("alarm")} onToggle={() => toggleSection("alarm")}
          icon={<Bell className="w-4 h-4" />}
          title={isArabic ? "منبّه بدء وانتهاء الدوام" : "Shift Alarm"}
          accent="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{isArabic ? "تفعيل المنبّه" : "Enable Alarm"}</p>
              <p className="text-xs text-muted-foreground">{isArabic ? "صوت عند بدء وانتهاء الدوام" : "Sound at shift start and end"}</p>
            </div>
            <Switch checked={alarmSettings.enabled} onCheckedChange={async v => {
              setAlarmSettingsState(s => ({ ...s, enabled: v }));
              if (v && "Notification" in window && Notification.permission === "default") {
                await Notification.requestPermission();
              }
            }} />
          </div>
          {alarmSettings.enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">{isArabic ? "بدء الدوام" : "Start"}</Label>
                  <Input type="time" value={alarmSettings.startTime} onChange={e => setAlarmSettingsState(s => ({ ...s, startTime: e.target.value }))} />
                </div>
                <div className="space-y-1"><Label className="text-xs">{isArabic ? "انتهاء الدوام" : "End"}</Label>
                  <Input type="time" value={alarmSettings.endTime} onChange={e => setAlarmSettingsState(s => ({ ...s, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "نوع الصوت" : "Sound"}</Label>
                <Select value={alarmSettings.soundType} onValueChange={v => setAlarmSettingsState(s => ({ ...s, soundType: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bell">{isArabic ? "جرس 🔔" : "Bell 🔔"}</SelectItem>
                    <SelectItem value="beep">{isArabic ? "صفارة 📟" : "Beep 📟"}</SelectItem>
                    <SelectItem value="chime">{isArabic ? "نغمة 🎵" : "Chime 🎵"}</SelectItem>
                    <SelectItem value="horn">{isArabic ? "بوق 📯" : "Horn 📯"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "مستوى الصوت" : "Volume"} ({Math.round(alarmSettings.volume * 100)}%)</Label>
                <input type="range" min="0.1" max="1" step="0.1" value={alarmSettings.volume}
                  onChange={e => setAlarmSettingsState(s => ({ ...s, volume: parseFloat(e.target.value) }))} className="w-full accent-primary mt-1" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
                try {
                  await playAlarmSound(alarmSettings.soundType, alarmSettings.volume);
                  toast({ title: isArabic ? "✅ تم تشغيل الصوت" : "✅ Sound played successfully" });
                } catch {
                  toast({ title: isArabic ? "❌ فشل تشغيل الصوت - تأكد من عدم كتم الصوت" : "❌ Sound failed - check volume", variant: "destructive" });
                }
              }}>
                <Volume2 className="w-3.5 h-3.5" /> {isArabic ? "اختبار الصوت" : "Test Sound"}
              </Button>

              {/* Push notification subscription for locked-screen alarm */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  {isArabic ? "المنبه عند قفل الشاشة" : "Alarm while screen is locked"}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {isArabic
                    ? "اشترك لتلقي إشعار من الخادم حتى عند إقفال الشاشة"
                    : "Subscribe to receive a server push notification even when the screen is locked"}
                </p>
                {pushStatus === "subscribed" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {isArabic ? "الجهاز مشترك في إشعارات المنبه" : "Device subscribed to alarm push"}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={unsubscribeFromPush}>
                      {isArabic ? "إلغاء" : "Unsubscribe"}
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
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isArabic ? "جارٍ الاشتراك..." : "Subscribing..."}</>
                    ) : (
                      <><Bell className="w-3.5 h-3.5" />{isArabic ? "تفعيل المنبه عند قفل الشاشة" : "Enable locked-screen alarm"}</>
                    )}
                  </Button>
                )}
                {pushStatus === "error" && (
                  <p className="text-xs text-destructive mt-1">
                    {pushErrorMsg || (isArabic ? "فشل الاشتراك. تأكد من السماح بالإشعارات." : "Subscription failed. Please allow notifications.")}
                  </p>
                )}
              </div>
            </div>
          )}
        </Section>

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
          title={isArabic ? "إعدادات GPS والمواقع" : "GPS & Location"}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("gps_enabled")}</p>
              <p className="text-xs text-muted-foreground">{t("gps_desc")}</p>
            </div>
            <Toggle enabled={gpsEnabled} onChange={v => setGpsEnabled(v)} />
          </div>
          {gpsEnabled && (
            <div className="space-y-1.5">
              <Label className="text-sm">{t("gps_radius")} (m)</Label>
              <Input type="number" min={50} max={5000} value={gpsRadius} onChange={e => setGpsRadius(e.target.value)} className="w-40" />
            </div>
          )}
          <div className="border-t border-border pt-3">
            <GpsLocationSearch isArabic={isArabic} />
          </div>
        </Section>

        {/* ── Photo Documentation Toggle ── */}
        <Section
          id="photo" open={isOpen("photo")} onToggle={() => toggleSection("photo")}
          icon={<Camera className="w-4 h-4" />}
          title={isArabic ? "توثيق العمل بالصور" : "Photo Documentation"}
          accent="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {isArabic ? "تفعيل توثيق الصور" : "Enable Photo Documentation"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isArabic
                  ? "عند التفعيل، يُطلب منك التقاط صورة إجبارية قبل كل تسجيل حضور"
                  : "When enabled, a photo is required before each check-in"}
              </p>
            </div>
            <Toggle
              enabled={photoDocEnabled}
              onChange={v => {
                setPhotoDocEnabled(v);
                localStorage.setItem("photo_doc_enabled", String(v));
              }}
            />
          </div>
          {photoDocEnabled ? (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/20 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
              <Camera className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {isArabic ? "التوثيق مفعّل" : "Documentation enabled"}
                </p>
                <p className="opacity-75 mt-0.5">
                  {isArabic
                    ? "ستظهر نافذة الكاميرا تلقائياً عند الضغط على زر تسجيل الحضور"
                    : "Camera will open automatically when you tap the check-in button"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-1">
              {isArabic
                ? "عند الإيقاف، يتم تسجيل الحضور مباشرة بدون صورة"
                : "When disabled, check-in works directly without a photo"}
            </p>
          )}

          {/* Delete all own work reports */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium mb-1 text-muted-foreground">
              {isArabic ? "إدارة السجلات" : "Manage Records"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={async () => {
                if (!confirm(isArabic ? "هل أنت متأكد من حذف جميع سجلات توثيق العمل الخاصة بك؟" : "Delete all your work documentation records?")) return;
                try {
                  const res = await authFetch("/api/work-reports/mine", { method: "DELETE" });
                  if (res.ok) toast({ title: isArabic ? "✅ تم حذف جميع السجلات" : "✅ All records deleted" });
                  else throw new Error();
                } catch {
                  toast({ title: isArabic ? "فشل الحذف" : "Delete failed", variant: "destructive" });
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isArabic ? "حذف سجل التوثيق اليومي" : "Delete all documentation records"}
            </Button>
          </div>
        </Section>

        {/* ── 10. API Config (admin) ── */}
        {isAdmin && (
          <Section
            id="api" open={isOpen("api")} onToggle={() => toggleSection("api")}
            icon={<KeyRound className="w-4 h-4" />}
            title={t("api_configuration")}
            accent="bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400"
          >
            <p className="text-sm text-muted-foreground">{t("api_config_desc")}</p>
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
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input type="text" value={apiKey} onChange={e => { setApiKey(e.target.value); setKeyStatus("idle"); setKeyError(""); }}
                    placeholder={t("gemini_api_key_placeholder")} className="pe-9 font-mono text-sm"
                    autoComplete="off" spellCheck={false}
                    style={showKey ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties} />
                  <button type="button" onClick={() => setShowKey(v => !v)} className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {keyStatus === "valid" && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {isArabic ? "تم التحقق من المفتاح وحفظه" : "Key verified and saved"}</p>}
              {keyStatus === "verifying" && <p className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {isArabic ? "جاري التحقق من الاتصال بـ Gemini…" : "Testing Gemini connection…"}</p>}
              {keyStatus === "invalid" && <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {keyError || (isArabic ? "المفتاح غير صالح" : "Invalid key")}</p>}
              <Button onClick={handleSaveKey} disabled={!apiKey.trim() || isSavingKey} className="gap-2 w-full">
                {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {isArabic ? "اختبار الاتصال وحفظ المفتاح" : "Test Connection & Save Key"}
              </Button>
            </div>
          </Section>
        )}

        {/* ── 11. Data Backup ── */}
        <Section
          id="backup" open={isOpen("backup")} onToggle={() => toggleSection("backup")}
          icon={<Database className="w-4 h-4" />}
          title={t("data_backup")}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        >
          <p className="text-sm text-muted-foreground">{t("backup_desc")}</p>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> {t("export_data")}
          </Button>
        </Section>

        {/* ── 12. Login Page (admin) ── */}
        {isAdmin && (
          <Section
            id="login" open={isOpen("login")} onToggle={() => toggleSection("login")}
            icon={<LogIn className="w-4 h-4" />}
            title={isArabic ? "تخصيص صفحة الدخول" : "Login Page"}
            accent="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
          >
            <div className="space-y-2">
              <Label className="text-sm">{isArabic ? "خلفية صفحة الدخول" : "Login Background"}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "default",         label: isArabic ? "افتراضي" : "Default",  cls: "bg-background border" },
                  { val: "gradient-blue",   label: isArabic ? "أزرق" : "Blue",        cls: "bg-gradient-to-br from-blue-100 to-indigo-200" },
                  { val: "gradient-purple", label: isArabic ? "بنفسجي" : "Purple",    cls: "bg-gradient-to-br from-purple-100 to-violet-200" },
                  { val: "gradient-green",  label: isArabic ? "أخضر" : "Green",       cls: "bg-gradient-to-br from-emerald-100 to-teal-200" },
                  { val: "gradient-warm",   label: isArabic ? "دافئ" : "Warm",        cls: "bg-gradient-to-br from-orange-100 to-rose-200" },
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
              <Label className="text-sm">{isArabic ? "نص ثانوي مخصص" : "Custom Subtitle"}</Label>
              <Input value={loginSubtitle} onChange={e => setLoginSubtitleState(e.target.value)} placeholder={isArabic ? "مثال: نظام الحضور المتكامل..." : "e.g. Attendance Management System..."} />
              <p className="text-xs text-muted-foreground">{isArabic ? "اتركه فارغاً للافتراضي" : "Leave empty for default"}</p>
            </div>
            <div className="border-t border-border pt-3">
              <Label className="text-sm flex items-center gap-1.5"><SendHorizonal className="w-3.5 h-3.5" /> {isArabic ? "الملخص اليومي" : "Daily Summary"}</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">{isArabic ? "إرسال تقرير حضور لكل موظف" : "Send attendance report to each employee"}</p>
              <Button variant="outline" onClick={sendDailySummary} disabled={dailySummarySending} className="gap-2">
                {dailySummarySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
                {isArabic ? "إرسال الملخص الآن" : "Send Summary Now"}
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
              <><Loader2 className="w-5 h-5 animate-spin" /> {isArabic ? "جارٍ الحفظ..." : "Saving..."}</>
            ) : (
              <><Save className="w-5 h-5" /> {isArabic ? "حفظ الإعدادات" : "Save Settings"}</>
            )}
          </button>
        </div>

      </div>
    </Layout>
  );
}
