import { Router } from "express";
import {
  db, usersTable, userSettingsTable, attendanceTable, leaveTable,
  salaryAdvancesTable, bonusesTable, payrollReportsTable, purchasesTable,
  requestsTable, workReportsTable, lateJustificationsTable,
  attendanceCorrectionsTable, notificationsTable,
  announcementsTable, messagesTable,
} from "../../../db/src/index.js";
import { eq, isNotNull, or, ilike, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { createNotification } from "../lib/notify.js";
import crypto from "crypto";

function httpStatus(err: any): number {
  if (err?.statusCode)          return err.statusCode;
  if (err?.name === "ZodError") return 400;
  if (err?.code === "23505")    return 409;
  if (err?.code === "23503")    return 400;
  return 500;
}

function parseId(s: string): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw Object.assign(new Error("Invalid ID"), { statusCode: 400 });
  }
  return n;
}

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "attendance_salt_2024").digest("hex");
}

router.get("/", requireAuth, async (req: any, res) => {
  try {
    const { search, role } = req.query as { search?: string; role?: string };

    // حدد الصلاحية: admin/manager يشوفون كل شيء، الموظف يشوف بيانات أساسية فقط
    const [me] = await db.select({ role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const isPrivileged = me && ["admin", "manager"].includes(me.role);

    // Build SQL WHERE conditions — filter in the DB, not in JS
    const conds: any[] = [];
    if (search) {
      const pattern = `%${search}%`;
      conds.push(or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern)));
    }
    if (role) conds.push(eq(usersTable.role, role));
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const users = isPrivileged
      ? await db.select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          department: usersTable.department,
          position: usersTable.position,
          phone: usersTable.phone,
          avatarUrl: usersTable.avatarUrl,
          workHoursPerDay: usersTable.workHoursPerDay,
          workStartTime: usersTable.workStartTime,
          workEndTime: usersTable.workEndTime,
          breakMinutes: usersTable.breakMinutes,
          salary: usersTable.salary,
          contractType: usersTable.contractType,
          transportAllowance: usersTable.transportAllowance,
          housingAllowance: usersTable.housingAllowance,
          birthDate: usersTable.birthDate,
          contractEndDate: usersTable.contractEndDate,
          isApproved: usersTable.isApproved,
          createdAt: usersTable.createdAt,
        }).from(usersTable).where(whereClause)
      : await db.select({
          // الموظف العادي: بيانات أساسية فقط — بدون راتب أو بدلات أو تفاصيل مالية
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          department: usersTable.department,
          position: usersTable.position,
          avatarUrl: usersTable.avatarUrl,
          isApproved: usersTable.isApproved,
        }).from(usersTable).where(whereClause);

    return res.json(users);
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

router.post("/", requireAdmin, async (req: any, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["admin", "manager", "employee"]).default("employee"),
      department: z.string().optional(),
      position: z.string().optional(),
      phone: z.string().optional(),
      workHoursPerDay: z.number().optional().default(8),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      workEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      breakMinutes: z.number().min(0).optional().default(0),
      salary: z.number().optional(),
      contractType: z.enum(["monthly", "daily"]).optional().default("monthly"),
      transportAllowance: z.number().min(0).optional().default(0),
      housingAllowance: z.number().min(0).optional().default(0),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      contractEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    });
    const body = schema.parse(req.body);
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, body.email.trim().toLowerCase())).limit(1);
    if (existing) return res.status(400).json({ error: "البريد الإلكتروني مسجّل مسبقاً" });
    const [user] = await db.insert(usersTable).values({
      name: body.name,
      email: body.email,
      passwordHash: hashPassword(body.password),
      role: body.role,
      department: body.department,
      position: body.position,
      phone: body.phone,
      workHoursPerDay: body.workHoursPerDay ?? 8,
      workStartTime: body.workStartTime ?? null,
      workEndTime: body.workEndTime ?? null,
      breakMinutes: body.breakMinutes ?? 0,
      salary: body.salary,
      contractType: body.contractType ?? "monthly",
      transportAllowance: body.transportAllowance ?? 0,
      housingAllowance: body.housingAllowance ?? 0,
      birthDate: body.birthDate,
      contractEndDate: body.contractEndDate,
      isApproved: true,
    }).returning();
    await db.insert(userSettingsTable).values({ userId: user.id }).onConflictDoNothing();
    await createNotification({
      type: "SYSTEM_ALERT",
      title: `✅ تم إضافة موظف جديد — ${body.name}`,
      message: `تم إنشاء حساب للموظف ${body.name} (${body.email}) وهو جاهز لتسجيل الدخول.`,
      relatedId: user.id,
      relatedType: "user",
    }).catch(console.error);
    const { passwordHash, ...safeUser } = user;
    return res.status(201).json(safeUser);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    const [user] = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      department: usersTable.department,
      position: usersTable.position,
      phone: usersTable.phone,
      avatarUrl: usersTable.avatarUrl,
      workHoursPerDay: usersTable.workHoursPerDay,
      workStartTime: usersTable.workStartTime,
      workEndTime: usersTable.workEndTime,
      breakMinutes: usersTable.breakMinutes,
      salary: usersTable.salary,
      contractType: usersTable.contractType,
      transportAllowance: usersTable.transportAllowance,
      housingAllowance: usersTable.housingAllowance,
      birthDate: usersTable.birthDate,
      contractEndDate: usersTable.contractEndDate,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    if (req.userId !== id) {
      const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
      if (!me || !["admin", "manager"].includes(me.role)) {
        return res.status(403).json({ error: "Not allowed" });
      }
    }
    const schema = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      role: z.enum(["admin", "manager", "employee"]).optional(),
      department: z.string().nullable().optional(),
      position: z.string().optional(),
      phone: z.string().optional(),
      workHoursPerDay: z.number().optional(),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      workEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      breakMinutes: z.number().min(0).optional(),
      salary: z.number().nullable().optional(),
      contractType: z.enum(["monthly", "daily"]).optional(),
      transportAllowance: z.number().min(0).optional(),
      housingAllowance: z.number().min(0).optional(),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      contractEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      avatarUrl: z.string().nullable().optional(),
    });
    const body = schema.parse(req.body);
    if (body.email) {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: "Email already in use by another account" });
      }
    }
    // منع الموظف من رفع صلاحية نفسه — تغيير الـ role حق admin/manager فقط
    if (body.role !== undefined) {
      const [me] = await db.select({ role: usersTable.role })
        .from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
      if (!me || !["admin", "manager"].includes(me.role)) {
        return res.status(403).json({ error: "Not allowed to change role" });
      }
    }

    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.email !== undefined) updates.email = body.email;
    if (body.role !== undefined) updates.role = body.role;
    if (body.department !== undefined) updates.department = body.department;
    if (body.position !== undefined) updates.position = body.position;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.workHoursPerDay !== undefined) updates.workHoursPerDay = body.workHoursPerDay;
    if (body.workStartTime !== undefined) updates.workStartTime = body.workStartTime;
    if (body.workEndTime !== undefined) updates.workEndTime = body.workEndTime;
    if (body.breakMinutes !== undefined) updates.breakMinutes = body.breakMinutes;
    if (body.salary !== undefined) updates.salary = body.salary;
    if (body.contractType !== undefined) updates.contractType = body.contractType;
    if (body.transportAllowance !== undefined) updates.transportAllowance = body.transportAllowance;
    if (body.housingAllowance !== undefined) updates.housingAllowance = body.housingAllowance;
    if (body.birthDate !== undefined) updates.birthDate = body.birthDate;
    if (body.contractEndDate !== undefined) updates.contractEndDate = body.contractEndDate;
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safeUser } = updated;
    return res.json(safeUser);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req: any, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === req.userId) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Wrap everything in a transaction so either ALL deletes succeed or NONE do.
    await db.transaction(async (tx) => {
      // ── 1. Null-out FK references that point TO this user in other rows ──────
      // These must come before the actual row deletions below, otherwise
      // PostgreSQL will raise a FK-constraint error when deleting the user row.

      // Announcements created by this user → keep the announcement, clear the author
      await tx.update(announcementsTable)
        .set({ createdBy: null })
        .where(eq(announcementsTable.createdBy, id));

      // Payroll reports GENERATED BY this user for OTHER employees → keep report, clear generator
      await tx.update(payrollReportsTable)
        .set({ generatedBy: null })
        .where(eq(payrollReportsTable.generatedBy, id));

      // Late-justification reviews done by this user → keep justification, clear reviewer
      await tx.update(lateJustificationsTable)
        .set({ reviewedBy: null })
        .where(eq(lateJustificationsTable.reviewedBy, id));

      // Leave reviews done by this user (already handled; keep for safety)
      await tx.update(leaveTable)
        .set({ reviewedBy: null })
        .where(eq(leaveTable.reviewedBy, id));

      // Messages sent or received — no FK constraint but clean them up anyway
      await tx.delete(messagesTable)
        .where(or(
          eq(messagesTable.senderId, id),
          eq(messagesTable.receiverId, id),
        ));

      // ── 2. Delete THIS employee's own records ────────────────────────────────
      // lateJustifications references attendance.id (FK), so delete BEFORE attendance
      await tx.delete(lateJustificationsTable).where(eq(lateJustificationsTable.userId, id));
      await tx.delete(attendanceCorrectionsTable).where(eq(attendanceCorrectionsTable.userId, id));
      await tx.delete(attendanceTable).where(eq(attendanceTable.userId, id));
      await tx.delete(leaveTable).where(eq(leaveTable.userId, id));
      await tx.delete(salaryAdvancesTable).where(eq(salaryAdvancesTable.userId, id));
      await tx.delete(bonusesTable).where(eq(bonusesTable.userId, id));
      await tx.delete(payrollReportsTable).where(eq(payrollReportsTable.userId, id));
      await tx.delete(purchasesTable).where(eq(purchasesTable.userId, id));
      await tx.delete(requestsTable).where(eq(requestsTable.userId, id));
      await tx.delete(workReportsTable).where(eq(workReportsTable.userId, id));
      await tx.delete(notificationsTable).where(eq(notificationsTable.userId, id));
      await tx.delete(userSettingsTable).where(eq(userSettingsTable.userId, id));

      // ── 3. Finally delete the user row itself ────────────────────────────────
      await tx.delete(usersTable).where(eq(usersTable.id, id));
    });

    return res.status(204).send();
  } catch (err: any) {
    return res.status(httpStatus(err)).json({ error: err.message });
  }
});

export default router;
