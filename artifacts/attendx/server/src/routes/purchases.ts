import { Router } from "express";
import { db, purchasesTable, usersTable } from "../../../db/src/index.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { createNotification } from "../lib/notify.js";

const router = Router();

const CATEGORY_LABEL_AR: Record<string, string> = {
  clothes: "ملابس",
  equipment: "معدات",
  other: "أخرى",
};

/* ── GET /api/purchases  (admin sees all, employee sees own) ── */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const rows = await db
      .select({
        id: purchasesTable.id,
        userId: purchasesTable.userId,
        userName: usersTable.name,
        category: purchasesTable.category,
        itemLabel: purchasesTable.itemLabel,
        description: purchasesTable.description,
        amount: purchasesTable.amount,
        receiptUrl: purchasesTable.receiptUrl,
        period: purchasesTable.period,
        createdAt: purchasesTable.createdAt,
      })
      .from(purchasesTable)
      .leftJoin(usersTable, eq(purchasesTable.userId, usersTable.id))
      .orderBy(desc(purchasesTable.createdAt));

    const { userId, period } = req.query as any;
    let result = ["admin","manager"].includes(me?.role ?? "") ? rows : rows.filter((r: any) => r.userId === req.userId);
    if (["admin","manager"].includes(me?.role ?? "") && userId) result = result.filter((r: any) => r.userId === parseInt(userId));
    if (period) result = result.filter((r: any) => r.period === period);

    return res.json(result.map((r: any) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/purchases  (employee submits a purchase — auto-added to salary) ── */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      category: z.enum(["clothes", "equipment", "other"]),
      customLabel: z.string().trim().max(255).optional(),
      description: z.string().trim().max(1000).optional(),
      amount: z.number().positive(),
      receiptUrl: z.string().optional(),
      period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }).refine(d => d.category !== "other" || (d.customLabel && d.customLabel.length > 0), {
      message: "customLabel is required when category is 'other'",
      path: ["customLabel"],
    });
    const body = schema.parse(req.body);

    const itemLabel = body.category === "other"
      ? body.customLabel!.trim()
      : (CATEGORY_LABEL_AR[body.category] ?? body.category);

    const period = body.period ?? new Date().toISOString().slice(0, 7);

    const [record] = await db.insert(purchasesTable).values({
      userId: req.userId,
      category: body.category,
      itemLabel,
      description: body.description ?? null,
      amount: body.amount,
      receiptUrl: body.receiptUrl ?? null,
      period,
    }).returning();

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    createNotification({
      type: "SYSTEM_ALERT",
      title: `🧾 مشتريات جديدة — ${user?.name ?? ""}`,
      message: `سجّل الموظف ${user?.name ?? ""} عملية شراء "${itemLabel}" بمبلغ ${body.amount}. تمت إضافتها تلقائياً لراتب ${period}.`,
      relatedId: record.id,
      relatedType: "purchase",
    }).catch(console.error);

    return res.status(201).json({
      ...record,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ── GET /api/purchases/:id ── */
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const [row] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (!["admin", "manager"].includes(me?.role ?? "") && row.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    return res.json({ ...row, createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /api/purchases/:id  (owner or admin) ── */
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const [existing] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!["admin", "manager"].includes(me?.role ?? "") && existing.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    await db.delete(purchasesTable).where(eq(purchasesTable.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
