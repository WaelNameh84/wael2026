/**
 * objectStorage.ts — Image upload dispatcher
 * Priority: Cloudinary > Local filesystem fallback
 */
import { createHash, randomUUID } from "crypto";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

export function isObjectStorageEnabled(): boolean {
  return false;
}

export function isCloudinaryEnabled(): boolean {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

export async function uploadBase64Image(base64Data: string, folder = "uploads"): Promise<string> {
  if (isCloudinaryEnabled()) {
    return uploadToCloudinary(base64Data, folder);
  }
  return saveLocalImage(base64Data);
}

async function uploadToCloudinary(base64Data: string, folder: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramStr = `folder=${folder}&timestamp=${timestamp}`;
  const signature = createHash("sha1").update(paramStr + apiSecret).digest("hex");

  const formData = new FormData();
  formData.append("file", `data:image/jpeg;base64,${base64Data}`);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("folder", folder);
  formData.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
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
  const filename = `${randomUUID()}.jpg`;
  writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64Data, "base64"));
  return `/api/uploads/${filename}`;
}

export async function getSignedUrl(_path: string): Promise<string> {
  return "";
}
