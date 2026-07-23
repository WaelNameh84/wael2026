import { useState, useRef } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useListLocations, useCreateLocation, useDeleteLocation, getListLocationsQueryKey } from "@/lib/api-client/index";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineLoader } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Trash2, Loader2, Navigation, ChevronRight, LocateFixed } from "lucide-react";

const DELETE_W = 82; // px — width of the revealed delete zone
const SNAP_THRESHOLD = 40; // px — minimum swipe to snap open

function LocationCard({
  loc,
  onDelete,
  isDeleting,
  openCardId,
  setOpenCardId,
}: {
  loc: { id: number; name: string; address: string; lat?: number | null; lng?: number | null };
  onDelete: (id: number, name: string) => void;
  isDeleting: boolean;
  openCardId: number | null;
  setOpenCardId: (id: number | null) => void;
}) {
  const isSwipeOpen = openCardId === loc.id;

  const [liveX, setLiveX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);

  const baseX = isSwipeOpen ? -DELETE_W : 0;
  const clampedX = Math.max(-DELETE_W, Math.min(0, baseX + liveX));
  const cardOffset = dragging ? clampedX : isSwipeOpen ? -DELETE_W : 0;

  const openMaps = () => {
    const url =
      loc.lat != null && loc.lng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    setDragging(false);
    setPressed(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (!didSwipe.current && dy > Math.abs(dx) && dy > 6) return;
    if (Math.abs(dx) > 6) {
      didSwipe.current = true;
      setDragging(true);
      setPressed(false);
    }
    if (didSwipe.current) {
      e.preventDefault();
      setLiveX(dx);
    }
  };

  const onTouchEnd = () => {
    setDragging(false);
    setPressed(false);
    if (!didSwipe.current) {
      if (isSwipeOpen) setOpenCardId(null);
      else openMaps();
      setLiveX(0);
      return;
    }
    if (clampedX < -SNAP_THRESHOLD) setOpenCardId(loc.id);
    else setOpenCardId(null);
    setLiveX(0);
  };

  const onMouseDown = () => { didSwipe.current = false; setPressed(true); };
  const onMouseUp   = () => {
    setPressed(false);
    if (!didSwipe.current) { if (isSwipeOpen) setOpenCardId(null); else openMaps(); }
  };

  return (
    <div className="relative select-none" style={{ height: 80 }} data-testid={`row-location-${loc.id}`}>

      {/* ── Delete zone — only receives events when open ── */}
      <div
        className="absolute inset-y-0 end-0 w-[82px] bg-destructive rounded-2xl flex flex-col items-center justify-center gap-1"
        style={{ pointerEvents: isSwipeOpen ? "all" : "none", zIndex: isSwipeOpen ? 30 : 10 }}
      >
        <button
          className="w-full h-full flex flex-col items-center justify-center gap-1 text-white"
          onPointerUp={(e) => { e.stopPropagation(); if (!isDeleting) onDelete(loc.id, loc.name); }}
          onClick={(e) => { e.stopPropagation(); if (!isDeleting) onDelete(loc.id, loc.name); }}
          disabled={isDeleting}
          data-testid={`button-delete-location-${loc.id}`}
        >
          {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          <span className="text-[11px] font-semibold">حذف</span>
        </button>
      </div>

      {/* ── Card face — slides left on swipe, sits above delete zone ── */}
      <div
        className="absolute inset-0 bg-card border border-card-border rounded-2xl flex items-center gap-4 px-4 cursor-pointer"
        style={{
          transform: `translateX(${cardOffset}px) scale(${pressed ? 0.97 : 1})`,
          transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
          boxShadow: pressed ? "0 1px 3px rgba(0,0,0,0.10)" : "0 3px 14px rgba(0,0,0,0.10),0 1px 4px rgba(0,0,0,0.06)",
          zIndex: 20,
          /* when open, let pointer events fall through to delete zone */
          pointerEvents: "all",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setPressed(false)}
        data-testid={`button-maps-location-${loc.id}`}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,var(--primary) 0%,color-mix(in srgb,var(--primary) 70%,#7c3aed) 100%)" }}
        >
          <MapPin className="w-5 h-5 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm leading-tight">{loc.name}</p>
            <LocateFixed className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{loc.address}</p>
          {loc.lat != null && loc.lng != null && (
            <div className="flex items-center gap-1 mt-1">
              <Navigation className="w-3 h-3 text-primary/60" />
              <p className="text-xs text-muted-foreground/60">
                {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
              </p>
            </div>
          )}
        </div>

        <ChevronRight
          className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 transition-transform duration-300"
          style={{ transform: isSwipeOpen ? "rotate(180deg)" : "none" }}
        />
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", lat: "", lng: "" });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openCardId, setOpenCardId] = useState<number | null>(null);

  const { data: locations, isLoading } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const createMut = useCreateLocation();
  const deleteMut = useDeleteLocation();

  const refresh = () => qc.invalidateQueries({ queryKey: getListLocationsQueryKey() });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMut.mutateAsync({
        data: {
          name: form.name,
          address: form.address,
          lat: form.lat ? parseFloat(form.lat) : undefined,
          lng: form.lng ? parseFloat(form.lng) : undefined,
        },
      });
      toast({ title: "Location created" });
      setOpen(false);
      setForm({ name: "", address: "", lat: "", lng: "" });
      refresh();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.data?.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, _name: string) => {
    setDeletingId(id);
    try {
      await deleteMut.mutateAsync({ id });
      setOpenCardId(null);
      toast({ title: "تم حذف الموقع" });
      refresh();
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("locations")}</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-location">
                <Plus className="w-4 h-4" /> {t("add_location")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Location</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 mt-2">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Main Office"
                    data-testid="input-loc-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    required
                    placeholder="123 Business Ave"
                    data-testid="input-loc-address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.lat}
                      onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                      placeholder="59.3293"
                      data-testid="input-loc-lat"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={form.lng}
                      onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                      placeholder="18.0686"
                      data-testid="input-loc-lng"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending} data-testid="button-create-location">
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null} Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <InlineLoader />
        ) : locations?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <MapPin className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No locations yet. Add your first location.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {locations?.map((loc) => (
              <LocationCard
                key={loc.id}
                loc={loc}
                onDelete={handleDelete}
                isDeleting={deletingId === loc.id}
                openCardId={openCardId}
                setOpenCardId={setOpenCardId}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
