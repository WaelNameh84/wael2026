import { Router } from "express";
import {
  db, attendanceCorrectionsTable, usersTable, attendanceTable,
} from "../../../db/src/index.js";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { createNotification, createNotificationForUser } from "../lib/notify.js";

const router = Router();

function serializeRow(r: any) {
  return {
    ...r,
    reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt,
    createdAt:  r.createdAt  instanceof Date ? r.createdAt.toISOString()  : r.createdAt,
  };
}

/** GET / — admin: all; employee: own */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);

    const rows = await db.select({
      id:                attendanceCorrectionsTable.id,
      userId:            attendanceCorrectionsTable.userId,
      userName:          usersTable.name,
      attendanceId:      attendanceCorrectionsTable.attendanceId,
      date:              attendanceCorrectionsTable.date,
      requestedCheckIn:  attendanceCorrectionsTable.requestedCheckIn,
      requestedCheckOut: attendanceCorrectionsTable.requestedCheckOut,
      reason:            attendanceCorrectionsTable.reason,
      status:            attendanceCorrectionsTable.status,
      adminNote:         attendanceCorrectionsTable.adminNote,
      reviewedBy:        attendanceCorrectionsTable.reviewedBy,
      reviewedAt:        attendanceCorrectionsTable.reviewedAt,
      createdAt:         attendanceCorrectionsTable.createdAt,
    })
      .from(attendanceCorrectionsTable)
      .leftJoin(usersTable, eq(attendanceCorrectionsTable.userId, usersTable.id))
      .where(["admin","manager"].includes(me.role) ? undefined : eq(attendanceCorrectionsTable.userId, req.userId))
      .orderBy(desc(attendanceCorrectionsTable.createdAt));

    return res.json(rows.map(serializeRow));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /:id — single correction */
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const [row] = await db.select({
      id:                attendanceCorrectionsTable.id,
      userId:            attendanceCorrectionsTable.userId,
      userName:          usersTable.name,
      attendanceId:      attendanceCorrectionsTable.attendanceId,
      date:              attendanceCorrectionsTable.date,
      requestedCheckIn:  attendanceCorrectionsTable.requestedCheckIn,
      requestedCheckOut: attendanceCorrectionsTable.requestedCheckOut,
      reason:            attendanceCorrectionsTable.reason,
      status:            attendanceCorrectionsTable.status,
      adminNote:         attendanceCorrectionsTable.adminNote,
      reviewedBy:        attendanceCorrectionsTable.reviewedBy,
      reviewedAt:        attendanceCorrectionsTable.reviewedAt,
      createdAt:         attendanceCorrectionsTable.createdAt,
    })
      .from(attendanceCorrectionsTable)
      .leftJoin(usersTable, eq(attendanceCorrectionsTable.userId, usersTable.id))
      .where(eq(attendanceCorrectionsTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Not found" });
    if (!["admin", "manager"].includes(me.role) && row.userId !== req.userId)
      return res.status(403).json({ error: "Forbidden" });

    return res.json(serializeRow(row));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST / — employee submits a correction request */
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      attendanceId:      z.number().int().optional(),
      requestedCheckIn:  z.string().regex(/^\d{2}:\d{2}$/).optional(),
      requestedCheckOut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      reason:            z.string().min(5).max(1000),
    });
    const body = schema.parse(req.body);

    if (!body.requestedCheckIn && !body.requestedCheckOut)
      return res.status(400).json({ error: "At least one of requestedCheckIn or requestedCheckOut is required" });

    const [record] = await db.insert(attendanceCorrectionsTable).values({
      userId:            req.userId,
      attendanceId:      body.attendanceId ?? null,
      date:              body.date,
      requestedCheckIn:  body.requestedCheckIn ?? null,
      requestedCheckOut: body.requestedCheckOut ?? null,
      reason:            body.reason,
      status:            "pending",
    }).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    createNotification({
      type:        "SYSTEM_ALERT",
      title:       `طلب تصحيح حضور: ${user?.name ?? "موظف"}`,
      message:     `${user?.name ?? "موظف"} يطلب تصحيح سجل الحضور بتاريخ ${body.date}. السبب: ${body.reason}`,
      relatedId:   record.id,
      relatedType: "attendance_correction",
    }).catch(console.error);

    return res.status(201).json(serializeRow(record));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/** PATCH /:id — admin approve / reject */
router.patch("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      status:    z.enum(["approved", "rejected"]),
      adminNote: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const [existing] = await db.select().from(attendanceCorrectionsTable)
      .where(eq(attendanceCorrectionsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const [updated] = await db.update(attendanceCorrectionsTable)
      .set({ status: body.status, adminNote: body.adminNote ?? null, reviewedBy: req.userId, reviewedAt: new Date() })
      .where(eq(attendanceCorrectionsTable.id, id))
      .returning();

    // If approved — apply the correction to the attendance record
    if (body.status === "approved" && existing.attendanceId) {
      const updatePayload: Record<string, any> = {};
      if (existing.requestedCheckIn) {
        const [h, m] = existing.requestedCheckIn.split(":").map(Number);
        const ci = new Date(existing.date + "T00:00:00.000Z");
        ci.setUTCHours(h, m, 0, 0);
        updatePayload.checkIn = ci;
      }
      if (existing.requestedCheckOut) {
        const [h, m] = existing.requestedCheckOut.split(":").map(Number);
        const co = new Date(existing.date + "T00:00:00.000Z");
        co.setUTCHours(h, m, 0, 0);
        updatePayload.checkOut = co;
      }
      if (Object.keys(updatePayload).length > 0) {
        await db.update(attendanceTable).set(updatePayload)
          .where(eq(attendanceTable.id, existing.attendanceId));
      }
    }

    // Notify admin panel
    const statusAr = body.status === "approved" ? "✅ موافق عليه" : "❌ مرفوض";
    createNotification({
      type:        "SYSTEM_ALERT",
      title:       `تصحيح الحضور — ${statusAr}`,
      message:     `تم ${body.status === "approved" ? "الموافقة على" : "رفض"} طلب تصحيح سجل الحضور بتاريخ ${existing.date}.${body.adminNote ? ` ملاحظة: ${body.adminNote}` : ""}`,
      relatedId:   id,
      relatedType: "attendance_correction",
    }).catch(console.error);

    // Notify the employee directly
    createNotificationForUser({
      userId:      existing.userId,
      type:        "SYSTEM_ALERT",
      title:       `طلب تصحيح الحضور — ${statusAr}`,
      message:     `تم ${body.status === "approved" ? "الموافقة على" : "رفض"} طلب تصحيح حضورك بتاريخ ${existing.date}.${body.adminNote ? ` ملاحظة: ${body.adminNote}` : ""}`,
      relatedId:   id,
      relatedType: "attendance_correction",
    }).catch(console.error);

    return res.json(serializeRow(updated));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/** DELETE /:id — admin only */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(attendanceCorrectionsTable).where(eq(attendanceCorrectionsTable.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
