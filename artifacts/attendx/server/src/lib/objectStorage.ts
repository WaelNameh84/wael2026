/**
 * objectStorage.ts — Image upload dispatcher
 * Priority: DB config (Settings page) > env vars > local filesystem fallback
 */
import { createHash, randomUUID } from "crypto";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { getCloudinaryConfig } from "./gemini-config.js";

interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function parseCloudinaryCredentials(): CloudinaryCredentials | null {
  // Priority 1: DB-stored config (entered via Settings UI)
  const dbCfg = getCloudinaryConfig();
  if (dbCfg.cloudName && dbCfg.apiKey && dbCfg.apiSecret) {
    return { cloudName: dbCfg.cloudName, apiKey: dbCfg.apiKey, apiSecret: dbCfg.apiSecret };
  }

  // Priority 2: single CLOUDINARY_URL  e.g. cloudinary://key:secret@cloud_name
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
  }

  // Priority 3: individual env vars (with or without CLOUDINARY_ prefix)
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY    || process.env.API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };

  return null;
}

export function isObjectStorageEnabled(): boolean { return false; }

export function isCloudinaryEnabled(): boolean {
  return parseCloudinaryCredentials() !== null;
}

export async function uploadBase64Image(base64Data: string, folder = "uploads"): Promise<string> {
  const creds = parseCloudinaryCredentials();
  if (creds) return uploadToCloudinary(base64Data, folder, creds);
  return saveLocalImage(base64Data);
}

async function uploadToCloudinary(
  base64Data: string,
  folder: string,
  creds: CloudinaryCredentials
): Promise<string> {
  const { cloudName, apiKey, apiSecret } = creds;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const mimeMatch = base64Data.match(/^data:([^;]+);base64,/);
  const mimeType  = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const paramStr  = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(paramStr + apiSecret).digest("hex");

  const formData = new FormData();
  formData.append("file", `data:${mimeType};base64,${cleanBase64}`);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("folder", folder);
  formData.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }
  const json = (await res.json()) as any;
  return json.secure_url as string;
}

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

function saveLocalImage(base64Data: string): string {
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const filename = `${randomUUID()}.jpg`;
  writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(cleanBase64, "base64"));
  return `/api/uploads/${filename}`;
}

export async function getSignedUrl(_path: string): Promise<string> { return ""; }
