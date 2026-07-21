import { Router } from "express";
import { db, announcementsTable, usersTable } from "../../../db/src/index.js";
import { eq, desc, and, or, isNull, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { createNotificationForUser } from "../lib/notify.js";

const router = Router();

function serialize(r: any) {
  return {
    ...r,
    expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : r.expiresAt,
    createdAt:  r.createdAt  instanceof Date ? r.createdAt.toISOString()  : r.createdAt,
  };
}

/**
 * GET /
 * Returns active announcements visible to the current user.
 * Admin: all. Employee: general (no dept) + announcements for their dept.
 */
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const now = new Date();

    let rows = await db.select({
      id:               announcementsTable.id,
      title:            announcementsTable.title,
      body:             announcementsTable.body,
      targetDepartment: announcementsTable.targetDepartment,
      priority:         announcementsTable.priority,
      createdBy:        announcementsTable.createdBy,
      createdByName:    usersTable.name,
      expiresAt:        announcementsTable.expiresAt,
      createdAt:        announcementsTable.createdAt,
    })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
      .orderBy(desc(announcementsTable.createdAt));

    // Filter expired
    rows = rows.filter(r => !r.expiresAt || new Date(r.expiresAt) > now);

    // For employees: only show general (no dept) or their own dept
    if (!["admin", "manager"].includes(me.role)) {
      rows = rows.filter(r =>
        r.targetDepartment === null ||
        r.targetDepartment === "" ||
        r.targetDepartment === me.department
      );
    }

    return res.json(rows.map(serialize));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** GET /all — admin: all including expired */
router.get("/all", requireAdmin, async (req: any, res) => {
  try {
    const rows = await db.select({
      id:               announcementsTable.id,
      title:            announcementsTable.title,
      body:             announcementsTable.body,
      targetDepartment: announcementsTable.targetDepartment,
      priority:         announcementsTable.priority,
      createdBy:        announcementsTable.createdBy,
      createdByName:    usersTable.name,
      expiresAt:        announcementsTable.expiresAt,
      createdAt:        announcementsTable.createdAt,
    })
      .from(announcementsTable)
      .leftJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
      .orderBy(desc(announcementsTable.createdAt));

    return res.json(rows.map(serialize));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/** POST / — admin creates an announcement */
router.post("/", requireAdmin, async (req: any, res) => {
  try {
    const schema = z.object({
      title:            z.string().min(3).max(255),
      body:             z.string().min(5),
      targetDepartment: z.string().optional(),
      priority:         z.enum(["normal", "urgent"]).default("normal"),
      expiresAt:        z.string().optional(), // ISO date string
    });
    const data = schema.parse(req.body);

    const [record] = await db.insert(announcementsTable).values({
      title:            data.title,
      body:             data.body,
      targetDepartment: data.targetDepartment || null,
      priority:         data.priority,
      createdBy:        req.userId,
      expiresAt:        data.expiresAt ? new Date(data.expiresAt) : null,
    }).returning();

    // ── Notify relevant employees ──────────────────────────────────────
    try {
      const targetDept = data.targetDepartment || null;
      let employees = await db
        .select({ id: usersTable.id, department: usersTable.department })
        .from(usersTable)
        .where(eq(usersTable.role, "employee"));

      if (targetDept) {
        employees = employees.filter(e => e.department === targetDept);
      }

      const notifTitle = data.priority === "urgent"
        ? `🔴 إعلان عاجل: ${data.title}`
        : `📢 إعلان جديد: ${data.title}`;

      await Promise.all(
        employees.map(emp =>
          createNotificationForUser({
            userId:      emp.id,
            type:        "ANNOUNCEMENT",
            title:       notifTitle,
            message:     data.body.slice(0, 200),
            relatedId:   record.id,
            relatedType: "announcement",
          })
        )
      );
    } catch (notifErr: any) {
      // Non-fatal — announcement was already saved
      console.error("[announcements] notify employees failed:", notifErr.message);
    }

    return res.status(201).json(serialize(record));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/** PATCH /:id — admin edits */
router.patch("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      title:            z.string().min(3).max(255).optional(),
      body:             z.string().min(5).optional(),
      targetDepartment: z.string().optional().nullable(),
      priority:         z.enum(["normal", "urgent"]).optional(),
      expiresAt:        z.string().optional().nullable(),
    });
    const data = schema.parse(req.body);

    const updatePayload: Record<string, any> = {};
    if (data.title !== undefined)            updatePayload.title            = data.title;
    if (data.body  !== undefined)            updatePayload.body             = data.body;
    if ("targetDepartment" in data)          updatePayload.targetDepartment = data.targetDepartment ?? null;
    if (data.priority !== undefined)         updatePayload.priority         = data.priority;
    if ("expiresAt" in data)                 updatePayload.expiresAt        = data.expiresAt ? new Date(data.expiresAt) : null;

    const [updated] = await db.update(announcementsTable)
      .set(updatePayload)
      .where(eq(announcementsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(serialize(updated));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/** DELETE /:id — admin only */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
