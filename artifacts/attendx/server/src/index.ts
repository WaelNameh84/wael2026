import app from "./app.js";
import { pool } from "../../db/src/index.js";
import { getAppName, initConfigCache } from "./lib/gemini-config.js";
import { initVapid } from "./routes/push.js";
import { startMonthEndReportScheduler } from "./lib/auto-reports.js";
import { startAutoBackupScheduler } from "./lib/auto-backup.js";

const port = Number(process.env["PORT"] ?? 10000);

if (Number.isNaN(port) || port <= 0) {
  console.error("Invalid PORT value:", process.env["PORT"]);
  process.exit(1);
}

// ── Auto-migrations: run idempotent ALTER TABLE statements on every startup ──
async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Base tables first (no FK dependencies), then dependent tables, so that
      -- any table missing in an out-of-sync production database (e.g. one that
      -- was provisioned before a feature shipped) gets created automatically.
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL,
        email varchar(255) NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'employee',
        department varchar(255),
        "position" varchar(255),
        phone varchar(50),
        avatar_url text,
        work_hours_per_day real NOT NULL DEFAULT 8,
        salary real,
        contract_type varchar(20) NOT NULL DEFAULT 'monthly',
        transport_allowance real NOT NULL DEFAULT 0,
        housing_allowance real NOT NULL DEFAULT 0,
        is_approved boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS departments (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL UNIQUE,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS locations (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL,
        address text NOT NULL,
        lat real,
        lng real,
        created_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token text NOT NULL UNIQUE,
        created_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attendance (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        location_id integer REFERENCES locations(id),
        date date NOT NULL,
        check_in timestamp NOT NULL,
        check_out timestamp,
        hours_worked real,
        overtime real,
        status varchar(30) NOT NULL DEFAULT 'present',
        notes text,
        biometric_verified boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS attendance_corrections (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        attendance_id integer,
        date varchar(10) NOT NULL,
        requested_check_in varchar(5),
        requested_check_out varchar(5),
        reason text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        admin_note text,
        reviewed_by integer REFERENCES users(id),
        reviewed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS late_justifications (
        id serial PRIMARY KEY,
        attendance_id integer NOT NULL REFERENCES attendance(id),
        user_id integer NOT NULL REFERENCES users(id),
        reason text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        admin_note text,
        reviewed_by integer REFERENCES users(id),
        reviewed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS leave (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        type varchar(30) NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        total_days integer NOT NULL,
        reason text,
        document_path text,
        status varchar(20) NOT NULL DEFAULT 'pending',
        is_paid boolean,
        reviewed_by integer REFERENCES users(id),
        reviewed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS bonuses (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        type varchar(20) NOT NULL DEFAULT 'bonus',
        amount real NOT NULL,
        reason text,
        period varchar(7),
        created_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS salary_advances (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        amount real NOT NULL,
        reason text,
        status varchar(20) NOT NULL DEFAULT 'pending',
        admin_note text,
        reviewed_by integer REFERENCES users(id),
        reviewed_at timestamp,
        deducted_period varchar(7),
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS purchases (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        category varchar(20) NOT NULL,
        item_label varchar(255) NOT NULL,
        description text,
        amount real NOT NULL,
        receipt_url text,
        period varchar(7) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS requests (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        type varchar(30) NOT NULL,
        date varchar(10) NOT NULL,
        start_time varchar(5),
        end_time varchar(5),
        hours real,
        reason text,
        status varchar(20) NOT NULL DEFAULT 'pending',
        admin_note text,
        reviewed_by integer REFERENCES users(id),
        reviewed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS payroll_reports (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        employee_name varchar(255) NOT NULL,
        period varchar(7) NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        base_salary real NOT NULL,
        daily_rate real NOT NULL,
        hourly_rate real NOT NULL,
        working_days_in_month integer NOT NULL,
        days_present integer NOT NULL,
        days_absent integer NOT NULL,
        paid_leave_days integer NOT NULL DEFAULT 0,
        unpaid_leave_days integer NOT NULL DEFAULT 0,
        total_overtime_hours real NOT NULL DEFAULT 0,
        total_late_minutes integer NOT NULL DEFAULT 0,
        overtime_bonus real NOT NULL DEFAULT 0,
        late_penalty real NOT NULL DEFAULT 0,
        unpaid_leave_deduction real NOT NULL DEFAULT 0,
        total_deductions real NOT NULL DEFAULT 0,
        total_additions real NOT NULL DEFAULT 0,
        net_salary real NOT NULL,
        notes text,
        generated_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS announcements (
        id serial PRIMARY KEY,
        title varchar(255) NOT NULL,
        body text NOT NULL,
        target_department varchar(255),
        priority varchar(20) NOT NULL DEFAULT 'normal',
        created_by integer REFERENCES users(id),
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id serial PRIMARY KEY,
        sender_id integer NOT NULL,
        receiver_id integer,
        subject varchar(255) NOT NULL,
        body text NOT NULL,
        is_read boolean NOT NULL DEFAULT false,
        is_broadcast boolean NOT NULL DEFAULT false,
        parent_id integer,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id serial PRIMARY KEY,
        type varchar(50) NOT NULL,
        title text NOT NULL,
        message text NOT NULL,
        related_id integer,
        related_type varchar(50),
        status varchar(20) NOT NULL DEFAULT 'unread',
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id integer NOT NULL REFERENCES users(id) PRIMARY KEY,
        theme varchar(20) NOT NULL DEFAULT 'system',
        font_size varchar(20) NOT NULL DEFAULT 'medium',
        language varchar(10) NOT NULL DEFAULT 'en',
        ai_key text DEFAULT NULL
      );
      CREATE TABLE IF NOT EXISTS work_reports (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        image_url text NOT NULL,
        note text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS holidays (
        id serial PRIMARY KEY,
        date varchar(10) NOT NULL UNIQUE,
        name varchar(255) NOT NULL,
        created_by integer REFERENCES users(id),
        created_at timestamp NOT NULL DEFAULT now()
      );
      -- Global app config (name/logo/work-hour rules) lives in the DB so it
      -- survives redeploys; a single fixed row (id=1) holds all fields.
      CREATE TABLE IF NOT EXISTS app_config (
        id integer PRIMARY KEY DEFAULT 1,
        app_name varchar(100),
        app_logo text,
        work_start_time varchar(5),
        late_grace_minutes integer,
        break_minutes integer,
        app_timezone varchar(100),
        gemini_api_key text
      );
      INSERT INTO app_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

      -- Idempotent column additions for tables that may already exist from an
      -- earlier schema version.
      ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS installments integer NOT NULL DEFAULT 1;
      ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS deduction_unit varchar(10) NOT NULL DEFAULT 'month';
      ALTER TABLE salary_advances ADD COLUMN IF NOT EXISTS deduction_start_date date;
      ALTER TABLE leave ADD COLUMN IF NOT EXISTS is_paid boolean;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_type varchar(20) NOT NULL DEFAULT 'monthly';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_allowance real NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS housing_allowance real NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date date;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_end_date date;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_status varchar(20) NOT NULL DEFAULT 'pending';
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_lat real;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_lng real;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS gps_address text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS smtp_host varchar(255);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS smtp_port integer;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS smtp_user varchar(255);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS smtp_pass text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS smtp_from varchar(255);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS resend_api_key text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS resend_from varchar(255);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS brevo_api_key text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS brevo_from varchar(255);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS cloudinary_cloud_name varchar(100);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS cloudinary_api_key varchar(100);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS cloudinary_api_secret text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS vapid_public_key text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS vapid_private_key text;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS vapid_email varchar(255);
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS manager_api_access integer DEFAULT 0;
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS image_url varchar(500);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS work_start_time varchar(5);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS work_end_time varchar(5);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS break_minutes real NOT NULL DEFAULT 0;
      ALTER TABLE late_justifications ADD COLUMN IF NOT EXISTS type varchar(20) NOT NULL DEFAULT 'late';

      -- النسخ الاحتياطية المحفوظة داخل التطبيق
      CREATE TABLE IF NOT EXISTS backups (
        id serial PRIMARY KEY,
        name varchar(255) NOT NULL,
        data text NOT NULL,
        size_bytes integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      );
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_enabled boolean NOT NULL DEFAULT false;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS auto_backup_day integer NOT NULL DEFAULT 1;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS gps_enabled integer NOT NULL DEFAULT 1;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS gps_radius integer NOT NULL DEFAULT 200;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_width integer DEFAULT 96;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_height integer DEFAULT 96;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_rotation integer DEFAULT 0;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_offset_x integer DEFAULT 0;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_offset_y integer DEFAULT 0;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_bg_enabled integer DEFAULT 0;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_bg_color varchar(20) DEFAULT '#3b82f6';
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_bg_opacity integer DEFAULT 10;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS logo_bg_radius integer DEFAULT 16;
      -- Global UI settings blob: persists all client appearance/behaviour so every
      -- device gets the admin's config. Added as a migration so it survives fresh deploys.
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ui_settings text;

      -- FIX #2: new detail columns on payroll_reports (allowances + breakdown fields)
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS total_normal_hours double precision NOT NULL DEFAULT 0;
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS base_earned double precision NOT NULL DEFAULT 0;
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS admin_bonus_total double precision NOT NULL DEFAULT 0;
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS admin_deduction_total double precision NOT NULL DEFAULT 0;
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS advance_deduction_total double precision NOT NULL DEFAULT 0;
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS transport_allowance double precision NOT NULL DEFAULT 0;
      ALTER TABLE payroll_reports ADD COLUMN IF NOT EXISTS housing_allowance double precision NOT NULL DEFAULT 0;

      -- FIX #4: upgrade financial columns from real (32-bit) to double precision (64-bit)
      ALTER TABLE payroll_reports ALTER COLUMN base_salary TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN daily_rate TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN hourly_rate TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN total_overtime_hours TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN overtime_bonus TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN late_penalty TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN unpaid_leave_deduction TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN total_deductions TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN total_additions TYPE double precision;
      ALTER TABLE payroll_reports ALTER COLUMN net_salary TYPE double precision;

      -- ── PERFORMANCE INDEXES (idempotent — CREATE INDEX IF NOT EXISTS) ──────
      -- attendance: أكثر جدول استعلاماً في التطبيق
      CREATE INDEX IF NOT EXISTS idx_attendance_user_id   ON attendance(user_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date      ON attendance(date);
      CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);

      -- notifications: تكبر بسرعة مع كثرة الموظفين
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_status     ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

      -- sessions: البحث بالـ token يحدث مع كل طلب HTTP
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

      -- leave: فلترة حسب الموظف والحالة
      CREATE INDEX IF NOT EXISTS idx_leave_user_id ON leave(user_id);
      CREATE INDEX IF NOT EXISTS idx_leave_status  ON leave(status);

      -- messages: صندوق الوارد والصادر
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id   ON messages(sender_id);

      -- late_justifications
      CREATE INDEX IF NOT EXISTS idx_late_just_user_id       ON late_justifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_late_just_attendance_id ON late_justifications(attendance_id);
      CREATE INDEX IF NOT EXISTS idx_late_just_status        ON late_justifications(status);

      -- attendance_corrections
      CREATE INDEX IF NOT EXISTS idx_att_corr_user_id ON attendance_corrections(user_id);
      CREATE INDEX IF NOT EXISTS idx_att_corr_status  ON attendance_corrections(status);

      -- payroll_reports: فلترة حسب الموظف والفترة
      CREATE INDEX IF NOT EXISTS idx_payroll_user_id ON payroll_reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_period  ON payroll_reports(period);

      -- work_reports
      CREATE INDEX IF NOT EXISTS idx_work_reports_user_id ON work_reports(user_id);

      -- bonuses & salary_advances
      CREATE INDEX IF NOT EXISTS idx_bonuses_user_id         ON bonuses(user_id);
      CREATE INDEX IF NOT EXISTS idx_salary_advances_user_id ON salary_advances(user_id);
      CREATE INDEX IF NOT EXISTS idx_salary_advances_status  ON salary_advances(status);

      -- purchases
      CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_period  ON purchases(period);

      -- image_store: stores uploaded image binary data in PostgreSQL.
      -- Avoids disk-file ephemerality on Render. Served via GET /api/images/:id.
      CREATE TABLE IF NOT EXISTS image_store (
        id         SERIAL PRIMARY KEY,
        data       TEXT NOT NULL,
        mime_type  VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- push subscriptions (replaces push-subscriptions.json file)
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint text NOT NULL,
        p256dh text NOT NULL,
        auth text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        start_time varchar(5) NOT NULL DEFAULT '09:00',
        end_time varchar(5) NOT NULL DEFAULT '17:00',
        timezone_offset integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        UNIQUE(user_id)
      );
    `);
    console.log("✅  DB migrations applied");
  } catch (err) {
    console.error("⚠️  DB migration warning:", err);
    // Non-fatal: server continues even if migration fails
  } finally {
    client.release();
  }
}

// ── Keep-alive self-ping (Render production only) ───────────────────────────
// Render's free/starter web services spin down after ~15 minutes without any
// inbound HTTP request. Rather than relying on an external cron/uptime
// service, the server pings its own public health endpoint every 10 minutes —
// that's genuine inbound traffic from Render's point of view, so it keeps
// resetting the idle timer and the service never goes to sleep.
// RENDER_EXTERNAL_URL is set automatically by Render on every deploy; APP_URL
// is a manual fallback for setups where it isn't. Both are absent locally/on
// Replit, so this is a no-op outside of the Render deployment.
function startKeepAlivePing() {
  const baseUrl = process.env.RENDER_EXTERNAL_URL ?? process.env.APP_URL;
  if (process.env.NODE_ENV !== "production" || !baseUrl) return;

  const pingUrl = `${baseUrl.replace(/\/+$/, "")}/api/health`;
  const PING_INTERVAL = 10 * 60 * 1000; // 10 min — under Render's ~15 min idle timeout

  setInterval(() => {
    fetch(pingUrl)
      .then(res => { if (!res.ok) console.warn(`⚠️  Keep-alive ping got status ${res.status}`); })
      .catch(err => console.warn("⚠️  Keep-alive ping failed:", err instanceof Error ? err.message : err));
  }, PING_INTERVAL);

  console.log(`🔁 Keep-alive ping enabled → ${pingUrl} (every ${PING_INTERVAL / 60000} min)`);
}

// ── Maintenance scheduler: تنظيف الإشعارات القديمة والسيشنز المنتهية ────────
// يعمل مرة كل 24 ساعة في الخلفية — لا يؤثر على أي وظيفة
async function runMaintenanceCleanup() {
  const client = await pool.connect();
  try {
    // 1) احذف الإشعارات المقروءة/المؤرشفة الأقدم من 60 يوم
    const notifResult = await client.query(`
      DELETE FROM notifications
      WHERE status IN ('read', 'archived')
        AND created_at < NOW() - INTERVAL '60 days'
    `);

    // 2) احذف السيشنز المنتهية الصلاحية
    const sessResult = await client.query(`
      DELETE FROM sessions WHERE expires_at < NOW()
    `);

    // 3) احذف الإعلانات المنتهية الصلاحية (expires_at مضى عليه أكثر من 7 أيام)
    const announceResult = await client.query(`
      DELETE FROM announcements
      WHERE expires_at IS NOT NULL
        AND expires_at < NOW() - INTERVAL '7 days'
    `);

    console.log(
      `🧹 Maintenance: removed ${notifResult.rowCount} old notifications, ` +
      `${sessResult.rowCount} expired sessions, ` +
      `${announceResult.rowCount} expired announcements.`
    );
  } catch (err) {
    console.error("⚠️  Maintenance cleanup error:", err);
  } finally {
    client.release();
  }
}

function startMaintenanceScheduler() {
  const INTERVAL = 24 * 60 * 60 * 1000; // كل 24 ساعة
  // تشغيل أولي بعد 5 دقائق من الإقلاع (لا نريد تحميل الـ startup)
  setTimeout(() => {
    runMaintenanceCleanup();
    setInterval(runMaintenanceCleanup, INTERVAL);
  }, 5 * 60 * 1000);
  console.log("🧹 Maintenance scheduler started (runs every 24h).");
}

runMigrations().then(() => initConfigCache()).then(() => initVapid()).then(() => {
  const server = app.listen(port, "0.0.0.0", (err?: Error) => {
    if (err) {
      console.error("Error starting server:", err);
      process.exit(1);
    }
    console.log(`✅  ${getAppName()} server listening on port ${port}`);
    startKeepAlivePing();
    const reportHandle   = startMonthEndReportScheduler();
    const backupHandle   = startAutoBackupScheduler();
    startMaintenanceScheduler();

    // ── Graceful shutdown ─────────────────────────────────────────────────
    // Clear all background intervals before the process exits so Node.js
    // doesn't keep the event loop alive and no duplicate timers accumulate
    // on hot-reloads (common in the Replit dev environment).
    function shutdown(signal: string) {
      console.log(`⏳  ${signal} received — shutting down gracefully…`);
      clearInterval(reportHandle);
      clearInterval(backupHandle);
      server.close(() => {
        console.log("✅  Server closed.");
        process.exit(0);
      });
      // Force-exit after 10 s if connections aren't drained
      setTimeout(() => { console.error("⚠️  Forced exit after timeout."); process.exit(1); }, 10_000).unref();
    }

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT",  () => shutdown("SIGINT"));
  });
});
