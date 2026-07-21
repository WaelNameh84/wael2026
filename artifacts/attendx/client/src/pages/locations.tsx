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
import { Plus, MapPin, Trash2, Loader2, ExternalLink } from "lucide-react";

export default function LocationsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", lat: "", lng: "" });

  const { data: locations, isLoading } = useListLocations({ query: { queryKey: getListLocationsQueryKey() } });
  const createMut = useCreateLocation();
  const deleteMut = useDeleteLocation();

  const refresh = () => qc.invalidateQueries({ queryKey: getListLocationsQueryKey() });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMut.mutateAsync({ data: {
        name: form.name,
        address: form.address,
        lat: form.lat ? parseFloat(form.lat) : undefined,
        lng: form.lng ? parseFloat(form.lng) : undefined,
      }});
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
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: "Location deleted" });
      refresh();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("locations")}</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-location"><Plus className="w-4 h-4" /> {t("add_location")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 mt-2">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Main Office" data-testid="input-loc-name" /></div>
                <div className="space-y-1"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required placeholder="123 Business Ave" data-testid="input-loc-address" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Latitude</Label><Input type="number" step="any" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} placeholder="59.3293" data-testid="input-loc-lat" /></div>
                  <div className="space-y-1"><Label>Longitude</Label><Input type="number" step="any" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} placeholder="18.0686" data-testid="input-loc-lng" /></div>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending} data-testid="button-create-location">
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null} Create
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : locations?.map(loc => (
            <div key={loc.id} className="px-5 py-4 flex items-center gap-4" data-testid={`row-location-${loc.id}`}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{loc.address}</p>
                {(loc.lat != null && loc.lng != null) && (
                  <p className="text-xs text-muted-foreground/60">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const url = (loc.lat != null && loc.lng != null)
                    ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                title="Open in Google Maps"
                data-testid={`button-maps-location-${loc.id}`}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(loc.id, loc.name)} data-testid={`button-delete-location-${loc.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {locations?.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No locations yet. Add your first location.</p>}
        </div>
      </div>
    </Layout>
  );
}
