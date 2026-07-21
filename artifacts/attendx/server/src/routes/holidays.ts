import { Router } from "express";
import { db, holidaysTable } from "../../../db/src/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(holidaysTable).orderBy(holidaysTable.date);
    return res.json(rows.map(r => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAdmin, async (req: any, res) => {
  try {
    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      name: z.string().min(1).max(255),
    });
    const body = schema.parse(req.body);
    const [row] = await db.insert(holidaysTable).values({
      date: body.date,
      name: body.name,
      createdBy: req.userId,
    }).returning();
    return res.status(201).json({
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    });
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      return res.status(409).json({ error: "A holiday already exists on this date" });
    }
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(holidaysTable).where(eq(holidaysTable.id, id));
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
