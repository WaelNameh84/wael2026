import { useState } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useListLocations, useCreateLocation, useDeleteLocation, getListLocationsQueryKey } from "@/lib/api-client/index";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Trash2, Loader2, Navigation, ChevronRight } from "lucide-react";

function LocationCard({
  loc,
  onDelete,
  isDeleting,
}: {
  loc: { id: number; name: string; address: string; lat?: number | null; lng?: number | null };
  onDelete: (id: number, name: string) => void;
  isDeleting: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const openMaps = () => {
    const url =
      loc.lat != null && loc.lng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handlePressStart = () => setPressed(true);
  const handlePressEnd = () => {
    setPressed(false);
    openMaps();
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden select-none"
      style={{
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      data-testid={`row-location-${loc.id}`}
    >
      {/* Card background */}
      <div
        className="absolute inset-0 rounded-2xl bg-card border border-card-border"
        style={{
          boxShadow: pressed
            ? "0 1px 3px rgba(0,0,0,0.10)"
            : "0 3px 14px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
          transition: "box-shadow 0.12s ease",
        }}
      />

      {/* Tappable area */}
      <div
        className="relative flex items-center gap-4 px-4 py-4 cursor-pointer"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        data-testid={`button-maps-location-${loc.id}`}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, #7c3aed) 100%)" }}
        >
          <MapPin className="w-5 h-5 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{loc.name}</p>
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

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
      </div>

      {/* Delete button — sits outside the tappable area */}
      <button
        className="absolute top-2 end-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity bg-destructive/10 hover:bg-destructive/20 text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(loc.id, loc.name);
        }}
        disabled={isDeleting}
        data-testid={`button-delete-location-${loc.id}`}
        title="Delete"
      >
        {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </button>
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

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeletingId(id);
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: "Location deleted" });
      refresh();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
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
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
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
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
