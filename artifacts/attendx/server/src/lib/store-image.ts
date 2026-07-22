/**
 * store-image.ts — Unified image storage helper
 *
 * Priority: Cloudinary (if configured) → PostgreSQL image_store table
 *
 * The PostgreSQL fallback stores the raw base64 in the image_store table
 * and returns a /api/images/:id URL.  This is served by GET /api/images/:id
 * with proper Content-Type and long-term caching headers.
 *
 * This approach:
 *   - Requires no disk (ephemeral filesystems on Render/Heroku are unreliable)
 *   - Avoids embedding large data URIs in JSON API responses
 *   - Lets browsers cache images normally via URL
 */

import { createHash } from "crypto";
import { db, imageStoreTable } from "../../../db/src/index.js";
import { getCloudinaryConfig } from "./gemini-config.js";

// ── MIME detection from raw base64 ──────────────────────────────────────────

export function detectMimeFromBase64(raw: string): string {
  try {
    const buf = Buffer.from(raw.slice(0, 12), "base64");
    if (buf[0] === 0xff && buf[1] === 0xd8)                       return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50)                       return "image/png";
    if (buf.slice(8, 12).toString("ascii") === "WEBP")            return "image/webp";
    if (buf.slice(0, 6).toString("ascii").startsWith("GIF"))      return "image/gif";
  } catch { /* ignore */ }
  return "image/jpeg";
}

// ── Cloudinary ───────────────────────────────────────────────────────────────

function cloudinaryCreds() {
  const db = getCloudinaryConfig();
  if (db.cloudName && db.apiKey && db.apiSecret)
    return { cloudName: db.cloudName, apiKey: db.apiKey, apiSecret: db.apiSecret };

  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (m) return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }

  const cn = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
  const ak = process.env.CLOUDINARY_API_KEY    || process.env.API_KEY;
  const as = process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET;
  if (cn && ak && as) return { cloudName: cn, apiKey: ak, apiSecret: as };

  return null;
}

async function uploadToCloudinary(
  base64Data: string,
  folder: string,
): Promise<string> {
  const creds = cloudinaryCreds();
  if (!creds) throw new Error("Cloudinary not configured");

  const { cloudName, apiKey, apiSecret } = creds;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramStr  = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(paramStr + apiSecret).digest("hex");

  // Strip existing data: prefix if present
  const cleanB64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const mime     = detectMimeFromBase64(cleanB64);

  const form = new FormData();
  form.append("file",      `data:${mime};base64,${cleanB64}`);
  form.append("api_key",   apiKey);
  form.append("timestamp", timestamp);
  form.append("folder",    folder);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error(`Cloudinary: ${await res.text()}`);
  return ((await res.json()) as any).secure_url as string;
}

// ── PostgreSQL fallback ──────────────────────────────────────────────────────

async function storeInDatabase(base64Data: string): Promise<string> {
  const cleanB64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const mimeType = detectMimeFromBase64(cleanB64);

  const [row] = await db
    .insert(imageStoreTable)
    .values({ data: cleanB64, mimeType })
    .returning({ id: imageStoreTable.id });

  return `/api/images/${row.id}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload an image and return a stable URL.
 *
 * @param base64Data  Raw base64 string (with or without data: prefix).
 * @param folder      Cloudinary folder name (ignored for DB fallback).
 * @returns           A stable URL: either a Cloudinary https:// URL or /api/images/:id.
 */
export async function storeImage(
  base64Data: string,
  folder = "uploads",
): Promise<string> {
  const creds = cloudinaryCreds();
  if (creds) {
    try {
      return await uploadToCloudinary(base64Data, folder);
    } catch (err) {
      console.warn("[store-image] Cloudinary failed, falling back to DB:", (err as Error).message);
    }
  }
  return storeInDatabase(base64Data);
}
