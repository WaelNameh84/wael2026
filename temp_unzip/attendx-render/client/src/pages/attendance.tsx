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
  Camera, Upload, X as XIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { apiUrl, authHeaders } from "@/lib/api-url";
import TaskDocumentation from "@/components/TaskDocumentation";

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

  const [locationId, setLocationId] = useState<string>("");
  const [biometric,  setBiometric]  = useState(false);
  const [deleteId,   setDeleteId]   = useState<number | null>(null);
  const [gpsStatus, setGpsStatus]   = useState<"idle" | "locating" | "located" | "error">("idle");
  const [gpsCoords, setGpsCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(null);

  const [justifyTarget, setJustifyTarget] = useState<{ id: number; date: string } | null>(null);
  const [justifyReason, setJustifyReason] = useState("");
  const [justifyLoading, setJustifyLoading] = useState(false);

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
      const res = await fetch(apiUrl(`/api/attendance/${justifyTarget.id}/justify`), {
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
      await checkInMut.mutateAsync({ data: extra });
      toast({ title: t("checked_in_success"), description: gpsAddress ? `📍 ${gpsAddress}` : undefined });
      setGpsCoords(null); setGpsAddress(null); setGpsStatus("idle");
      refresh();
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
      await checkOutMut.mutateAsync({ data: {} });
      toast({ title: t("checked_out_success") });
      refresh();
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
    setGpsStatus("locating");
    setGpsCoords(null);
    setGpsAddress(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        setGpsStatus("located");
        // Reverse geocode with public API
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(r => r.json())
          .then(d => setGpsAddress(d.display_name?.split(",").slice(0, 3).join(", ") ?? null))
          .catch(() => setGpsAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`));
      },
      () => {
        setGpsStatus("error");
        toast({ title: "تعذّر تحديد الموقع. تأكد من السماح بالوصول للموقع.", variant: "destructive" });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const justificationMap = new Map<number, any>(
    justifications.map((j: any) => [j.attendanceId, j])
  );

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
                  {t(today.status ?? "") || (today.status ?? "").replace("_", " ")}
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
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger data-testid="select-location">
                      <SelectValue placeholder={t("select_location")} />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                    <div className="flex items-start gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{gpsAddress}</span>
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
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="divide-y divide-border">
              {history?.slice(0, 30).map((rec: any) => {
                const isLate = rec.status === "late";
                const existingJust = justificationMap.get(rec.id);
                const justInfo = existingJust ? JUSTIFY_STATUS_LABEL[existingJust.status] : null;

                return (
                  <div key={rec.id} className="px-5 py-3 flex items-start gap-3" data-testid={`row-attendance-${rec.id}`}>
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
                      <Badge variant={statusBadge(rec.status ?? "")} className="text-xs">
                        {t(rec.status ?? "") || (rec.status ?? "").replace("_", " ")}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {rec.checkIn ? fmtTime(rec.checkIn) : "—"}
                        {rec.checkOut ? ` → ${fmtTime(rec.checkOut)}` : ""}
                        {rec.hoursWorked != null ? ` (${rec.hoursWorked.toFixed(1)}h)` : ""}
                      </p>
                    </div>

                    {/* Justify Late button — only for late records with no justification yet */}
                    {isLate && !existingJust && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex-shrink-0"
                        onClick={() => { setJustifyTarget({ id: rec.id, date: rec.date }); setJustifyReason(""); }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        تبرير التأخر
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive w-8 h-8 flex-shrink-0"
                      onClick={() => setDeleteId(rec.id)}
                      data-testid={`button-delete-attendance-${rec.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
              {(!history || history.length === 0) && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">{t("no_records")}</div>
              )}
            </div>
          )}
        </div>

        {/* Late Justification Dialog */}
        <Dialog open={!!justifyTarget} onOpenChange={v => { if (!v) setJustifyTarget(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                تبرير التأخر
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold mb-1">📅 التاريخ: {justifyTarget?.date}</p>
                <p>
                  اكتب سبباً واضحاً لتأخرك. إذا وافق المدير، سيُحتسب حضورك كاملاً
                  (8 ساعات دوام) بدون خصم.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="justify-reason">سبب التأخر *</Label>
                <Textarea
                  id="justify-reason"
                  placeholder="مثال: انقطاع الكهرباء في المنطقة / حادث مروري / ظرف طارئ..."
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
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-0"
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
