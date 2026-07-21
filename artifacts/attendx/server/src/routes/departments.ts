import { Router } from "express";
import { db, departmentsTable, usersTable } from "../../../db/src/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";

const router = Router();

const DEFAULT_DEPARTMENTS = ["HR", "Accounting", "Sales", "IT", "Operations"];

/* ── Seed only once per process lifetime, not on every request ── */
let seeded = false;
async function seedOnce() {
  if (seeded) return;
  try {
    const existing = await db.select({ id: departmentsTable.id }).from(departmentsTable).limit(1);
    if (existing.length === 0) {
      await db.insert(departmentsTable)
        .values(DEFAULT_DEPARTMENTS.map(name => ({ name })))
        .onConflictDoNothing();
    }
    seeded = true;
  } catch (err: any) {
    console.error("[departments] seedOnce failed:", err.message);
    // Don't set seeded=true so we retry on the next request
  }
}

// Kick off seeding immediately when the module loads (non-blocking)
seedOnce().catch(() => {});

/* ── Request timeout wrapper ── */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

router.get("/", requireAuth, async (_req, res) => {
  try {
    await seedOnce(); // no-op after first success

    const [depts, users] = await withTimeout(
      Promise.all([
        db.select().from(departmentsTable).orderBy(departmentsTable.name),
        db.select({ id: usersTable.id, department: usersTable.department }).from(usersTable),
      ]),
      10_000
    );

    const countMap: Record<string, number> = {};
    for (const u of users) {
      if (u.department) countMap[u.department] = (countMap[u.department] || 0) + 1;
    }
    return res.json(depts.map(d => ({ ...d, employeeCount: countMap[d.name] || 0 })));
  } catch (err: any) {
    const isTimeout = err.message?.includes("timed out");
    return res.status(isTimeout ? 504 : 500).json({ error: err.message });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(255) });
    const { name } = schema.parse(req.body);
    const [dept] = await withTimeout(
      db.insert(departmentsTable).values({ name }).returning(),
      8_000
    );
    return res.status(201).json({ ...dept, employeeCount: 0 });
  } catch (err: any) {
    if (err.message?.includes("unique")) {
      return res.status(409).json({ error: "Department already exists" });
    }
    return res.status(400).json({ error: err.message });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({ imageUrl: z.string().max(500).nullable() });
    const { imageUrl } = schema.parse(req.body);
    const [dept] = await withTimeout(
      db.update(departmentsTable).set({ imageUrl }).where(eq(departmentsTable.id, id)).returning(),
      8_000
    );
    if (!dept) return res.status(404).json({ error: "Department not found" });
    return res.json({ ...dept, employeeCount: 0 });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[dept]] = await withTimeout(
      Promise.all([
        db.select().from(departmentsTable).where(eq(departmentsTable.id, id)).limit(1),
      ]),
      8_000
    );
    if (!dept) return res.status(404).json({ error: "Department not found" });
    await withTimeout(
      Promise.all([
        db.update(usersTable).set({ department: null }).where(eq(usersTable.department, dept.name)),
        db.delete(departmentsTable).where(eq(departmentsTable.id, id)),
      ]).then(() => null),
      8_000
    );
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
