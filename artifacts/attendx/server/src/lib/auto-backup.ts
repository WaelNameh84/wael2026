/**
 * auto-backup.ts
 * يفحص كل يوم عند منتصف الليل إذا اليوم هو يوم الحفظ الشهري المحدد،
 * وإذا كان كذلك يحفظ نسخة احتياطية تلقائية في جدول backups.
 */
import { pool } from "../../../db/src/index.js";

const TABLES = [
  "users", "departments", "locations", "attendance", "attendance_corrections",
  "late_justifications", "leave", "bonuses", "salary_advances", "purchases",
  "requests", "payroll_reports", "announcements", "holidays", "work_reports", "app_config",
];

async function buildSnapshot() {
  const client = await pool.connect();
  try {
    const snapshot: Record<string, any[]> = {};
    for (const table of TABLES) {
      try {
        const { rows } = await client.query(`SELECT * FROM "${table}"`);
        snapshot[table] = rows;
      } catch { snapshot[table] = []; }
    }
    return snapshot;
  } finally { client.release(); }
}

async function runAutoBackup() {
  try {
    const { rows } = await pool.query(
      `SELECT auto_backup_enabled, auto_backup_day FROM app_config WHERE id=1`
    );
    const cfg = rows[0];
    if (!cfg?.auto_backup_enabled) return;

    const today = new Date().getDate();
    if (today !== Number(cfg.auto_backup_day)) return;

    // تحقق: هل تم الحفظ اليوم مسبقاً؟
    const { rows: existing } = await pool.query(
      `SELECT id FROM backups WHERE created_at::date = CURRENT_DATE AND name LIKE 'تلقائي%' LIMIT 1`
    );
    if (existing.length > 0) return; // تم الحفظ مسبقاً اليوم

    const snapshot = await buildSnapshot();
    const payload = { version: 1, created_at: new Date().toISOString(), tables: snapshot };
    const json = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(json, "utf8");
    const name = `تلقائي ${new Date().toLocaleDateString("ar-SA-u-ca-gregory")}`;

    await pool.query(
      `INSERT INTO backups (name, data, size_bytes) VALUES ($1, $2, $3)`,
      [name, json, sizeBytes]
    );
    console.log(`✅ Auto-backup saved: ${name} (${(sizeBytes / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error("⚠️ Auto-backup failed:", err instanceof Error ? err.message : err);
  }
}

export function startAutoBackupScheduler(): ReturnType<typeof setInterval> {
  // فحص فوري عند بدء التشغيل
  runAutoBackup();

  // فحص كل 6 ساعات (لضمان عدم فوات يوم الحفظ بسبب إعادة تشغيل السيرفر)
  const INTERVAL = 6 * 60 * 60 * 1000;
  const handle = setInterval(runAutoBackup, INTERVAL);
  console.log("💾 Auto-backup scheduler started (checks every 6h).");
  return handle;
}
