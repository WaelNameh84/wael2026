import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import {
  useGetTodayAttendance, useCheckIn, useCheckOut, useListLocations,
  useListAttendance, useDeleteAttendance,
  getGetTodayAttendanceQueryKey, getListAttendanceQueryKey
} from "@/lib/api-client/index";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, LogIn, LogOut, Fingerprint, MapPin, CheckCircle2, Timer,
  Radio, Trash2, FileText, CheckCircle, XCircle, Loader2, AlertCircle, Navigation,
  Camera, Upload, X as XIcon, ExternalLink, User,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { apiUrl, authHeaders } from "@/lib/api-url";
import TaskDocumentation from "@/components/TaskDocumentation";
import { NoAttendanceIllustration } from "@/components/ui/empty-illustrations";
import { cn } from "@/lib/utils";

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center space-y-1" data-testid="text-live-clock">
      <p className="text-5xl font-mono font-bold tracking-widest text-primary tabular-nums">
        {format(time, "HH:mm:ss")}
      </p>
      <p className="text-sm text-muted-foreground">{format(time, "EEEE, MMMM d, yyyy")}</p>
    </div>
  );
}

function statusBadge(s: string): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    present: "default", late: "secondary", absent: "destructive", early_leave: "outline", on_leave: "outline"
  };
  return map[s] ?? "outline";
}

/* The "outline" badge variant has a transparent background and relies on the
   ambient page background for contrast, which breaks when it ends up inside
   a light surface (or on themes where --foreground/--accent don't pair up
   correctly). Give early_leave/on_leave a fixed, always-readable colored
   pill instead, matching the pattern already used for present/late/absent. */
function statusBadgeExtraClass(s: string): string {
  if (s === "early_leave") return "!bg-orange-100 !text-orange-700 !border-orange-200 dark:!bg-orange-900/30 dark:!text-orange-400 dark:!border-orange-800";
  if (s === "on_leave")    return "!bg-blue-100 !text-blue-700 !border-blue-200 dark:!bg-blue-900/30 dark:!text-blue-400 dark:!border-blue-800";
  return "";
}

function fmtTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const JUSTIFY_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: "بانتظار الموافقة", color: "text-amber-600 bg-amber-50 border-amber-200" },
  approved: { label: "مقبول ✓",          color: "text-green-600 bg-green-50 border-green-200" },
  rejected: { label: "مرفوض ✗",          color: "text-red-600 bg-red-50 border-red-200" },
};

/* ─── Image compression helper ─────────────────────────────── */
function compressToB64(file: File, maxKB = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxPx = 1280;
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx; }
          else { width = Math.round((width * maxPx) / height); height = maxPx; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        const tryEnc = () => {
          const d = canvas.toDataURL("image/jpeg", quality);
          if (Math.round(d.length * 3 / 4 / 1024) > maxKB && quality > 0.3) { quality -= 0.1; tryEnc(); }
          else resolve(d.split(",")[1]);
        };
        tryEnc();
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AttendancePage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: today, isLoading: todayLoading } = useGetTodayAttendance({
    query: { queryKey: getGetTodayAttendanceQueryKey() }
  });
  const { data: locations } = useListLocations();
  const { data: history, isLoading: histLoading } = useListAttendance(
    undefined,
    { query: { queryKey: getListAttendanceQueryKey() } }
  );

  const { data: justifications = [], refetch: refetchJustifications } = useQuery<any[]>({
    queryKey: ["my-justifications"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/attendance/justifications"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const checkInMut  = useCheckIn();
  const checkOutMut = useCheckOut();
  const deleteAttMut = useDeleteAttendance();

  const [visibleCount, setVisibleCount] = useState(30);
  const [locationId, setLocationId] = useState<string>("");
  const [biometric,  setBiometric]  = useState(false);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [gpsStatus, setGpsStatus]     = useState<"idle" | "locating" | "located" | "error">("idle");
  const [gpsCoords, setGpsCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddress, setGpsAddress]   = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const gpsWatchRef = useRef<number | null>(null);

  const [justifyTarget, setJustifyTarget] = useState<{ id: number; date: string; type: "late" | "early_leave" } | null>(null);
  const [justifyReason, setJustifyReason] = useState("");
  const [justifyLoading, setJustifyLoading] = useState(false);

  /* ── Overtime decision (checkout after shift end) ── */
  const [overtimeTarget, setOvertimeTarget] = useState<{ id: number; date: string; overtimeHours: number } | null>(null);
  const [overtimeChoice, setOvertimeChoice] = useState<"forgot" | "overtime">("overtime");
  const [overtimeLoading, setOvertimeLoading] = useState(false);

  /* ── Photo-required check-in ── */
  const photoDocEnabled = localStorage.getItem("photo_doc_enabled") === "true";
  const [checkInCamOpen,   setCheckInCamOpen]   = useState(false);
  const [checkInPhotoB64,  setCheckInPhotoB64]  = useState<string | null>(null);
  const [checkInPreview,   setCheckInPreview]   = useState<string | null>(null);
  const [checkInUploading, setCheckInUploading] = useState(false);
  const checkInFileRef = useRef<HTMLInputElement>(null);

  const handleCheckInFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await compressToB64(file);
      setCheckInPhotoB64(b64);
      setCheckInPreview(`data:image/jpeg;base64,${b64}`);
    } catch { toast({ title: isArabic ? "فشل تحميل الصورة" : "Image load failed", variant: "destructive" }); }
    e.target.value = "";
  }, [isArabic, toast]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
  };

  const handleDeleteAttendance = async () => {
    if (deleteId === null) return;
    try {
      await deleteAttMut.mutateAsync({ id: deleteId });
      toast({ title: "تم الحذف بنجاح" });
      setDeleteId(null);
      refresh();
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
      setDeleteId(null);
    }
  };

  const handleSubmitJustification = async () => {
    if (!justifyTarget || justifyReason.trim().length < 5) {
      toast({ title: "يرجى كتابة سبب واضح (5 أحرف على الأقل)", variant: "destructive" });
      return;
    }
    setJustifyLoading(true);
    try {
      const endpoint = justifyTarget.type === "early_leave"
        ? `/api/attendance/${justifyTarget.id}/justify-early`
        : `/api/attendance/${justifyTarget.id}/justify`;
      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason: justifyReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast({ title: "تم الإرسال مسبقاً", description: "لقد أرسلت تبرير لهذا السجل من قبل." });
        } else {
          toast({ title: json?.error ?? "فشل الإرسال", variant: "destructive" });
        }
      } else {
        toast({ title: "✅ تم إرسال التبرير", description: "سيتم مراجعته من قِبل الإدارة." });
        setJustifyTarget(null);
        setJustifyReason("");
        refetchJustifications();
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setJustifyLoading(false);
    }
  };

  const handleOvertimeDecision = async () => {
    if (!overtimeTarget) return;
    setOvertimeLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/attendance/${overtimeTarget.id}/overtime-decision`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ choice: overtimeChoice }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: json?.error ?? "فشل الإرسال", variant: "destructive" });
      } else {
        toast({
          title: overtimeChoice === "forgot" ? "تم التسجيل: نسيت تسجيل الخروج" : "✅ تم تسجيل طلب الوقت الإضافي",
          description: overtimeChoice === "forgot"
            ? "لن يُحتسب وقت إضافي لهذه الفترة."
            : "سيتم إشعار المدير لمراجعة الوقت الإضافي.",
        });
        setOvertimeTarget(null);
        refresh();
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setOvertimeLoading(false);
    }
  };

  const todayExt = today as any;
  const currentlyCheckedIn: boolean = todayExt?.currentlyCheckedIn ?? false;
  const sessions: any[] = todayExt?.sessions ?? (today ? [today] : []);
  const totalHoursToday: number = todayExt?.totalHoursWorked ?? today?.hoursWorked ?? 0;

  /* ── Actual check-in (after optional photo upload) ── */
  const doCheckIn = async () => {
    if (!locationId) { toast({ title: t("select_location"), variant: "destructive" }); return; }
    if (gpsStatus !== "located") {
      toast({ title: isArabic ? "يرجى تحديد موقعك الجغرافي أولاً" : "Please locate yourself first", description: isArabic ? "اضغط على زر 'تحديد موقعي' قبل تسجيل الدخول" : "Press 'Locate Me' before checking in", variant: "destructive" });
      return;
    }
    try {
      const extra: any = { locationId: parseInt(locationId), biometricVerified: biometric };
      if (gpsCoords) {
        extra.gpsLat = gpsCoords.lat;
        extra.gpsLng = gpsCoords.lng;
        extra.gpsAddress = gpsAddress ?? undefined;
      }
      const result: any = await checkInMut.mutateAsync({ data: extra });
      toast({ title: t("checked_in_success"), description: gpsAddress ? `📍 ${gpsAddress}` : undefined });
      setGpsCoords(null); setGpsAddress(null); setGpsStatus("idle"); setGpsAccuracy(null);
      refresh();
      if (result?.status === "late" && result?.id) {
        setJustifyTarget({ id: result.id, date: result.date, type: "late" });
        setJustifyReason("");
      }
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.message ?? t("check_in_failed");
      toast({ title: t("check_in_failed"), description: msg, variant: "destructive" });
    }
  };

  /* ── Upload photo then check in ── */
  const handlePhotoAndCheckIn = async () => {
    if (!checkInPhotoB64) return;
    setCheckInUploading(true);
    try {
      await fetch(apiUrl("/api/work-reports"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: checkInPhotoB64, note: isArabic ? "توثيق الحضور" : "Check-in photo" }),
      });
    } catch { /* non-fatal — proceed with check-in anyway */ }
    setCheckInUploading(false);
    setCheckInCamOpen(false);
    setCheckInPhotoB64(null);
    setCheckInPreview(null);
    await doCheckIn();
  };

  /* ── Main handler: gate on photo-doc toggle ── */
  const handleCheckIn = async () => {
    if (!locationId) { toast({ title: t("select_location"), variant: "destructive" }); return; }
    if (photoDocEnabled) {
      setCheckInPhotoB64(null);
      setCheckInPreview(null);
      setCheckInCamOpen(true);
      return;
    }
    await doCheckIn();
  };

  const handleCheckOut = async () => {
    try {
      const result: any = await checkOutMut.mutateAsync({ data: {} });
      toast({ title: t("checked_out_success") });
      refresh();
      if (result?.status === "early_leave" && result?.id) {
        setJustifyTarget({ id: result.id, date: result.date, type: "early_leave" });
        setJustifyReason("");
      } else if (result?.overtime && result.overtime > 0 && result?.id) {
        setOvertimeTarget({ id: result.id, date: result.date, overtimeHours: result.overtime });
        setOvertimeChoice("overtime");
      }
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.message ?? t("check_out_failed");
      toast({ title: t("check_out_failed"), description: msg, variant: "destructive" });
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS غير مدعوم في هذا المتصفح", variant: "destructive" });
      return;
    }
    // Clear any previous watch
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    setGpsStatus("locating");
    setGpsCoords(null);
    setGpsAddress(null);
    setGpsAccuracy(null);

    let bestPosition: GeolocationPosition | null = null;
    let settled = false;

    const finalize = async (position: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
      const { latitude, longitude, accuracy } = position.coords;
      setGpsCoords({ lat: latitude, lng: longitude });
      setGpsAccuracy(Math.round(accuracy));
      setGpsStatus("located");

      // Use server-side geocoding proxy (avoids CSP/CORS issues)
      try {
        const r = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
        const d = r.ok ? await r.json() : null;
        if (d?.address) {
          setGpsAddress(d.address);
          return;
        }
      } catch { /* fall through */ }

      // Fallback: show coordinates in a labelled, readable format
      setGpsAddress(`${isArabic ? "إحداثيات" : "Coords"}: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    };

    // Use watchPosition to collect the most accurate reading within 20s
    const TIMEOUT_MS = 20000;
    const TARGET_ACCURACY_M = 50; // accept immediately if ≤50 m accuracy

    const timer = setTimeout(() => {
      if (!settled && bestPosition) {
        finalize(bestPosition);
      } else if (!settled) {
        settled = true;
        if (gpsWatchRef.current !== null) {
          navigator.geolocation.clearWatch(gpsWatchRef.current);
          gpsWatchRef.current = null;
        }
        setGpsStatus("error");
        toast({ title: "تعذّر تحديد الموقع. تأكد من السماح بالوصول للموقع.", variant: "destructive" });
      }
    }, TIMEOUT_MS);

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Keep the best (most accurate) position seen so far
        if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = pos;
        }
        // If accuracy is good enough, finalize early
        if (pos.coords.accuracy <= TARGET_ACCURACY_M) {
          clearTimeout(timer);
          finalize(pos);
        }
      },
      () => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          if (gpsWatchRef.current !== null) {
            navigator.geolocation.clearWatch(gpsWatchRef.current);
            gpsWatchRef.current = null;
          }
          setGpsStatus("error");
          toast({ title: "تعذّر تحديد الموقع. تأكد من السماح بالوصول للموقع.", variant: "destructive" });
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: TIMEOUT_MS }
    );
  };

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  // Separate maps per justification type to avoid collision when an employee
  // was late (submitted late justification) AND left early the same day.
  const lateJustifMap = new Map<number, any>();
  const earlyJustifMap = new Map<number, any>();
  justifications.forEach((j: any) => {
    if (j.type === "early_leave") earlyJustifMap.set(j.attendanceId, j);
    else lateJustifMap.set(j.attendanceId, j);
  });
  // For display in history list: show whichever justification matches the record's current status
  const justificationMap = new Map<string, any>(
    justifications.map((j: any) => [
      `${j.attendanceId}_${j.type ?? "late"}`,
      j,
    ])
  );

  const selectedLocation = locations?.find(l => String(l.id) === locationId);
  const openLocationInMaps = () => {
    if (!selectedLocation) return;
    const url = (selectedLocation.lat != null && selectedLocation.lng != null)
      ? `https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedLocation.address)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold">{t("attendance")}</h1>

        {/* Clock + action card */}
        <div className="bg-card border border-card-border rounded-xl p-8 flex flex-col items-center gap-6">
          <LiveClock />

          {todayLoading ? (
            <Skeleton className="h-10 w-64" />
          ) : today ? (
            <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-medium text-sm ${
              currentlyCheckedIn
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                : "bg-muted text-muted-foreground"
            }`}>
              {currentlyCheckedIn ? (
                <><Radio className="w-4 h-4 animate-pulse" />{t("currently_checked_in")}</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" />{t("session_ended")}</>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("no_attendance_today")}</p>
          )}

          {today && (
            <div className="flex flex-wrap gap-5 text-sm justify-center">
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">{t("sessions_today")}</p>
                <p className="font-semibold">{sessions.length}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">{t("total_hours_today")}</p>
                <p className="font-semibold">{totalHoursToday.toFixed(2)}h</p>
              </div>
              {today.overtime != null && today.overtime > 0 && (
                <div className="text-center">
                  <p className="text-muted-foreground text-xs mb-0.5">{t("overtime_h")}</p>
                  <p className="font-semibold text-orange-500">{today.overtime.toFixed(2)}h</p>
                </div>
              )}
              <div className="text-center">
                <p className="text-muted-foreground text-xs mb-0.5">{t("status")}</p>
                <Badge variant={statusBadge(today.status ?? "")}>
                  {isArabic ? { present: "حاضر", late: "متأخر", absent: "غائب", on_leave: "إجازة", early_leave: "مغادرة مبكرة", currently_working: "يعمل الآن" }[today.status ?? ""] ?? (today.status ?? "").replace("_", " ") : (t(today.status ?? "") || (today.status ?? "").replace("_", " "))}
                </Badge>
              </div>
            </div>
          )}

          <div className="w-full max-w-xs space-y-3">
            {!currentlyCheckedIn && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {t("location")}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Select value={locationId} onValueChange={setLocationId}>
                        <SelectTrigger data-testid="select-location">
                          <SelectValue placeholder={t("select_location")} />
                        </SelectTrigger>
                        <SelectContent>
                          {locations?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedLocation && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="flex-shrink-0"
                        onClick={openLocationInMaps}
                        title={isArabic ? "افتح في خرائط جوجل والتوجه إلى الموقع" : "Open in Google Maps & get directions"}
                        data-testid="button-open-location-maps"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="biometric" checked={biometric} onCheckedChange={setBiometric} data-testid="switch-biometric" />
                  <Label htmlFor="biometric" className="flex items-center gap-1.5 cursor-pointer">
                    <Fingerprint className="w-3.5 h-3.5" /> {t("verify_biometric")}
                  </Label>
                </div>
                {/* GPS Location */}
                <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <Navigation className="w-3.5 h-3.5" /> {isArabic ? "تحديد الموقع الجغرافي" : "GPS Location"}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleLocate}
                      disabled={gpsStatus === "locating"}
                    >
                      {gpsStatus === "locating" ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> {isArabic ? "جارٍ التحديد..." : "Locating..."}</>
                      ) : (
                        <><MapPin className="w-3 h-3" /> {isArabic ? "تحديد موقعي" : "Locate Me"}</>
                      )}
                    </Button>
                  </div>
                  {gpsStatus === "located" && gpsAddress && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{gpsAddress}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {gpsAccuracy !== null && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${gpsAccuracy <= 50 ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : gpsAccuracy <= 200 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                            {isArabic ? `دقة: ±${gpsAccuracy} م` : `Accuracy: ±${gpsAccuracy} m`}
                          </span>
                        )}
                        {gpsCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 dark:text-blue-400 underline flex items-center gap-0.5 hover:text-blue-800"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            {isArabic ? "تحقق على الخريطة" : "Verify on map"}
                          </a>
                        )}
                        {gpsAccuracy !== null && gpsAccuracy > 200 && (
                          <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
                            {isArabic ? "⚠️ دقة منخفضة — اخرج للهواء الطلق" : "⚠️ Low accuracy — go outdoors"}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {gpsStatus === "error" && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {isArabic ? "تعذّر تحديد الموقع" : "Could not get location"}
                    </p>
                  )}
                </div>
              </>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleCheckIn}
              disabled={checkInMut.isPending || currentlyCheckedIn}
              variant={currentlyCheckedIn ? "outline" : "default"}
              data-testid="button-check-in"
            >
              <LogIn className="w-4 h-4" />
              {today ? t("new_check_in") : t("check_in")}
            </Button>
            <Button
              variant={currentlyCheckedIn ? "default" : "outline"}
              className="w-full gap-2"
              onClick={handleCheckOut}
              disabled={checkOutMut.isPending || !currentlyCheckedIn}
              data-testid="button-check-out"
            >
              <LogOut className="w-4 h-4" />
              {t("check_out")}
            </Button>
          </div>
        </div>

        {/* Task Documentation */}
        <TaskDocumentation />

        {/* Today's sessions */}
        {sessions.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">{t("todays_sessions")}</h2>
              <span className="ms-auto text-xs text-muted-foreground">
                {t("total_hours_today")}: <strong>{totalHoursToday.toFixed(2)}h</strong>
              </span>
            </div>
            <div className="divide-y divide-border">
              {sessions.map((session: any, idx: number) => {
                const isOpen = !session.checkOut;
                return (
                  <div key={session.id} className="px-5 py-3 flex items-center gap-4" data-testid={`row-session-${session.id}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isOpen
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          <span className="text-muted-foreground text-xs">{t("check_in")}:</span>{" "}
                          {fmtTime(session.checkIn)}
                        </span>
                        {session.checkOut ? (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm font-medium">
                              <span className="text-muted-foreground text-xs">{t("check_out")}:</span>{" "}
                              {fmtTime(session.checkOut)}
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Radio className="w-3 h-3 animate-pulse" /> {t("in_progress")}
                          </span>
                        )}
                      </div>
                      {session.locationName && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {session.locationName}
                        </p>
                      )}
                    </div>
                    <div className="text-end flex-shrink-0">
                      {session.hoursWorked != null ? (
                        <p className="text-sm font-semibold">{session.hoursWorked.toFixed(2)}h</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">{t("in_progress")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History */}
        <div className="bg-card border border-card-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">{t("attendance_history")}</h2>
          </div>
          {histLoading ? (
            <div className="divide-y divide-border">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-14 rounded" />
                    <Skeleton className="h-4 w-14 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history?.slice(0, visibleCount).map((rec: any) => {
                const isLate = rec.status === "late";
                const isEarlyLeave = rec.status === "early_leave";
                // Use type-specific maps so a late justification doesn't block an early-leave justification
                const existingLateJust  = lateJustifMap.get(rec.id);
                const existingEarlyJust = earlyJustifMap.get(rec.id);
                const existingJust = isEarlyLeave ? existingEarlyJust : existingLateJust;
                const justInfo = existingJust ? JUSTIFY_STATUS_LABEL[existingJust.status] : null;

                return (
                  <div key={rec.id} className="px-5 py-3 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors rounded-lg" data-testid={`row-attendance-${rec.id}`} onClick={() => setDetailRecord(rec)}>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{rec.date}</p>
                      <p className="text-xs text-muted-foreground">{rec.locationName ?? "—"}</p>

                      {/* Justification status badge */}
                      {justInfo && (
                        <div className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${justInfo.color}`}>
                          {existingJust.status === "approved" ? <CheckCircle className="w-3 h-3" /> :
                           existingJust.status === "rejected" ? <XCircle className="w-3 h-3" /> :
                           <Clock className="w-3 h-3" />}
                          {justInfo.label}
                          {existingJust.adminNote && (
                            <span className="text-muted-foreground"> — {existingJust.adminNote}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-end space-y-1">
                      <Badge
                        variant={statusBadge(rec.status ?? "")}
                        className={cn("text-xs", statusBadgeExtraClass(rec.status ?? ""))}
                      >
                        {isArabic ? ({ present: "حاضر", late: "متأخر", absent: "غائب", on_leave: "إجازة", early_leave: "مغادرة مبكرة", currently_working: "يعمل الآن" } as Record<string, string>)[rec.status ?? ""] ?? (rec.status ?? "").replace("_", " ") : (t(rec.status ?? "") || (rec.status ?? "").replace("_", " "))}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {rec.checkIn ? fmtTime(rec.checkIn) : "—"}
                        {rec.checkOut ? ` → ${fmtTime(rec.checkOut)}` : ""}
                        {rec.hoursWorked != null ? ` (${rec.hoursWorked.toFixed(1)}h)` : ""}
                      </p>
                    </div>

                    {/* Justify Late — only for late records with no late justification yet */}
                    {isLate && !existingLateJust && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); setJustifyTarget({ id: rec.id, date: rec.date, type: "late" }); setJustifyReason(""); }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        تبرير التأخر
                      </Button>
                    )}

                    {/* Justify Early Leave — only for early_leave records with no early_leave justification */}
                    {isEarlyLeave && !existingEarlyJust && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-orange-300 text-orange-700 hover:bg-orange-50 flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); setJustifyTarget({ id: rec.id, date: rec.date, type: "early_leave" }); setJustifyReason(""); }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        تبرير الخروج
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive w-8 h-8 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(rec.id); }}
                      data-testid={`button-delete-attendance-${rec.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
              {(!history || history.length === 0) && (
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                  <NoAttendanceIllustration />
                  <div>
                    <p className="font-medium text-sm text-foreground/80">{t("no_records")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isArabic ? "لم يتم تسجيل أي حضور بعد" : "No attendance records yet"}
                    </p>
                  </div>
                </div>
              )}
              {history && history.length > visibleCount && (
                <div className="px-5 py-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(c => c + 30)}
                    className="text-xs gap-1.5"
                  >
                    {isArabic ? `عرض المزيد (${history.length - visibleCount} سجل متبقي)` : `Load more (${history.length - visibleCount} remaining)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Justification Dialog — Late or Early Leave */}
        <Dialog open={!!justifyTarget} onOpenChange={v => { if (!v) setJustifyTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${justifyTarget?.type === "early_leave" ? "text-orange-700" : "text-amber-700"}`}>
                <AlertCircle className="w-5 h-5" />
                {justifyTarget?.type === "early_leave" ? "تبرير الخروج المبكر" : "تبرير التأخر"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className={`border rounded-lg px-4 py-3 text-sm ${justifyTarget?.type === "early_leave" ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                <p className="font-semibold mb-1">📅 التاريخ: {justifyTarget?.date}</p>
                <p>
                  {justifyTarget?.type === "early_leave"
                    ? "اكتب سبباً واضحاً للخروج المبكر. إذا وافق المدير، لن يُحسب الخروج المبكر عليك."
                    : "اكتب سبباً واضحاً لتأخرك. إذا وافق المدير، سيُحتسب حضورك كاملاً بدون خصم."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="justify-reason">
                  {justifyTarget?.type === "early_leave" ? "سبب الخروج المبكر *" : "سبب التأخر *"}
                </Label>
                <Textarea
                  id="justify-reason"
                  placeholder={
                    justifyTarget?.type === "early_leave"
                      ? "مثال: موعد طبي / ظرف عائلي طارئ / إذن مسبق من المدير..."
                      : "مثال: انقطاع الكهرباء في المنطقة / حادث مروري / ظرف طارئ..."
                  }
                  value={justifyReason}
                  onChange={e => setJustifyReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">{justifyReason.length} حرف (الحد الأدنى 5)</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setJustifyTarget(null)}>
                إلغاء
              </Button>
              <Button
                size="sm"
                className={`gap-1.5 text-white border-0 ${justifyTarget?.type === "early_leave" ? "bg-orange-600 hover:bg-orange-700" : "bg-amber-600 hover:bg-amber-700"}`}
                disabled={justifyLoading || justifyReason.trim().length < 5}
                onClick={handleSubmitJustification}
              >
                {justifyLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileText className="w-3.5 h-3.5" />}
                إرسال التبرير
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Overtime decision dialog — checkout happened after shift end */}
        <Dialog open={!!overtimeTarget} onOpenChange={v => { if (!v) setOvertimeTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-cyan-700">
                <Timer className="w-5 h-5" />
                تسجيل خروج بعد وقت الدوام
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="border rounded-lg px-4 py-3 text-sm bg-cyan-50 border-cyan-200 text-cyan-800">
                <p className="font-semibold mb-1">📅 التاريخ: {overtimeTarget?.date}</p>
                <p>
                  سجّلت خروجاً بعد نهاية وقت الدوام بحوالي {overtimeTarget?.overtimeHours.toFixed(2)} ساعة.
                  اختر السبب: هل نسيت تسجيل الخروج في وقته، أم أنك عملت وقتاً إضافياً فعلياً؟
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>السبب *</Label>
                <Select value={overtimeChoice} onValueChange={v => setOvertimeChoice(v as "forgot" | "overtime")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forgot">نسيت تسجيل الخروج (لا يُحسب إضافي)</SelectItem>
                    <SelectItem value="overtime">عملت وقتاً إضافياً (يُحسب إضافي)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {overtimeChoice === "forgot"
                    ? "لن يتم احتساب أي وقت إضافي لهذه الفترة."
                    : "سيُرسل الوقت الإضافي للمدير للمراجعة والاحتساب."}
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white border-0"
                disabled={overtimeLoading}
                onClick={handleOvertimeDecision}
              >
                {overtimeLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle className="w-3.5 h-3.5" />}
                تأكيد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail dialog */}
        <Dialog open={!!detailRecord} onOpenChange={v => { if (!v) setDetailRecord(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                تفاصيل سجل الحضور — {detailRecord?.date}
              </DialogTitle>
            </DialogHeader>
            {detailRecord && (
              <div className="space-y-3 py-2 text-sm">
                {/* Employee name — shown for admin/manager views */}
                {detailRecord.userName && (
                  <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-primary/5">
                    <span className="flex items-center gap-2 text-muted-foreground font-medium">
                      <User className="w-4 h-4 text-primary" /> اسم الموظف
                    </span>
                    <span className="font-semibold">{detailRecord.userName}</span>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-muted/30">
                  <span className="text-muted-foreground font-medium">الحالة</span>
                  <Badge variant={statusBadge(detailRecord.status ?? "")} className={cn(statusBadgeExtraClass(detailRecord.status ?? ""))}>
                    {isArabic ? ({ present: "حاضر", late: "متأخر", absent: "غائب", on_leave: "إجازة", early_leave: "مغادرة مبكرة", currently_working: "يعمل الآن" } as Record<string, string>)[detailRecord.status ?? ""] ?? (detailRecord.status ?? "").replace("_", " ") : (t(detailRecord.status ?? "") || (detailRecord.status ?? "").replace("_", " "))}
                  </Badge>
                </div>

                {/* Check-in */}
                <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <LogIn className="w-4 h-4 text-green-600" /> وقت الدخول
                  </span>
                  <span className="font-semibold">{detailRecord.checkIn ? fmtTime(detailRecord.checkIn) : "—"}</span>
                </div>

                {/* Check-out */}
                <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <LogOut className="w-4 h-4 text-red-500" /> وقت الخروج
                  </span>
                  <span className="font-semibold">{detailRecord.checkOut ? fmtTime(detailRecord.checkOut) : "—"}</span>
                </div>

                {/* Hours */}
                <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <Timer className="w-4 h-4 text-blue-500" /> ساعات العمل
                  </span>
                  <span className="font-semibold">{detailRecord.hoursWorked != null ? `${detailRecord.hoursWorked.toFixed(2)} ساعة` : "—"}</span>
                </div>

                {/* Overtime */}
                {detailRecord.overtime != null && detailRecord.overtime > 0 && (
                  <div className="flex items-center justify-between border rounded-lg px-4 py-3 bg-orange-50 border-orange-200">
                    <span className="flex items-center gap-2 text-orange-700 font-medium">
                      <Clock className="w-4 h-4" /> وقت إضافي
                    </span>
                    <span className="font-semibold text-orange-700">{detailRecord.overtime.toFixed(2)} ساعة</span>
                  </div>
                )}

                {/* Location */}
                <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <MapPin className="w-4 h-4 text-purple-500" /> الموقع
                  </span>
                  <span className="font-semibold">{detailRecord.locationName ?? "—"}</span>
                </div>

                {/* GPS — always visible */}
                <div className="border rounded-lg px-4 py-3 space-y-1">
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <Navigation className="w-4 h-4 text-teal-500" /> الموقع الجغرافي
                  </span>
                  {detailRecord.gpsAddress && !/^[\d\s.,،:]+$/.test(detailRecord.gpsAddress.replace(/^إحداثيات[:\s]*/, '')) ? (
                    <p className="text-xs text-muted-foreground mt-1">{detailRecord.gpsAddress}</p>
                  ) : null}
                  {detailRecord.gpsLat != null && detailRecord.gpsLng != null ? (
                    <a
                      href={`https://www.google.com/maps?q=${detailRecord.gpsLat},${detailRecord.gpsLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 mt-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      عرض الموقع على الخريطة
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">—</p>
                  )}
                </div>

                {/* Biometric */}
                {detailRecord.biometricVerified != null && (
                  <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                    <span className="flex items-center gap-2 text-muted-foreground font-medium">
                      <Fingerprint className="w-4 h-4" /> التحقق البيومتري
                    </span>
                    <span className={`font-semibold ${detailRecord.biometricVerified ? "text-green-600" : "text-muted-foreground"}`}>
                      {detailRecord.biometricVerified ? "✓ تم التحقق" : "لا"}
                    </span>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setDetailRecord(null)}>إغلاق</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                تأكيد الحذف
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>إلغاء</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteAttMut.isPending}
                onClick={handleDeleteAttendance}
              >
                {deleteAttMut.isPending
                  ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block me-1" />
                  : null}
                حذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Check-in Photo Dialog ───────────────────────────────── */}
      <Dialog open={checkInCamOpen} onOpenChange={v => { if (!v) { setCheckInCamOpen(false); setCheckInPhotoB64(null); setCheckInPreview(null); } }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              {isArabic ? "التقط صورة للحضور" : "Capture Check-in Photo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview area */}
            <div
              onClick={() => checkInFileRef.current?.click()}
              className={`relative aspect-video rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition-colors ${
                checkInPreview ? "border-primary/40" : "border-muted-foreground/30 hover:border-primary/50"
              } bg-muted/50 flex items-center justify-center`}
            >
              {checkInPreview ? (
                <>
                  <img src={checkInPreview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setCheckInPhotoB64(null); setCheckInPreview(null); }}
                    className="absolute top-2 end-2 z-10 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">
                    {isArabic ? "اضغط لفتح الكاميرا" : "Tap to open camera"}
                  </p>
                  <p className="text-xs opacity-60 mt-0.5">
                    {isArabic ? "صورة مطلوبة قبل تسجيل الحضور" : "Photo required before check-in"}
                  </p>
                </div>
              )}
            </div>

            <input
              ref={checkInFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleCheckInFileChange}
            />

            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <Camera className="w-3 h-3 flex-shrink-0 mt-0.5" />
              {isArabic
                ? "يُشترط التقاط صورة لتوثيق حضورك. بعد الالتقاط، سيتم تسجيل الحضور تلقائياً."
                : "A photo is required to document your presence. After capture, check-in will proceed automatically."}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setCheckInCamOpen(false); setCheckInPhotoB64(null); setCheckInPreview(null); }}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!checkInPhotoB64 || checkInUploading || checkInMut.isPending}
              onClick={handlePhotoAndCheckIn}
            >
              {(checkInUploading || checkInMut.isPending)
                ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : <CheckCircle2 className="w-3.5 h-3.5" />}
              {isArabic ? "تسجيل الحضور" : "Confirm Check-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
