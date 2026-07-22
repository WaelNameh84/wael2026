/**
 * GET /api/images/:id
 *
 * Serves an image stored in the image_store table.
 * Returns binary data with the stored MIME type and long-term caching headers
 * so browsers only fetch each image once.
 */

import { Router, type Request, type Response } from "express";
import { db, imageStoreTable } from "../../../db/src/index.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/images/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  try {
    if (isNaN(id) || id <= 0) return res.status(400).send("Invalid id");

    const [row] = await db
      .select({ data: imageStoreTable.data, mimeType: imageStoreTable.mimeType })
      .from(imageStoreTable)
      .where(eq(imageStoreTable.id, id))
      .limit(1);

    if (!row) {
      console.error(`[images] id=${id} not found in image_store`);
      return res.status(404).send("Image not found");
    }

    if (!row.data) {
      console.error(`[images] id=${id} has empty data`);
      return res.status(500).send("Image data is empty");
    }

    const buf = Buffer.from(row.data, "base64");
    const mime = row.mimeType || "image/jpeg";

    // Remove Content-Security-Policy for image responses — it is set globally
    // for HTML pages but should not block binary image data served from /api/images/*.
    res.removeHeader("Content-Security-Policy");

    res.setHeader("Content-Type", mime);
    // Images stored in the DB are immutable — allow aggressive browser caching.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", buf.byteLength);
    // Use res.end() for raw binary to avoid any Express body transformation
    res.end(buf);
    return;
  } catch (err: any) {
    console.error(`[images] error serving id=${id}:`, err?.message ?? err);
    return res.status(500).send("Server error");
  }
});

export default router;
