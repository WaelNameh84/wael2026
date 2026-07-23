import { useRef, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiUrl, authHeaders, authFetch } from "@/lib/api-url";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Camera, Upload, X, Loader2, Image as ImageIcon, FileText,
  Trash2, Clock, ChevronDown, ChevronUp, FolderOpen, CheckSquare, Square,
} from "lucide-react";
import { format } from "date-fns";
import { useDoubleClickClose } from "@/hooks/use-double-click-close";

/* ─── Compress image to JPEG ≤ 500 KB ─────────────────────── */
function compressImage(file: File, maxKB = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas  = document.createElement("canvas");
        const maxPx   = 1280;
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx; }
          else { width = Math.round((width * maxPx) / height); height = maxPx; }
        }
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        const tryEncode = () => {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const sizeKB  = Math.round((dataUrl.length * 3) / 4 / 1024);
          if (sizeKB > maxKB && quality > 0.3) { quality -= 0.1; tryEncode(); }
          else resolve(dataUrl.split(",")[1]);
        };
        tryEncode();
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Component ─────────────────────────────────────────────── */
export default function TaskDocumentation() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast }  = useToast();
  const qClient    = useQueryClient();
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [open,       setOpen]       = useState(false);
  const [preview,    setPreview]    = useState<string | null>(null);
  const [b64,        setB64]        = useState<string | null>(null);
  const [note,       setNote]       = useState("");
  const [loading,    setLoading]    = useState(false);
  const [showAll,    setShowAll]    = useState(false);
  const [viewImg,    setViewImg]    = useState<string | null>(null);
  const closeImage = useDoubleClickClose(() => setViewImg(null));

  /* ── Select-to-delete state ── */
  const [selectMode, setSelectMode] = useState(false);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());
  const [deleting,   setDeleting]   = useState(false);

  /* load own reports */
  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["work-reports"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/work-reports"), { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const displayed = showAll ? reports : reports.slice(0, 6);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setB64(compressed);
      setPreview(`data:image/jpeg;base64,${compressed}`);
    } catch {
      toast({ title: isArabic ? "فشل تحميل الصورة" : "Image load failed", variant: "destructive" });
    }
    e.target.value = "";
  }, [isArabic, toast]);

  const handleSubmit = async () => {
    if (!b64) { toast({ title: isArabic ? "يرجى اختيار صورة أولاً" : "Please select a photo first", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/work-reports"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ imageData: b64, note: note.trim() || undefined }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Upload failed"); }
      toast({ title: isArabic ? "✅ تم رفع التوثيق بنجاح" : "✅ Report submitted" });
      setOpen(false); setPreview(null); setB64(null); setNote("");
      qClient.invalidateQueries({ queryKey: ["work-reports"] });
    } catch (err: any) {
      toast({ title: err.message ?? (isArabic ? "فشل الرفع" : "Upload failed"), variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleClose = () => {
    if (loading) return;
    setOpen(false); setPreview(null); setB64(null); setNote("");
  };

  /* ── Toggle select mode ── */
  const toggleSelectMode = () => {
    setSelectMode(v => !v);
    setSelected(new Set());
  };

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(reports.map((r: any) => r.id)));
  const clearSel  = () => setSelected(new Set());

  /* ── Delete selected ── */
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(isArabic
      ? `هل تريد حذف ${selected.size} تقرير؟`
      : `Delete ${selected.size} report${selected.size > 1 ? "s" : ""}?`)) return;
    setDeleting(true);
    let failed = 0;
    await Promise.all([...selected].map(async id => {
      const res = await authFetch(`/api/work-reports/${id}`, { method: "DELETE" });
      if (!res.ok) failed++;
    }));
    setDeleting(false);
    setSelected(new Set());
    setSelectMode(false);
    qClient.invalidateQueries({ queryKey: ["work-reports"] });
    if (failed === 0) toast({ title: isArabic ? "✅ تم الحذف بنجاح" : "✅ Deleted successfully" });
    else toast({ title: isArabic ? `فشل حذف ${failed} عناصر` : `${failed} items failed to delete`, variant: "destructive" });
  };

  /* ── Delete single ── */
  const deleteSingle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(isArabic ? "حذف هذا التقرير؟" : "Delete this report?")) return;
    const res = await authFetch(`/api/work-reports/${id}`, { method: "DELETE" });
    if (res.ok) {
      qClient.invalidateQueries({ queryKey: ["work-reports"] });
      toast({ title: isArabic ? "✅ تم الحذف" : "✅ Deleted" });
    } else {
      toast({ title: isArabic ? "فشل الحذف" : "Delete failed", variant: "destructive" });
    }
  };

  return (
    <>
      {/* ── Section card ─────────────────────────────────────── */}
      <div className="bg-card border border-card-border rounded-xl" dir={isArabic ? "rtl" : "ltr"}>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">
            {isArabic ? "توثيق العمل" : t("task_documentation")}
          </h2>
          <span className="ms-auto text-xs text-muted-foreground">
            {reports.length} {isArabic ? "تقرير" : "reports"}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Action row */}
          <div className="flex gap-2">
            <Button
              onClick={() => setOpen(true)}
              variant="outline"
              className="flex-1 gap-2 border-dashed"
            >
              <Camera className="w-4 h-4" />
              {isArabic ? "التوثيق اليومي" : t("capture_work_photo")}
            </Button>

            {reports.length > 0 && (
              <Button
                variant={selectMode ? "default" : "outline"}
                size="sm"
                className="gap-1.5 px-3"
                onClick={toggleSelectMode}
              >
                {selectMode
                  ? <><X className="w-3.5 h-3.5" />{isArabic ? "إلغاء" : "Cancel"}</>
                  : <><Trash2 className="w-3.5 h-3.5" />{isArabic ? "حذف" : "Delete"}</>
                }
              </Button>
            )}
          </div>

          {/* Select-mode toolbar */}
          {selectMode && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border">
              <div className="flex items-center gap-2">
                <button
                  onClick={selected.size === reports.length ? clearSel : selectAll}
                  className="text-xs flex items-center gap-1 text-primary"
                >
                  {selected.size === reports.length
                    ? <><CheckSquare className="w-3.5 h-3.5" />{isArabic ? "إلغاء الكل" : "Deselect all"}</>
                    : <><Square className="w-3.5 h-3.5" />{isArabic ? "تحديد الكل" : "Select all"}</>
                  }
                </button>
                {selected.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {isArabic ? `تم تحديد ${selected.size}` : `${selected.size} selected`}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-3 text-xs gap-1.5"
                disabled={selected.size === 0 || deleting}
                onClick={deleteSelected}
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isArabic ? "حذف المحدد" : "Delete selected"}
              </Button>
            </div>
          )}

          {/* Reports grid */}
          {reports.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {displayed.map((r: any) => {
                  const isChecked = selected.has(r.id);
                  return (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectMode ? toggleItem(r.id) : setViewImg(r.imageUrl)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectMode ? toggleItem(r.id) : setViewImg(r.imageUrl);
                        }
                      }}
                      className={`group relative aspect-square rounded-lg overflow-hidden bg-muted border transition-all cursor-pointer ${
                        isChecked
                          ? "border-primary ring-2 ring-primary/50"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img
                        src={r.imageUrl}
                        alt={r.note ?? ""}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                      />

                      {/* Checkbox overlay in select mode */}
                      {selectMode && (
                        <div className={`absolute top-2 start-2 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors pointer-events-none ${
                          isChecked ? "bg-primary border-primary" : "bg-black/40 border-white/70"
                        }`}>
                          {isChecked && <X className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                      )}

                      {/* Delete button (non-select mode, hover) */}
                      {!selectMode && (
                        <button
                          type="button"
                          onClick={(e) => deleteSingle(r.id, e)}
                          className="absolute top-1.5 start-1.5 z-10 w-6 h-6 bg-black/60 hover:bg-red-600 rounded-full items-center justify-center text-white transition-colors opacity-0 group-hover:opacity-100 flex cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Info overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-white text-xs truncate">{r.note}</p>
                        <p className="text-white/70 text-[10px] flex items-center gap-0.5 mt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(r.createdAt), "HH:mm · d/M")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {reports.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs gap-1 text-muted-foreground"
                  onClick={() => setShowAll(v => !v)}
                >
                  {showAll
                    ? <><ChevronUp className="w-3 h-3" />{isArabic ? "عرض أقل" : "Show less"}</>
                    : <><ChevronDown className="w-3 h-3" />{isArabic ? `عرض ${reports.length - 6} أخرى` : `Show ${reports.length - 6} more`}</>
                  }
                </Button>
              )}
            </>
          )}

          {reports.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{isArabic ? "لا توجد تقارير بعد" : "No reports yet"}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Upload dialog ─────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-sm" dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              {isArabic ? "التوثيق اليومي" : t("task_documentation")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image preview / capture area */}
            <div
              className="relative aspect-video rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors"
              onClick={() => cameraRef.current?.click()}
            >
              {preview ? (
                <>
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                  <button
                    onClick={e => { e.stopPropagation(); setPreview(null); setB64(null); }}
                    className="absolute top-2 end-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">
                    {isArabic ? "اضغط للتقاط صورة" : "Tap to capture photo"}
                  </p>
                  <p className="text-xs opacity-60 mt-0.5">
                    {isArabic ? "تستخدم الكاميرا الخلفية تلقائياً" : "Uses rear camera automatically"}
                  </p>
                </div>
              )}
            </div>

            {/* Hidden inputs */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {/* Gallery upload button */}
            {!preview && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => galleryRef.current?.click()}>
                <FolderOpen className="w-4 h-4" />
                {isArabic ? "رفع من الجهاز" : "Upload from Gallery"}
              </Button>
            )}

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {isArabic ? "ملاحظة (اختياري)" : "Note (optional)"}
              </label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={isArabic ? "وصف العمل المنجز..." : "Describe the completed task..."}
                className="h-20 resize-none text-sm"
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground text-end">{note.length}/300</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={loading || !b64} className="gap-2">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isArabic ? "رفع التقرير" : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full-screen image viewer ──────────────────────────── */}
      <Dialog open={!!viewImg} onOpenChange={v => { if (!v) setViewImg(null); }}>
        <DialogContent className="max-w-2xl p-2 bg-black border-0">
          <button
            onClick={closeImage}
            className="absolute top-3 end-3 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
            title="اضغط مرتين للإغلاق"
          >
            <X className="w-4 h-4" />
          </button>
          {viewImg && <img src={viewImg} alt="full" className="w-full rounded object-contain max-h-[80vh]" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
