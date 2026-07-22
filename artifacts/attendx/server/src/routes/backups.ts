import { Router } from "express";
import { pool } from "../../../db/src/index.js";
import { requireSuperAdmin } from "./auth.js";

const router = Router();

// ── جداول البيانات التي يتم نسخها احتياطياً ──────────────────────────────
const TABLES = [
  "users",
  "departments",
  "locations",
  "attendance",
  "attendance_corrections",
  "late_justifications",
  "leave",
  "bonuses",
  "salary_advances",
  "purchases",
  "requests",
  "payroll_reports",
  "announcements",
  "holidays",
  "work_reports",
  "app_config",
];

// ── قراءة جميع البيانات وتجميعها ─────────────────────────────────────────
async function buildSnapshot() {
  const client = await pool.connect();
  try {
    const snapshot: Record<string, any[]> = {};
    for (const table of TABLES) {
      try {
        const { rows } = await client.query(`SELECT * FROM "${table}"`);
        snapshot[table] = rows;
      } catch {
        snapshot[table] = []; // الجدول غير موجود — تخطّه
      }
    }
    return snapshot;
  } finally {
    client.release();
  }
}

// ── GET /api/backups — قائمة النسخ المحفوظة ──────────────────────────────
router.get("/", requireSuperAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, created_at, size_bytes FROM backups ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch {
    res.json([]);
  }
});

// ── POST /api/backups/download — نسخ فوري + تنزيل مباشر ─────────────────
router.post("/download", requireSuperAdmin, async (_req, res) => {
  try {
    const snapshot = await buildSnapshot();
    const payload = {
      version: 1,
      created_at: new Date().toISOString(),
      tables: snapshot,
    };
    const json = JSON.stringify(payload, null, 2);
    const filename = `attendx_backup_${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(json);
  } catch (err) {
    res.status(500).json({ error: "فشل إنشاء النسخة الاحتياطية" });
  }
});

// ── POST /api/backups/save — حفظ نسخة في قاعدة البيانات ────────────────
router.post("/save", requireSuperAdmin, async (req, res) => {
  try {
    const name: string = req.body?.name || `نسخة ${new Date().toLocaleDateString("ar-SA-u-ca-gregory")}`;
    const snapshot = await buildSnapshot();
    const payload = {
      version: 1,
      created_at: new Date().toISOString(),
      tables: snapshot,
    };
    const json = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(json, "utf8");
    const { rows } = await pool.query(
      `INSERT INTO backups (name, data, size_bytes) VALUES ($1, $2, $3) RETURNING id, name, created_at, size_bytes`,
      [name, json, sizeBytes]
    );
    // احتفظ بأحدث 5 نسخ فقط داخل قاعدة البيانات — احذف الأقدم تلقائياً
    await pool.query(`
      DELETE FROM backups
      WHERE id NOT IN (
        SELECT id FROM backups ORDER BY created_at DESC LIMIT 5
      )
    `);
    res.json({ ok: true, backup: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "فشل حفظ النسخة الاحتياطية" });
  }
});

// ── GET /api/backups/:id/download — تنزيل نسخة محفوظة ──────────────────
router.get("/:id/download", requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT name, data FROM backups WHERE id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "النسخة غير موجودة" });
    const filename = `attendx_backup_${rows[0].name}_${req.params.id}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(rows[0].data);
  } catch {
    res.status(500).json({ error: "فشل التنزيل" });
  }
});

// ── DELETE /api/backups/:id — حذف نسخة ─────────────────────────────────
router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM backups WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "فشل الحذف" });
  }
});

// ── POST /api/backups/restore — استعادة من ملف مرفوع ────────────────────
router.post("/restore", requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const payload = req.body;
    if (!payload?.tables || payload.version !== 1) {
      return res.status(400).json({ error: "الملف غير صالح أو تالف" });
    }

    const tables: Record<string, any[]> = payload.tables;

    // ترتيب الحذف: الجداول التابعة أولاً ثم الرئيسية
    const deleteOrder = [
      "backups", "work_reports", "payroll_reports", "purchases",
      "requests", "salary_advances", "bonuses", "announcements",
      "leave", "late_justifications", "attendance_corrections",
      "attendance", "holidays", "locations", "departments",
      // لا نحذف users و app_config — نُحدّثها فقط
    ];

    await client.query("BEGIN");

    // حذف بالترتيب
    for (const table of deleteOrder) {
      try { await client.query(`DELETE FROM "${table}"`); } catch { /* غير موجود */ }
    }

    // إعادة الإدراج: الجداول الرئيسية أولاً ثم التابعة
    const insertOrder = [
      "departments", "locations", "holidays", "announcements",
      "users", "attendance", "attendance_corrections", "late_justifications",
      "leave", "bonuses", "salary_advances", "purchases",
      "requests", "payroll_reports", "work_reports",
    ];

    for (const table of insertOrder) {
      const rows: any[] = tables[table] ?? [];
      if (rows.length === 0) continue;
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        const colList = cols.map(c => `"${c}"`).join(", ");
        try {
          await client.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
        } catch { /* تجاهل تعارضات FK */ }
      }
    }

    // تحديث app_config فقط الحقول غير الحساسة
    const cfg = (tables["app_config"] ?? [])[0];
    if (cfg) {
      await client.query(
        `UPDATE app_config SET
          app_name=$1, work_start_time=$2, late_grace_minutes=$3,
          break_minutes=$4, app_timezone=$5
         WHERE id=1`,
        [cfg.app_name, cfg.work_start_time, cfg.late_grace_minutes, cfg.break_minutes, cfg.app_timezone]
      ).catch(() => {});
    }

    // إعادة تسلسلات auto-increment
    for (const table of insertOrder) {
      try {
        await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"','id'), COALESCE(MAX(id),0)+1, false) FROM "${table}"`);
      } catch { /* لا يوجد عمود id */ }
    }

    await client.query("COMMIT");
    res.json({ ok: true, message: "تمت الاستعادة بنجاح" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Restore error:", err);
    res.status(500).json({ error: "فشل الاستعادة" });
  } finally {
    client.release();
  }
});

// ── GET /api/backups/auto-settings ──────────────────────────────────────
router.get("/auto-settings", requireSuperAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT auto_backup_enabled, auto_backup_day FROM app_config WHERE id=1`
    );
    res.json({
      enabled: rows[0]?.auto_backup_enabled ?? false,
      day: rows[0]?.auto_backup_day ?? 1,
    });
  } catch {
    res.json({ enabled: false, day: 1 });
  }
});

// ── POST /api/backups/auto-settings ─────────────────────────────────────
router.post("/auto-settings", requireSuperAdmin, async (req, res) => {
  try {
    const { enabled, day } = req.body;
    await pool.query(
      `UPDATE app_config SET auto_backup_enabled=$1, auto_backup_day=$2 WHERE id=1`,
      [!!enabled, Number(day) || 1]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "فشل الحفظ" });
  }
});

// ── POST /api/backups/clear-records — مسح سجلات محددة ──────────────────
const CLEARABLE_TABLES: Record<string, string> = {
  attendance:               "attendance",
  attendance_corrections:   "attendance_corrections",
  late_justifications:      "late_justifications",
  leave:                    "leave",
  work_reports:             "work_reports",
  requests:                 "requests",
  notifications:            "notifications",
  messages:                 "messages",
  salary_advances:          "salary_advances",
  bonuses:                  "bonuses",
  purchases:                "purchases",
  payroll_reports:          "payroll_reports",
};

router.post("/clear-records", requireSuperAdmin, async (req, res) => {
  try {
    const { tables }: { tables: string[] } = req.body;
    if (!Array.isArray(tables) || tables.length === 0)
      return res.status(400).json({ error: "لم يتم تحديد أي جدول" });

    // التحقق من أن الجداول المطلوبة مسموح بمسحها فقط
    const invalid = tables.filter(t => !CLEARABLE_TABLES[t]);
    if (invalid.length > 0)
      return res.status(400).json({ error: `جداول غير مسموحة: ${invalid.join(", ")}` });

    const client = await pool.connect();
    try {
      for (const key of tables) {
        const tbl = CLEARABLE_TABLES[key];
        await client.query(`DELETE FROM "${tbl}"`);
      }
    } finally {
      client.release();
    }

    res.json({ ok: true, cleared: tables });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "فشل المسح" });
  }
});

export default router;
