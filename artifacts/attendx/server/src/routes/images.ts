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
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) return res.status(400).send("Invalid id");

    const [row] = await db
      .select({ data: imageStoreTable.data, mimeType: imageStoreTable.mimeType })
      .from(imageStoreTable)
      .where(eq(imageStoreTable.id, id))
      .limit(1);

    if (!row) return res.status(404).send("Image not found");

    const buf = Buffer.from(row.data, "base64");

    res.setHeader("Content-Type", row.mimeType);
    // Images stored in the DB are immutable — allow aggressive browser caching.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", buf.byteLength.toString());
    return res.send(buf);
  } catch (err: any) {
    return res.status(500).send("Server error");
  }
});

export default router;
