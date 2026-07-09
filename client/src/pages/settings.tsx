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
        setError(isArabic ? t("location_not_found") : "Location not found");
      }
    } catch {
      setError(isArabic ? t("connection_failed") : "Connection failed");
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
          {isArabic ? t("search_geo_location") : "Search for a location"}
        </Label>
        <div className="relative">
          <Input
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={isArabic ? t("example_location") : "e.g. Dubai, Eiffel Tower, London..."}
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
        toast({ title: isArabic ? t("notif_permission_not_granted") : "Notification permission denied", variant: "destructive" });
        return;
      }
      setDailyRemindersEnabled(true); setRemindersEnabledState(true);
      scheduleDailyReminders((localStorage.getItem("settings_lang") as "en"|"ar"|"sv") || "en");
      toast({ title: isArabic ? t("reminders_enabled") : "✅ Reminders enabled" });
    } else {
      setDailyRemindersEnabled(false); setRemindersEnabledState(false);
      cancelDailyReminders();
      toast({ title: isArabic ? t("reminders_disabled") : "🔕 Reminders disabled" });
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
  const [logoAspectLocked, setLogoAspectLocked] = useState(false);
  const [logoScalePct, setLogoScalePct] = useState(100);

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
      setPushErrorMsg(isArabic ? t("browser_no_bg_notif") : "This browser does not support background push notifications");
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
      <div className="space-y-3 max-w-xl pb-8">

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
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 500_000) { toast({ title: isArabic ? t("size_over_500kb") : "Max 500KB", variant: "destructive" }); return; }
                          const reader = new FileReader();
                          reader.onload = ev => setLogoPreview(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted cursor-pointer">
                        <Database className="w-3.5 h-3.5" /> {isArabic ? t("choose_image") : "Choose Image"}
                      </span>
                    </label>
                    {logoPreview && (
                      <button onClick={() => setLogoPreview("")} className="px-3 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10">
                        {isArabic ? t("remove_action") : "Remove"}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WebP — {isArabic ? t("max_500kb") : "max 500KB"}</p>
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

              {/* Logo Size Controls */}
              <div className="space-y-3 pt-1">
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
                      type="range" min={16} max={600} step={1}
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
                      type="range" min={16} max={600} step={1}
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
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs">{isArabic ? t("scale_label") : "Scale"}</Label>
                  <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                    <input
                      type="range" min={10} max={300} step={1}
                      value={logoScalePct}
                      onChange={e => {
                        const pct = Number(e.target.value);
                        const factor = pct / logoScalePct;
                        setLogoW(v => Math.max(16, Math.min(600, Math.round(v * factor))));
                        setLogoH(v => Math.max(16, Math.min(600, Math.round(v * factor))));
                        setLogoScalePct(pct);
                      }}
                      className="w-full accent-primary h-1.5 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-primary w-10 text-end">{logoScalePct}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{isArabic ? t("width_px") : "W (px)"}</Label>
                      <Input
                        type="number" min={16} max={600}
                        value={logoW}
                        onChange={e => {
                          const v = Math.max(16, Math.min(600, Number(e.target.value)));
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
                        type="number" min={16} max={600}
                        value={logoH}
                        onChange={e => {
                          const v = Math.max(16, Math.min(600, Number(e.target.value)));
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
                  <div
                    className="rounded-xl bg-primary/10 overflow-hidden flex items-center justify-center border border-border flex-shrink-0"
                    style={{ width: Math.min(logoW, 120), height: Math.min(logoH, 120), maxWidth: 120, maxHeight: 120 }}
                    title={isArabic ? t("preview_label") : "Preview"}
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
                      type="range" min={-300} max={300} step={1}
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
                      type="range" min={-300} max={300} step={1}
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
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {isArabic ? t("reset_all") : "Reset all"}
                </button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Work Schedule */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium"><Clock className="w-3.5 h-3.5" /> {isArabic ? t("shift_schedule") : "Work Schedule"}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? t("start_time_utc") : "Start Time (UTC)"}</Label>
                  <Input type="time" value={workStartTime} onChange={e => setWorkStartTime(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{isArabic ? t("grace_period_min") : "Grace Period (min)"}</Label>
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
            <Label className="flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> {isArabic ? t("appearance_label2") : "Theme"}</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "light",  label: isArabic ? t("light_label2")   : "Light",  icon: <Sun className="w-4 h-4 text-yellow-500" />,  bg: "bg-white border-gray-200" },
                { value: "dark",   label: isArabic ? t("dark_label2")   : "Dark",   icon: <Moon className="w-4 h-4 text-slate-400" />,  bg: "bg-gray-900 border-gray-700" },
                { value: "system", label: isArabic ? t("automatic_label") : "Auto",   icon: <Monitor className="w-4 h-4 text-blue-400" />,bg: "bg-gradient-to-br from-white to-gray-700 border-gray-400" },
                { value: "ocean",  label: isArabic ? t("theme_ocean") : "Ocean",  dot: "bg-teal-500",   bg: "bg-teal-50 border-teal-200" },
                { value: "forest", label: isArabic ? t("theme_forest") : "Forest", dot: "bg-green-600",  bg: "bg-green-50 border-green-200" },
                { value: "rose",   label: isArabic ? t("theme_pink")   : "Rose",   dot: "bg-rose-500",   bg: "bg-rose-50 border-rose-200" },
                { value: "sunset", label: isArabic ? t("theme_sunset")   : "Sunset", dot: "bg-orange-500", bg: "bg-orange-50 border-orange-200" },
                { value: "purple", label: isArabic ? t("theme_purple") : "Purple", dot: "bg-purple-600", bg: "bg-purple-50 border-purple-200" },
                { value: "gold",   label: isArabic ? t("theme_gold")   : "Gold",   dot: "bg-yellow-500", bg: "bg-yellow-50 border-yellow-200" },
                { value: "ruby",   label: isArabic ? t("theme_ruby")  : "Ruby",   dot: "bg-red-600",    bg: "bg-red-50 border-red-200" },
                { value: "slate",  label: isArabic ? t("color_gray")  : "Slate",  dot: "bg-slate-500",  bg: "bg-slate-100 border-slate-300" },
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

            {/* ── Accent Color ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{isArabic ? t("accent_color") : "Accent Color"}</Label>
                {accentColor && (
                  <button
                    onClick={() => { setAccentColor(""); document.documentElement.style.removeProperty("--primary"); document.documentElement.style.removeProperty("--ring"); document.documentElement.style.removeProperty("--sidebar-primary"); }}
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
          accent="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        >
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
              <Input value={wakeWord} onChange={e => setWakeWord(e.target.value)} placeholder='مثال: مساعد، أتندكس...' className="flex-1" maxLength={30} />
              <Button variant="outline" size="sm" onClick={() => { setWakeWord(t("assistant_label")); toast({ title: 'تمت إعادة الضبط' }); }}>{isArabic ? t("default_option") : "Reset"}</Button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Button Appearance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{isArabic ? t("floating_button_shape") : "Floating Button"}</Label>
              <button onClick={() => { setAiButtonIcon("bot"); setAiButtonShape("circle"); setAiButtonColor("primary"); setAiButtonCustomColor("#6366f1"); toast({ title: t("reset_done") }); }}
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
                <p className="text-sm font-medium">{isArabic ? t("live_preview") : "Live Preview"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? t("appears_all_pages") : "Appears like this on all pages"}</p>
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? t("icon_label") : "Icon"}</p>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { val: "bot",      icon: <Bot className="w-5 h-5" />,           labelAr: t("icon_robot"),   labelEn: "Bot" },
                  { val: "sparkles", icon: <Sparkles className="w-5 h-5" />,      labelAr: t("clock_style_sparkle"),    labelEn: "Sparkles" },
                  { val: "brain",    icon: <Brain className="w-5 h-5" />,          labelAr: t("icon_brain"),    labelEn: "Brain" },
                  { val: "zap",      icon: <Zap className="w-5 h-5" />,            labelAr: t("clock_style_lightning"),     labelEn: "Zap" },
                  { val: "star",     icon: <Star className="w-5 h-5" />,            labelAr: t("icon_star"),    labelEn: "Star" },
                  { val: "heart",    icon: <Heart className="w-5 h-5" />,           labelAr: t("icon_heart"),     labelEn: "Heart" },
                  { val: "message",  icon: <MessageCircle className="w-5 h-5" />,  labelAr: t("message_label"),   labelEn: "Msg" },
                  { val: "cpu",      icon: <Cpu className="w-5 h-5" />,             labelAr: t("icon_wizard"),   labelEn: "CPU" },
                  { val: "wand",     icon: <Wand2 className="w-5 h-5" />,           labelAr: t("icon_wand"),     labelEn: "Wand" },
                  { val: "rocket",   icon: <Rocket className="w-5 h-5" />,          labelAr: t("icon_rocket"),   labelEn: "Rocket" },
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
              <p className="text-xs font-medium text-muted-foreground mb-2">{isArabic ? t("button_shape") : "Button Shape"}</p>
              <div className="grid grid-cols-4 gap-2">
                {([
                  { val: "circle",   labelAr: t("shape_round"),     labelEn: "Circle",   preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full bg-primary/40" /> },
                  { val: "rounded",  labelAr: t("shape_rounded2"),     labelEn: "Rounded",  preview: "rounded-2xl",   demo: <div className="w-6 h-6 rounded-2xl bg-primary/40" /> },
                  { val: "square",   labelAr: t("shape_square"),      labelEn: "Square",   preview: "rounded-lg",    demo: <div className="w-6 h-6 rounded-lg bg-primary/40" /> },
                  { val: "gradient", labelAr: t("clock_style_gradient"),      labelEn: "Gradient", preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full" style={{ background: "linear-gradient(135deg,hsl(var(--primary)),#7c3aed)" }} /> },
                  { val: "neon",     labelAr: t("clock_style_neon2"),      labelEn: "Neon",     preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full border-2 border-primary" style={{ boxShadow: "0 0 8px hsl(var(--primary))" }} /> },
                  { val: "glass",    labelAr: t("clock_style_glass"),     labelEn: "Glass",    preview: "rounded-2xl",   demo: <div className="w-6 h-6 rounded-2xl bg-primary/20 border border-primary/40" /> },
                  { val: "ring",     labelAr: t("clock_style_ring"),      labelEn: "Ring",     preview: "rounded-full",  demo: <div className="w-6 h-6 rounded-full border-3 border-primary" style={{ border: "3px solid hsl(var(--primary))" }} /> },
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

        {/* ── 5. Voice / TTS ── */}
        <Section
          id="voice" open={isOpen("voice")} onToggle={() => toggleSection("voice")}
          icon={ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          title={t("voice_narrator") ?? t("voice_narrator")}
          accent="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t("tts_enabled") ?? t("voice_narrator")}</p>
              <p className="text-xs text-muted-foreground">{t("tts_desc") ?? t("reads_assistant_replies")}</p>
            </div>
            <Toggle enabled={ttsEnabled} onChange={v => { setTtsEnabled(v); toast({ title: v ? t("sound_enabled") : t("sound_disabled") }); }} />
          </div>
          {ttsEnabled && (
            <button onClick={() => {
              if (!("speechSynthesis" in window)) { toast({ title: t("not_supported"), variant: "destructive" }); return; }
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(isArabic ? t("voice_narrator_active") : "Voice narrator is working");
              u.lang = isArabic ? "ar-SA" : "en-US"; u.rate = 0.95;
              window.speechSynthesis.speak(u);
              toast({ title: isArabic ? t("playing_sound") : "🔊 Playing..." });
            }} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 w-full justify-center">
              <Play className="w-3.5 h-3.5" /> {isArabic ? t("try_sound") : "Test Voice"}
            </button>
          )}
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
              <p className="text-xs text-muted-foreground">{isArabic ? t("time_example_7_4") : "At 07:00 (check-in) and 16:00 (check-out)"}</p>
            </div>
            <Toggle enabled={remindersEnabled} onChange={handleToggleReminders} />
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
              if (v && "Notification" in window && Notification.permission === "default") {
                await Notification.requestPermission();
              }
            }} />
          </div>
          {alarmSettings.enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">{isArabic ? t("shift_start") : "Start"}</Label>
                  <Input type="time" value={alarmSettings.startTime} onChange={e => setAlarmSettingsState(s => ({ ...s, startTime: e.target.value }))} />
                </div>
                <div className="space-y-1"><Label className="text-xs">{isArabic ? t("shift_end") : "End"}</Label>
                  <Input type="time" value={alarmSettings.endTime} onChange={e => setAlarmSettingsState(s => ({ ...s, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{isArabic ? t("sound_type") : "Sound"}</Label>
                <Select value={alarmSettings.soundType} onValueChange={v => setAlarmSettingsState(s => ({ ...s, soundType: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bell">{isArabic ? t("sound_bell") : "Bell 🔔"}</SelectItem>
                    <SelectItem value="beep">{isArabic ? t("sound_whistle") : "Beep 📟"}</SelectItem>
                    <SelectItem value="chime">{isArabic ? t("sound_tone") : "Chime 🎵"}</SelectItem>
                    <SelectItem value="horn">{isArabic ? t("sound_horn") : "Horn 📯"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{isArabic ? t("volume_level") : "Volume"} ({Math.round(alarmSettings.volume * 100)}%)</Label>
                <input type="range" min="0.1" max="1" step="0.1" value={alarmSettings.volume}
                  onChange={e => setAlarmSettingsState(s => ({ ...s, volume: parseFloat(e.target.value) }))} className="w-full accent-primary mt-1" />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
                try {
                  await playAlarmSound(alarmSettings.soundType, alarmSettings.volume);
                  toast({ title: isArabic ? t("sound_played") : "✅ Sound played successfully" });
                } catch {
                  toast({ title: isArabic ? t("sound_play_failed") : "❌ Sound failed - check volume", variant: "destructive" });
                }
              }}>
                <Volume2 className="w-3.5 h-3.5" /> {isArabic ? t("test_sound") : "Test Sound"}
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
                {pushStatus === "error" && (
                  <p className="text-xs text-destructive mt-1">
                    {pushErrorMsg || (isArabic ? t("subscription_failed_check_perm") : "Subscription failed. Please allow notifications.")}
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
          title={isArabic ? t("gps_locations_settings") : "GPS & Location"}
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
                localStorage.setItem("photo_doc_enabled", String(v));
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
              {keyStatus === "valid" && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {isArabic ? t("key_verified_saved") : "Key verified and saved"}</p>}
              {keyStatus === "verifying" && <p className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {isArabic ? t("checking_gemini_connection") : "Testing Gemini connection…"}</p>}
              {keyStatus === "invalid" && <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {keyError || (isArabic ? t("key_invalid2") : "Invalid key")}</p>}
              <Button onClick={handleSaveKey} disabled={!apiKey.trim() || isSavingKey} className="gap-2 w-full">
                {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {isArabic ? t("test_and_save_key") : "Test Connection & Save Key"}
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
