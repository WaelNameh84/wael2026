import { Router, type Request, type Response } from "express";
import { requireAuth } from "./auth.js";
import { storeImage } from "../lib/store-image.js";

const router = Router();

/**
 * POST /api/uploads
 * Accepts { fileName, fileData } where fileData is a base64 data URL.
 * Tries Cloudinary first (if configured); on failure or no config, returns
 * the data URL directly so it can be stored in the database — disk files
 * are ephemeral on platforms like Render and cause broken images after restarts.
 */
router.post("/uploads", requireAuth, async (req: Request, res: Response) => {
  try {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ error: "fileName and fileData are required" });
    }

    // storeImage tries Cloudinary first; falls back to PostgreSQL image_store table.
    // No disk files — images survive server restarts and redeploys.
    const url = await storeImage(fileData, "attendx");
    return res.json({ path: url, name: fileName });
  } catch (err: any) {
    console.error("[uploads] upload error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
