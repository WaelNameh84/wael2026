import { Router, type Request, type Response } from "express";
import { mkdirSync, existsSync, readFileSync } from "fs";
import path from "path";
import { requireAuth } from "./auth.js";
import { uploadBase64Image, isCloudinaryEnabled } from "../lib/objectStorage.js";

const router = Router();
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post("/uploads", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ error: "fileName and fileData are required" });
    }

    if (isCloudinaryEnabled()) {
      // Upload to Cloudinary and return the public URL
      const url = await uploadBase64Image(fileData, "attendx");
      return res.json({ path: url, name: fileName });
    }

    // Fallback: store base64 in DB (no external service configured)
    return res.json({ path: fileData, name: fileName });
  } catch (err: any) {
    console.error("[uploads] upload error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/uploads/:filename", async (req: Request, res: Response) => {
  try {
    const filename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    if (!filename || filename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const data = readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    res.setHeader("Content-Type", mimeMap[ext] ?? "application/octet-stream");
    return res.send(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
