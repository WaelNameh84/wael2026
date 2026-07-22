import { Router } from "express";
import { db, workReportsTable, usersTable } from "../../../db/src/index.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./auth.js";
import { createNotification } from "../lib/notify.js";
import { storeImage } from "../lib/store-image.js";

const router = Router();

/* ─── Routes ─────────────────────────────────────────────── */

/**
 * POST /api/work-reports
 * Body: { imageData: string (base64, no prefix), note?: string }
 */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const { imageData, note } = req.body as { imageData: string; note?: string };
    if (!imageData) return res.status(400).json({ error: "imageData is required" });

    // Validate that the payload is actually an image by inspecting magic bytes.
    // This prevents non-image data from being stored even though the field is base64.
    try {
      const headerBuf = Buffer.from(imageData.slice(0, 16), "base64");
      const isJpeg = headerBuf[0] === 0xff && headerBuf[1] === 0xd8;
      const isPng  = headerBuf[0] === 0x89 && headerBuf[1] === 0x50 && headerBuf[2] === 0x4e && headerBuf[3] === 0x47;
      const isWebp = headerBuf.slice(8, 12).toString("ascii") === "WEBP";
      const isGif  = headerBuf.slice(0, 6).toString("ascii").startsWith("GIF");
      if (!isJpeg && !isPng && !isWebp && !isGif) {
        return res.status(400).json({ error: "imageData must be a valid image (JPEG, PNG, WebP, or GIF)" });
      }
    } catch {
      return res.status(400).json({ error: "imageData is not valid base64" });
    }

    const imageUrl = await storeImage(imageData, "work_reports");

    const [report] = await db
      .insert(workReportsTable)
      .values({ userId: req.userId, imageUrl, note: note?.trim() || null })
      .returning();

    const [me] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    await createNotification({
      type: "SYSTEM_ALERT",
      title: "📷 توثيق عمل جديد",
      message: `رفع الموظف ${me?.name ?? req.userId} تقرير توثيق جديد${note ? `: ${note.slice(0, 80)}` : ""}`,
      relatedId: report.id,
      relatedType: "work_report",
    });

    return res.status(201).json({
      ...report,
      createdAt: report.createdAt instanceof Date ? report.createdAt.toISOString() : report.createdAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/work-reports
 * Admin sees all; employee sees own only
 */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const isAdmin = me?.role === "admin" || me?.role === "manager";

    const rows = await db
      .select({
        id:           workReportsTable.id,
        userId:       workReportsTable.userId,
        employeeName: usersTable.name,
        imageUrl:     workReportsTable.imageUrl,
        note:         workReportsTable.note,
        createdAt:    workReportsTable.createdAt,
      })
      .from(workReportsTable)
      .innerJoin(usersTable, eq(workReportsTable.userId, usersTable.id))
      .orderBy(desc(workReportsTable.createdAt));

    const filtered = isAdmin ? rows : rows.filter((r: any) => r.userId === req.userId);

    return res.json(
      filtered.map((r: any) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/work-reports/:id  (admin or report owner)
 */
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const rows = await db
      .select({
        id:           workReportsTable.id,
        userId:       workReportsTable.userId,
        employeeName: usersTable.name,
        imageUrl:     workReportsTable.imageUrl,
        note:         workReportsTable.note,
        createdAt:    workReportsTable.createdAt,
      })
      .from(workReportsTable)
      .innerJoin(usersTable, eq(workReportsTable.userId, usersTable.id))
      .where(eq(workReportsTable.id, id))
      .limit(1);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const r = rows[0];
    if (!["admin", "manager"].includes(me?.role ?? "") && r.userId !== req.userId) return res.status(403).json({ error: "Access denied" });
    return res.json({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/work-reports/mine  (employee deletes ALL own reports)
 */
router.delete("/mine", requireAuth, async (req: any, res) => {
  try {
    await db.delete(workReportsTable).where(eq(workReportsTable.userId, req.userId));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/work-reports/:id  (admin or report owner)
 */
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const id = parseInt(req.params.id);
    const [report] = await db.select().from(workReportsTable).where(eq(workReportsTable.id, id)).limit(1);
    if (!report) return res.status(404).json({ error: "Not found" });
    if (!["admin", "manager"].includes(me?.role ?? "") && report.userId !== req.userId) return res.status(403).json({ error: "Access denied" });
    await db.delete(workReportsTable).where(eq(workReportsTable.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
