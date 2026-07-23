import { pgTable, integer, varchar, text } from "drizzle-orm/pg-core";

/**
 * Single-row table holding global app configuration (name, logo, work-hour
 * rules, timezone, AI key). Stored in the database — NOT on local disk —
 * so it survives redeploys/rebuilds (a fresh container has no access to a
 * previous container's filesystem).
 */
export const appConfigTable = pgTable("app_config", {
  id: integer("id").primaryKey().default(1),
  appName: varchar("app_name", { length: 100 }),
  appLogo: text("app_logo"),
  workStartTime: varchar("work_start_time", { length: 5 }),
  workEndTime: varchar("work_end_time", { length: 5 }),
  lateGraceMinutes: integer("late_grace_minutes"),
  breakMinutes: integer("break_minutes"),
  appTimezone: varchar("app_timezone", { length: 100 }),
  geminiApiKey: text("gemini_api_key"),
  // SMTP / email settings
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port"),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: text("smtp_pass"),
  smtpFrom: varchar("smtp_from", { length: 255 }),
  // Resend API (HTTP-based, preferred over SMTP on restricted hosts)
  resendApiKey: text("resend_api_key"),
  resendFrom: varchar("resend_from", { length: 255 }),
  // Brevo (Sendinblue) — HTTP API, no domain verification needed, works on Render
  brevoApiKey: text("brevo_api_key"),
  brevoFrom: varchar("brevo_from", { length: 255 }),
  // Cloudinary — image/file storage
  cloudinaryCloudName: varchar("cloudinary_cloud_name", { length: 100 }),
  cloudinaryApiKey: varchar("cloudinary_api_key", { length: 100 }),
  cloudinaryApiSecret: text("cloudinary_api_secret"),
  // VAPID — Web Push notifications
  vapidPublicKey: text("vapid_public_key"),
  vapidPrivateKey: text("vapid_private_key"),
  vapidEmail: varchar("vapid_email", { length: 255 }),
  // Access control
  managerApiAccess: integer("manager_api_access").default(0), // 0=no, 1=yes
  // GPS attendance settings (admin-only, stored server-side)
  gpsEnabled: integer("gps_enabled").default(1),   // 0=off, 1=on
  gpsRadius:  integer("gps_radius").default(200),  // metres
  // Logo display settings — persisted in DB so they survive redeploys and cache clears
  logoWidth:      integer("logo_width").default(96),
  logoHeight:     integer("logo_height").default(96),
  logoRotation:   integer("logo_rotation").default(0),
  logoOffsetX:    integer("logo_offset_x").default(0),
  logoOffsetY:    integer("logo_offset_y").default(0),
  logoBgEnabled:  integer("logo_bg_enabled").default(0),  // 0=off, 1=on
  logoBgColor:    varchar("logo_bg_color", { length: 20 }).default("#3b82f6"),
  logoBgOpacity:  integer("logo_bg_opacity").default(10),
  logoBgRadius:   integer("logo_bg_radius").default(16),
  // Global UI settings blob — all client-side appearance/behaviour settings
  // stored as JSON so any device that opens the app gets the admin's config.
  uiSettings:     text("ui_settings"),
});

export type AppConfig = typeof appConfigTable.$inferSelect;
