import { Router } from "express";
import { db, salaryAdvancesTable, usersTable } from "../../../db/src/index.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { createNotification, createNotificationForUser } from "../lib/notify.js";

const router = Router();

/* ── GET /api/salary-advances  (admin sees all, employee sees own) ── */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const rows = await db
      .select({
        id: salaryAdvancesTable.id,
        userId: salaryAdvancesTable.userId,
        userName: usersTable.name,
        amount: salaryAdvancesTable.amount,
        reason: salaryAdvancesTable.reason,
        status: salaryAdvancesTable.status,
        adminNote: salaryAdvancesTable.adminNote,
        reviewedBy: salaryAdvancesTable.reviewedBy,
        reviewedAt: salaryAdvancesTable.reviewedAt,
        deductedPeriod: salaryAdvancesTable.deductedPeriod,
        installments: salaryAdvancesTable.installments,
        createdAt: salaryAdvancesTable.createdAt,
      })
      .from(salaryAdvancesTable)
      .leftJoin(usersTable, eq(salaryAdvancesTable.userId, usersTable.id))
      .orderBy(desc(salaryAdvancesTable.createdAt));

    const result = ["admin","manager"].includes(me?.role ?? "") ? rows : rows.filter((r: any) => r.userId === req.userId);
    return res.json(result.map((r: any) => ({
      ...r,
      reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/salary-advances/:id ── */
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const rows = await db
      .select({
        id: salaryAdvancesTable.id,
        userId: salaryAdvancesTable.userId,
        userName: usersTable.name,
        amount: salaryAdvancesTable.amount,
        reason: salaryAdvancesTable.reason,
        status: salaryAdvancesTable.status,
        adminNote: salaryAdvancesTable.adminNote,
        reviewedBy: salaryAdvancesTable.reviewedBy,
        reviewedAt: salaryAdvancesTable.reviewedAt,
        deductedPeriod: salaryAdvancesTable.deductedPeriod,
        installments: salaryAdvancesTable.installments,
        createdAt: salaryAdvancesTable.createdAt,
      })
      .from(salaryAdvancesTable)
      .leftJoin(usersTable, eq(salaryAdvancesTable.userId, usersTable.id))
      .where(eq(salaryAdvancesTable.id, id))
      .limit(1);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const r = rows[0];
    if (!["admin", "manager"].includes(me?.role ?? "") && (r as any).userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    return res.json({
      ...r,
      reviewedAt: (r as any).reviewedAt instanceof Date ? (r as any).reviewedAt.toISOString() : (r as any).reviewedAt,
      createdAt: (r as any).createdAt instanceof Date ? (r as any).createdAt.toISOString() : (r as any).createdAt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/salary-advances  (employee requests) ── */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      amount: z.number().positive(),
      reason: z.string().optional(),
      installments: z.number().int().min(1).max(365).optional(),
      deductionUnit: z.enum(["month", "day"]).optional(),
    });
    const body = schema.parse(req.body);
    const installments = body.installments ?? 1;
    const deductionUnit = body.deductionUnit ?? "month";
    const [record] = await db.insert(salaryAdvancesTable).values({
      userId: req.userId,
      amount: body.amount,
      reason: body.reason ?? null,
      status: "pending",
      installments,
      deductionUnit,
    }).returning();

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const installmentNote = installments > 1
      ? ` على ${installments} ${deductionUnit === "day" ? "أيام" : "دفعات شهرية"} (${(body.amount / installments).toFixed(2)} لكل ${deductionUnit === "day" ? "يوم" : "دفعة"})`
      : "";
    await createNotification({
      type: "SYSTEM_ALERT",
      title: `💵 طلب سلفة — ${user?.name ?? "موظف"}`,
      message: `طلب الموظف ${user?.name ?? ""} سلفة بمبلغ ${body.amount}${installmentNote}${body.reason ? `. السبب: ${body.reason.slice(0, 80)}` : ""}`,
      relatedId: record.id,
      relatedType: "salary_advance",
    }).catch(console.error);

    return res.status(201).json({
      ...record,
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ── PATCH /api/salary-advances/:id  (admin approves/rejects or edits schedule) ── */
router.patch("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.union([
      // Review (approve/reject)
      z.object({
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().optional(),
        deductedPeriod: z.string().optional(),
        installments: z.number().int().min(1).max(365).optional(),
        deductionUnit: z.enum(["month", "day"]).optional(),
        deductionStartDate: z.string().optional(),
      }),
      // Edit schedule of an already-approved advance
      z.object({
        editSchedule: z.literal(true),
        deductedPeriod: z.string().optional(),
        installments: z.number().int().min(1).max(365),
        deductionUnit: z.enum(["month", "day"]),
        deductionStartDate: z.string().optional(),
        adminNote: z.string().optional(),
      }),
    ]);
    const body = schema.parse(req.body);
    const [existing] = await db.select().from(salaryAdvancesTable).where(eq(salaryAdvancesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });

    let updateValues: Record<string, any>;

    if ("editSchedule" in body && body.editSchedule) {
      // Edit schedule of an approved advance — only update schedule fields
      if (existing.status !== "approved") return res.status(400).json({ error: "Only approved advances can have their schedule edited" });
      updateValues = {
        deductedPeriod: body.deductionUnit === "month" ? (body.deductedPeriod ?? null) : null,
        installments: body.installments,
        deductionUnit: body.deductionUnit,
        deductionStartDate: body.deductionUnit === "day" ? (body.deductionStartDate ?? null) : null,
        adminNote: body.adminNote !== undefined ? (body.adminNote || null) : existing.adminNote,
      };
    } else {
      // Normal approve/reject
      const b = body as Extract<typeof body, { status: string }>;
      updateValues = {
        status: b.status,
        adminNote: b.adminNote ?? null,
        deductedPeriod: b.deductionUnit === "day" ? null : (b.deductedPeriod ?? null),
        installments: b.installments ?? 1,
        deductionUnit: b.deductionUnit ?? "month",
        deductionStartDate: b.deductionUnit === "day" ? (b.deductionStartDate ?? null) : null,
        reviewedBy: req.userId,
        reviewedAt: new Date(),
      };
    }

    const [updated] = await db.update(salaryAdvancesTable).set(updateValues).where(eq(salaryAdvancesTable.id, id)).returning();

    if (!("editSchedule" in body)) {
      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
      const b = body as Extract<typeof body, { status: string }>;
      const statusAr = b.status === "approved" ? "موافقة" : "رفض";
      await createNotification({
        type: "SYSTEM_ALERT",
        title: `${b.status === "approved" ? "✅" : "❌"} ${statusAr} طلب السلفة — ${user?.name ?? ""}`,
        message: `تم ${statusAr} طلب السلفة بمبلغ ${existing.amount}${b.adminNote ? `. ملاحظة: ${b.adminNote}` : ""}`,
        relatedId: updated.id,
        relatedType: "salary_advance",
      }).catch(console.error);
      // Notify the employee directly
      await createNotificationForUser({
        userId: updated.userId,
        type: "SYSTEM_ALERT",
        title: `${b.status === "approved" ? "✅ تمت الموافقة على سلفتك" : "❌ تم رفض طلب السلفة"}`,
        message: `${b.status === "approved" ? "تمت الموافقة على" : "تم رفض"} طلب السلفة بمبلغ ${existing.amount}.${b.adminNote ? ` ملاحظة: ${b.adminNote}` : ""}`,
        relatedId: updated.id,
        relatedType: "salary_advance",
      }).catch(console.error);
    } else {
      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
      await createNotification({
        type: "SYSTEM_ALERT",
        title: `✏️ تعديل جدول سداد السلفة — ${user?.name ?? ""}`,
        message: `تم تعديل جدول سداد السلفة بمبلغ ${existing.amount} إلى ${updated.installments} ${updated.deductionUnit === "day" ? "يوماً" : "شهراً"}`,
        relatedId: updated.id,
        relatedType: "salary_advance",
      }).catch(console.error);
      // Notify the employee about schedule change
      await createNotificationForUser({
        userId: updated.userId,
        type: "SYSTEM_ALERT",
        title: `✏️ تم تعديل جدول سداد سلفتك`,
        message: `تم تعديل جدول سداد السلفة بمبلغ ${existing.amount} إلى ${updated.installments} ${updated.deductionUnit === "day" ? "يوماً" : "شهراً"}.`,
        relatedId: updated.id,
        relatedType: "salary_advance",
      }).catch(console.error);
    }

    return res.json({
      ...updated,
      reviewedAt: updated.reviewedAt instanceof Date ? updated.reviewedAt.toISOString() : updated.reviewedAt,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ── DELETE /api/salary-advances/:id  (employee cancels pending) ── */
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const [existing] = await db.select().from(salaryAdvancesTable).where(eq(salaryAdvancesTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (!["admin", "manager"].includes(me?.role ?? "") && existing.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });
    if (!["admin", "manager"].includes(me?.role ?? "") && existing.status !== "pending") return res.status(400).json({ error: "Cannot cancel a reviewed request" });
    await db.delete(salaryAdvancesTable).where(eq(salaryAdvancesTable.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
