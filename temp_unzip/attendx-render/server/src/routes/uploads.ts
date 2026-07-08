import { Router, type Request, type Response } from "express";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "./auth.js";

const router = Router();
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post("/uploads", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileName, contentType, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ error: "fileName and fileData are required" });
    }
    const ext = path.extname(fileName) || "";
    const id = randomUUID();
    const saveName = `${id}${ext}`;
    const savePath = path.join(UPLOADS_DIR, saveName);
    const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
    writeFileSync(savePath, Buffer.from(base64Data, "base64"));
    return res.json({ path: `/api/uploads/${saveName}`, name: fileName });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/uploads/:filename", async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
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
