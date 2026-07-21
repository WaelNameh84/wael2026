import { Router } from "express";

const router = Router();

// Server-side reverse geocoding proxy — avoids CSP/CORS restrictions in the browser
router.get("/reverse", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  // ── 1. Try Nominatim (OpenStreetMap) with zoom=16 for neighbourhood-level detail ──
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1&accept-language=ar,en`,
      {
        headers: {
          "User-Agent": "AttendX/1.0 (attendance-management-system)",
          "Accept-Language": "ar,en;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    const d = r.ok ? (await r.json() as any) : null;
    if (d && !d.error) {
      const a = d.address ?? {};

      // Build address from most-specific to least-specific components
      const road       = a.road || a.pedestrian || a.footway || a.highway || a.path || a.residential || a.amenity || a.building || a.shop || a.office;
      const hood       = a.neighbourhood || a.suburb || a.quarter || a.village || a.hamlet || a.municipality;
      const district   = a.city_district || a.district || a.town;
      const city       = a.city || a.county || a.state_district;
      const state      = a.state;

      // Try most detailed first, progressively fall back
      const candidates = [
        [road, hood, city].filter(Boolean),
        [hood, district, city].filter(Boolean),
        [district, city, state].filter(Boolean),
        [city, state].filter(Boolean),
      ];

      for (const parts of candidates) {
        if (parts.length > 0) {
          res.json({ address: parts.join("، ") });
          return;
        }
      }

      // Last resort: use display_name (strip numbers and country code at end)
      if (d.display_name) {
        const parts = (d.display_name as string)
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s && !/^\d+$/.test(s) && s.length > 1)
          .slice(0, 4);
        if (parts.length > 0) {
          res.json({ address: parts.join("، ") });
          return;
        }
      }
    }
  } catch { /* continue */ }

  // ── 2. Try Photon (Komoot — also OpenStreetMap based, no rate limit) ──
  try {
    const r = await fetch(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=ar`,
      {
        headers: { "User-Agent": "AttendX/1.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    const d = r.ok ? (await r.json() as any) : null;
    const feature = d?.features?.[0];
    if (feature) {
      const p = feature.properties ?? {};
      const parts = [p.name, p.street, p.district || p.suburb, p.city || p.town || p.village, p.state]
        .filter((s: any) => typeof s === "string" && s.trim())
        .filter((s, i, arr) => arr.indexOf(s) === i) // deduplicate
        .slice(0, 3);
      if (parts.length > 0) {
        res.json({ address: (parts as string[]).join("، ") });
        return;
      }
    }
  } catch { /* continue */ }

  // ── 3. Try BigDataCloud ──
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ar`,
      { signal: AbortSignal.timeout(10000) }
    );
    const d = r.ok ? (await r.json() as any) : null;
    if (d) {
      // Try locality-level first
      const locality = d.locality || d.city || d.town || d.village || d.principalSubdivision;
      const admins: Array<{ name: string; adminLevel: number }> =
        (d.localityInfo?.administrative ?? [])
          .filter((a: any) => a.name && a.name.trim() && a.adminLevel)
          .sort((a: any, b: any) => b.adminLevel - a.adminLevel);

      const adminNames = admins.slice(0, 2).map((a: any) => a.name);
      const parts = [...new Set([locality, ...adminNames].filter((s): s is string => typeof s === "string" && s.trim().length > 0))].slice(0, 3);
      if (parts.length > 0) {
        res.json({ address: parts.join("، ") });
        return;
      }
    }
  } catch { /* continue */ }

  // ── 4. All APIs failed — return null so client can display formatted coordinates ──
  res.json({ address: null });
});

export default router;
