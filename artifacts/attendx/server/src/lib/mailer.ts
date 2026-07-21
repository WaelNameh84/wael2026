import nodemailer from "nodemailer";
import { db, usersTable } from "../../../db/src/index.js";
import { inArray } from "drizzle-orm";
import { getAppName, getResendConfig, getSmtpConfig, isResendConfigured, getBrevoConfig, isBrevoConfigured } from "./gemini-config.js";

// ── Brevo (Sendinblue) HTTP API sender — no domain verification needed ────────
/** Fetch the Brevo account's email (always a verified sender). */
export async function getBrevoAccountEmail(apiKey: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return (data as any)?.email ?? null;
  } catch {
    return null;
  }
}

async function sendViaBrevo(to: string, subject: string, html: string): Promise<void> {
  const { apiKey, from } = getBrevoConfig();
  if (!apiKey) throw new Error("Brevo API key not configured");

  // If no from is saved yet, auto-fetch from Brevo account (always verified)
  let fromEmail = from;
  if (!fromEmail) {
    fromEmail = (await getBrevoAccountEmail(apiKey)) ?? undefined;
  }
  if (!fromEmail) {
    throw new Error(
      "لم يتم تحديد إيميل المُرسِل في Brevo — افتح الإعدادات واحفظ المفتاح مجدداً"
    );
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.message ?? `Brevo error ${res.status}`);
  }
}

// ── Resend HTTP API sender ──────────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const { apiKey, from } = getResendConfig();
  if (!apiKey) throw new Error("Resend API key not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.message ?? `Resend error ${res.status}`);
  }
}

// ── Nodemailer SMTP sender (fallback) ──────────────────────────────────────
function buildTransport(host: string, port: number, user: string, pass: string) {
  const secure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 12_000,
    socketTimeout: 12_000,
    family: 4,   // force IPv4 — Render doesn't route IPv6 to Gmail
  } as any);
}

function isBlockedError(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  const code = err?.code ?? "";
  return (
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("network") ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ESOCKET"
  );
}

async function createTransportWithFallback(
  host: string,
  port: number,
  user: string,
  pass: string
): Promise<{ transport: any; port: number }> {
  // Try the configured port first
  const t1 = buildTransport(host, port, user, pass);
  try {
    await t1.verify();
    return { transport: t1, port };
  } catch (err: any) {
    t1.close();
    // If the primary port was blocked, try the complementary port (465↔587)
    const altPort = port === 465 ? 587 : 465;
    const t2 = buildTransport(host, altPort, user, pass);
    try {
      await t2.verify();
      return { transport: t2, port: altPort };
    } catch (err2: any) {
      t2.close();
      // Re-throw a cleaner blocked error if both ports timed out
      if (isBlockedError(err) && isBlockedError(err2)) {
        const e = new Error(
          `SMTP_BLOCKED:${port},${altPort}`
        );
        (e as any).smtpBlocked = true;
        throw e;
      }
      // Otherwise throw the original error
      throw err;
    }
  }
}

function createTransport() {
  const cfg = getSmtpConfig();
  const host = cfg.host;
  const user = cfg.user;
  const pass = cfg.pass;

  if (!host || !user || !pass) return null;

  const isGmail = host.includes("gmail.com");
  const port = cfg.port ?? (isGmail ? 465 : 587);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 12_000,
    socketTimeout: 12_000,
    family: 4,
  } as any);
}

// ── Detect Resend domain-restriction errors ─────────────────────────────────
function isResendDomainError(err: any): boolean {
  const msg: string = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("verify a domain") ||
    msg.includes("testing emails to your own") ||
    msg.includes("validation_error") ||
    (msg.includes("resend") && msg.includes("domain"))
  );
}

// ── Unified send: Brevo → Resend (w/ SMTP fallback) → SMTP ─────────────────
async function send(to: string, subject: string, html: string) {
  // 1. Brevo — HTTP, no domain verification, works on Render ✅
  if (isBrevoConfigured()) {
    await sendViaBrevo(to, subject, html);
    return;
  }

  // 2. Resend — HTTP, but free plan restricts to account-owner email only
  if (isResendConfigured()) {
    try {
      await sendViaResend(to, subject, html);
      return;
    } catch (resendErr: any) {
      if (isResendDomainError(resendErr)) {
        // Resend blocked this recipient — try SMTP as last resort
        console.warn(`[Mailer] Resend domain error → falling back to SMTP for <${to}>`);
        const transport = createTransport();
        if (!transport) {
          throw new Error(
            "لا يمكن الإرسال: Resend يحتاج توثيق دومين، ولا يوجد SMTP مُعدّ. " +
            "الحل: أضف مفتاح Brevo في الإعدادات (brevo.com — مجاني، لا يحتاج دومين)"
          );
        }
        const cfg = getSmtpConfig();
        const from = cfg.from ?? cfg.user ?? "noreply@attendx.app";
        await transport.sendMail({ from, to, subject, html });
        return;
      }
      throw resendErr;
    }
  }

  // 3. SMTP — may be blocked on Render (ports 465/587)
  const cfg = getSmtpConfig();
  const from = cfg.from ?? "noreply@attendx.app";
  const transport = createTransport();
  if (!transport) {
    throw new Error(
      "لم يتم تهيئة أي مزود بريد إلكتروني. يرجى إضافة مفتاح Brevo في الإعدادات > البريد الإلكتروني."
    );
  }
  await transport.sendMail({ from, to, subject, html });
}

/**
 * Sends a test email to verify the active email provider (Resend or SMTP).
 * For SMTP: tries the configured port first, then the complementary port (465↔587)
 * so that hosting platforms that block one port can still use the other.
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const testHtml = `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;">
      <h2 style="color:#16a34a;margin:0 0 12px;">✅ Email Works!</h2>
      <p>Your email settings in <strong>${getAppName()}</strong> are configured correctly.</p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${getAppName()} — Employee Attendance System</p>
    </div>`;
    const testSubject = `[${getAppName()}] Test Email — Configured Successfully`;

    if (isBrevoConfigured()) {
      await sendViaBrevo(to, testSubject, testHtml);
      return { ok: true };
    }

    if (isResendConfigured()) {
      await sendViaResend(to, testSubject, testHtml);
      return { ok: true };
    }

    // SMTP path — use port-fallback transport
    const cfg = getSmtpConfig();
    if (!cfg.host || !cfg.user || !cfg.pass) {
      return { ok: false, error: "لم يتم تهيئة إعدادات البريد الإلكتروني بعد" };
    }

    const isGmail = (cfg.host ?? "").includes("gmail.com");
    const primaryPort = cfg.port ?? (isGmail ? 465 : 587);

    let transport: any;
    try {
      const result = await createTransportWithFallback(cfg.host, primaryPort, cfg.user, cfg.pass);
      transport = result.transport;
    } catch (connErr: any) {
      if ((connErr as any).smtpBlocked) {
        return {
          ok: false,
          error:
            "المنافذ 465 و587 محجوبة من قِبَل خادم الاستضافة. " +
            "استخدم Resend بدلاً من SMTP — اذهب إلى resend.com وأنشئ مفتاح API مجاني، " +
            "ثم أضفه في قسم إعدادات البريد.",
        };
      }
      return { ok: false, error: connErr.message };
    }

    const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;">
      <h2 style="color:#16a34a;margin:0 0 12px;">✅ Email Works!</h2>
      <p>Your email settings in <strong>${getAppName()}</strong> are configured correctly.</p>
      <p style="color:#64748b;font-size:13px;margin-top:20px;">${getAppName()} — Employee Attendance System</p>
    </div>`;
    const from = cfg.from ?? cfg.user ?? "noreply@attendx.app";
    await transport.sendMail({ from, to, subject: `[${getAppName()}] Test Email — Configured Successfully`, html });
    transport.close();
    return { ok: true };
  } catch (err: any) {
    const msg: string = err.message ?? "";
    if (
      msg.toLowerCase().includes("timeout") ||
      msg.toLowerCase().includes("etimedout") ||
      msg.toLowerCase().includes("econnrefused") ||
      err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED"
    ) {
      return {
        ok: false,
        error:
          "انتهت مهلة الاتصال — خادم الاستضافة يحجب SMTP. " +
          "استخدم Resend بدلاً من ذلك: resend.com (مجاني).",
      };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Sends an already-built, fully-styled HTML report (the same HTML used for the
 * in-app PDF/share view) as the body of a real email, so the recipient sees the
 * exact same design instead of the plain-text fallback a `mailto:` link produces.
 */
export async function sendCustomReportEmail(to: string, subject: string, html: string) {
  await send(to, subject, html);
}

/**
 * Reads the current admin notification emails directly from the database.
 * Always reflects the latest value saved in the Admin Profile settings.
 */
export async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.role, ["admin", "manager"]));
    return admins.map(a => a.email).filter(Boolean) as string[];
  } catch (err) {
    console.error("[Mailer] Could not fetch admin emails:", err);
    return [];
  }
}

/**
 * Returns the primary admin email (first admin in the DB).
 * Used by settings API to show which address is active for notifications.
 */
export async function getPrimaryAdminEmail(): Promise<string | null> {
  const emails = await getAdminEmails();
  return emails[0] ?? null;
}

/**
 * Sends a new-user pending-approval notification to all current admin emails.
 * The recipient list is always fetched live from the database — updating the
 * Admin Email in Settings immediately affects where future notifications go.
 */
export async function sendNewUserNotificationToAdmin(
  user: { name: string; email: string; role: string },
  appUrl: string
) {
  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) {
    console.log("[Mailer] No admin emails found — skipping admin notification.");
    return;
  }

  const subject = `[${getAppName()}] New Account Pending Approval — ${user.name}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#1d4ed8;">New Sign-up Awaiting Approval</h2>
      <p>A new user has registered and is waiting for your approval:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;color:#555;"><strong>Name</strong></td><td style="padding:8px;">${user.name}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:8px;color:#555;"><strong>Email</strong></td><td style="padding:8px;">${user.email}</td></tr>
        <tr><td style="padding:8px;color:#555;"><strong>Role</strong></td><td style="padding:8px;">${user.role}</td></tr>
      </table>
      <p>Please log in to your Admin Dashboard to approve or reject this request:</p>
      <a href="${appUrl}/dashboard" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Open Admin Dashboard</a>
      <p style="margin-top:24px;color:#888;font-size:12px;">${getAppName()} — Employee Attendance System</p>
    </div>
  `;

  for (const adminEmail of adminEmails) {
    await send(adminEmail, subject, html);
  }
}

export async function sendApprovalNotificationToUser(user: { name: string; email: string }, appUrl: string) {
  const subject = `[${getAppName()}] Your Account Has Been Approved!`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#16a34a;">Your Account Has Been Approved</h2>
      <p>Hi ${user.name},</p>
      <p>Great news! Your ${getAppName()} account has been approved. You can now log in and start using the system.</p>
      <a href="${appUrl}/login" style="display:inline-block;padding:10px 20px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Log In Now</a>
      <p style="margin-top:24px;color:#888;font-size:12px;">${getAppName()} — Employee Attendance System</p>
    </div>
  `;
  await send(user.email, subject, html);
}

/**
 * Sends an employee their monthly payslip by email. Used both by the manual
 * "Send by Email" flow (future server-side use) and by the automatic
 * month-end dispatch that fires when the manager hasn't sent it themselves
 * (see server/src/lib/auto-payroll.ts).
 */
export async function sendPayrollReportToEmployee(
  user: { name: string; email: string },
  report: {
    period: string;
    baseSalary: number;
    overtimeBonus: number;
    totalDeductions: number;
    netSalary: number;
    daysPresent: number;
    daysAbsent: number;
    totalOvertimeHours: number;
  },
  appUrl: string
) {
  const subject = `[${getAppName()}] كشف راتب — ${user.name} — ${report.period}`;
  const html = `
    <div dir="rtl" style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#1d4ed8;">كشف الراتب — ${report.period}</h2>
      <p>مرحباً ${user.name}،</p>
      <p>هذا كشف راتبك التلقائي لهذا الشهر (تم إنشاؤه تلقائياً لأنه لم يُرسل يدوياً):</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;color:#555;"><strong>الراتب الأساسي</strong></td><td style="padding:8px;">${report.baseSalary.toFixed(2)}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:8px;color:#555;"><strong>مكافأة الإضافي</strong></td><td style="padding:8px;">+${report.overtimeBonus.toFixed(2)}</td></tr>
        <tr><td style="padding:8px;color:#555;"><strong>إجمالي الخصومات</strong></td><td style="padding:8px;">−${report.totalDeductions.toFixed(2)}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:8px;color:#1d4ed8;"><strong>صافي الراتب</strong></td><td style="padding:8px;font-weight:700;">${report.netSalary.toFixed(2)}</td></tr>
        <tr><td style="padding:8px;color:#555;">أيام الحضور</td><td style="padding:8px;">${report.daysPresent}</td></tr>
        <tr style="background:#f9fafb;"><td style="padding:8px;color:#555;">أيام الغياب</td><td style="padding:8px;">${report.daysAbsent}</td></tr>
        <tr><td style="padding:8px;color:#555;">ساعات الإضافي</td><td style="padding:8px;">${report.totalOvertimeHours}</td></tr>
      </table>
      <a href="${appUrl}/login" style="display:inline-block;padding:10px 20px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">فتح التطبيق</a>
      <p style="margin-top:24px;color:#888;font-size:12px;">${getAppName()} — نظام إدارة الحضور</p>
    </div>
  `;
  await send(user.email, subject, html);
}

/** Full payroll detail passed from calculatePayrollForPeriod */
export interface PayrollDetail {
  baseSalary: number;
  baseEarned: number;
  dailyRate: number;
  hourlyRate: number;
  contractType: string;
  workingDaysInMonth: number;
  daysPresent: number;
  daysAbsent: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  totalLateMinutes: number;
  totalOvertimeHours: number;
  overtimeBonus: number;
  latePenalty: number;
  unpaidLeaveDeduction: number;
  adminBonusTotal: number;
  adminDeductionTotal: number;
  advanceDeductionTotal: number;
  transportAllowance: number;
  housingAllowance: number;
  totalAllowances: number;
  purchasesTotal: number;
  totalDeductions: number;
  totalAdditions: number;
  netSalary: number;
  bonusItems: Array<{
    type: string;
    amount: number;
    reason: string | null;
    source: string;
  }>;
}

/**
 * Sends a full monthly attendance + payroll report to an employee.
 * Includes: KPI cards, attendance summary, full itemised salary breakdown,
 * bonus/deduction items table, and a day-by-day attendance log.
 */
export async function sendMonthlyReportToEmployee(
  user: { name: string; email: string },
  report: {
    period: string;
    periodLabel: string;
    daysPresent: number;
    daysAbsent: number;
    lateArrivals: number;
    totalOvertimeHours: number;
    totalHoursWorked: number;
    workingDaysInMonth: number;
    baseSalary: number;
    overtimeBonus: number;
    totalDeductions: number;
    netSalary: number;
  },
  appUrl: string,
  attendanceRecords?: Array<{
    date: string;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    hoursWorked: number;
    overtime: number;
    lateMinutes: number;
  }>,
  payrollDetail?: PayrollDetail
) {
  const subject = `[${getAppName()}] تقرير شهر ${report.periodLabel} — ${user.name}`;
  const attendancePct = report.workingDaysInMonth > 0
    ? Math.round((report.daysPresent / report.workingDaysInMonth) * 100)
    : 0;

  function fmtTime(iso: string | null): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch { return "—"; }
  }

  function fmtHours(h: number): string {
    if (h <= 0) return "—";
    const total = Math.round(h * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return hh > 0 && mm > 0 ? `${hh}س ${mm}د` : hh > 0 ? `${hh}س` : `${mm}د`;
  }

  function statusLabel(s: string): string {
    const map: Record<string, string> = {
      present: "حاضر", late: "متأخر", absent: "غائب",
      on_leave: "إجازة", early_leave: "خروج مبكر",
    };
    return map[s] ?? s;
  }

  function statusColor(s: string): string {
    if (s === "absent") return "#dc2626";
    if (s === "late" || s === "early_leave") return "#d97706";
    if (s === "on_leave") return "#2563eb";
    return "#16a34a";
  }

  const fmt2 = (n: number) => n.toFixed(2);
  const pd = payrollDetail;

  // ── Helper: row for salary table ────────────────────────────────────────
  function salaryRow(label: string, detail: string, amount: string, color: string, bg: string) {
    return `<tr style="background:${bg};">
      <td style="padding:9px 12px;font-size:12px;font-weight:700;border-bottom:1px solid #f0f0f0;">${label}</td>
      <td style="padding:9px 12px;font-size:11px;color:#6b7280;border-bottom:1px solid #f0f0f0;">${detail}</td>
      <td style="padding:9px 12px;font-size:13px;font-weight:800;color:${color};text-align:left;border-bottom:1px solid #f0f0f0;">${amount}</td>
    </tr>`;
  }

  // ── Build itemised salary section ────────────────────────────────────────
  let salarySection = "";
  if (pd) {
    // Additions rows
    const addRows: string[] = [];
    // Build an accurate description for the earned-base row.
    // We cannot just say "daysPresent × dailyRate" because baseEarned is
    // hours-based and also includes paid-leave hours.
    const earnedDesc = (() => {
      const parts: string[] = [];
      if (pd.daysPresent > 0) parts.push(`${pd.daysPresent} يوم × ${fmt2(pd.dailyRate)}`);
      if (pd.paidLeaveDays > 0) parts.push(`${pd.paidLeaveDays} إجازة مدفوعة`);
      return parts.join(" + ") || `${fmt2(pd.hourlyRate)} / ساعة`;
    })();
    addRows.push(salaryRow(
      "الراتب المكتسب",
      earnedDesc,
      fmt2(pd.baseEarned), "#111827", "#f9fafb"
    ));
    if (pd.transportAllowance > 0) addRows.push(salaryRow("بدل مواصلات", "", `+${fmt2(pd.transportAllowance)}`, "#16a34a", "#fff"));
    if (pd.housingAllowance   > 0) addRows.push(salaryRow("بدل سكن",     "", `+${fmt2(pd.housingAllowance)}`, "#16a34a", "#f9fafb"));
    if (pd.overtimeBonus      > 0) addRows.push(salaryRow(
      "مكافأة الإضافي",
      `${pd.totalOvertimeHours}س × ${fmt2(pd.hourlyRate)} × 1.5`,
      `+${fmt2(pd.overtimeBonus)}`, "#16a34a", "#fff"
    ));

    // Admin bonuses & purchases from bonusItems
    const bonusOnlyItems = pd.bonusItems.filter(b => b.type === "bonus");
    bonusOnlyItems.forEach((b, i) => {
      addRows.push(salaryRow(b.reason ?? "مكافأة", b.source === "purchase" ? "مشتريات" : "مكافأة إدارية", `+${fmt2(b.amount)}`, "#16a34a", i % 2 === 0 ? "#f9fafb" : "#fff"));
    });

    // Deduction rows
    const dedRows: string[] = [];
    if (pd.latePenalty > 0) dedRows.push(salaryRow(
      "خصم التأخر",
      `${pd.totalLateMinutes} دقيقة`,
      `−${fmt2(pd.latePenalty)}`, "#dc2626", "#fff"
    ));
    if (pd.unpaidLeaveDeduction > 0) dedRows.push(salaryRow(
      "خصم الإجازة غير المدفوعة",
      `${pd.unpaidLeaveDays} يوم`,
      `−${fmt2(pd.unpaidLeaveDeduction)}`, "#dc2626", "#f9fafb"
    ));

    const deductionItems = pd.bonusItems.filter(b => b.type === "deduction");
    deductionItems.forEach((d, i) => {
      const isAdvance = d.source === "advance";
      dedRows.push(salaryRow(
        d.reason ?? "خصم",
        isAdvance ? "سلفة" : "خصم إداري",
        `−${fmt2(d.amount)}`, "#dc2626", i % 2 === 0 ? "#fff" : "#f9fafb"
      ));
    });

    const netBg  = pd.netSalary >= pd.baseSalary ? "#dcfce7" : "#fef3c7";
    const netClr = pd.netSalary >= pd.baseSalary ? "#16a34a"  : "#d97706";

    salarySection = `
      <div style="padding:20px 32px 0;">
        <h2 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 0;">💰 تفاصيل الراتب</h2>

        <!-- Additions -->
        <div style="margin-top:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07);">
          <div style="background:#4f46e5;color:#fff;padding:8px 14px;font-size:12px;font-weight:700;">⬆️ الإضافات</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#ede9fe;">
              <th style="padding:7px 12px;font-size:11px;color:#4f46e5;text-align:right;">البند</th>
              <th style="padding:7px 12px;font-size:11px;color:#4f46e5;text-align:right;">التفاصيل</th>
              <th style="padding:7px 12px;font-size:11px;color:#4f46e5;text-align:left;">المبلغ</th>
            </tr></thead>
            <tbody>${addRows.join("")}</tbody>
          </table>
        </div>

        <!-- Deductions -->
        ${dedRows.length > 0 ? `
        <div style="margin-top:14px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07);">
          <div style="background:#dc2626;color:#fff;padding:8px 14px;font-size:12px;font-weight:700;">⬇️ الخصومات</div>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#fee2e2;">
              <th style="padding:7px 12px;font-size:11px;color:#dc2626;text-align:right;">البند</th>
              <th style="padding:7px 12px;font-size:11px;color:#dc2626;text-align:right;">التفاصيل</th>
              <th style="padding:7px 12px;font-size:11px;color:#dc2626;text-align:left;">المبلغ</th>
            </tr></thead>
            <tbody>${dedRows.join("")}</tbody>
          </table>
        </div>` : ""}

        <!-- Net Salary -->
        <div style="margin-top:14px;border-radius:8px;background:${netBg};padding:14px 16px;display:flex;justify-content:space-between;align-items:center;border:2px solid ${netClr}30;">
          <span style="font-size:15px;font-weight:900;color:#1e293b;">✅ صافي الراتب</span>
          <span style="font-size:24px;font-weight:900;color:${netClr};">${fmt2(pd.netSalary)}</span>
        </div>

        <!-- Totals mini summary -->
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <div style="flex:1;min-width:120px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:13px;font-weight:800;color:#16a34a;">+${fmt2(pd.totalAdditions)}</div>
            <div style="font-size:10px;color:#6b7280;">إجمالي الإضافات</div>
          </div>
          <div style="flex:1;min-width:120px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:13px;font-weight:800;color:#dc2626;">−${fmt2(pd.totalDeductions)}</div>
            <div style="font-size:10px;color:#6b7280;">إجمالي الخصومات</div>
          </div>
          <div style="flex:1;min-width:120px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:13px;font-weight:800;color:#1d4ed8;">${fmt2(pd.baseSalary)}</div>
            <div style="font-size:10px;color:#6b7280;">الراتب الأساسي</div>
          </div>
        </div>
      </div>`;
  } else {
    // Fallback: simple 4-row summary when no payrollDetail
    salarySection = `
      <div style="padding:20px 32px 0;">
        <h2 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 14px;">💰 تفاصيل الراتب</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:9px 12px;background:#fff;border:1px solid #e2e8f0;color:#64748b;width:55%;">الراتب الأساسي</td><td style="padding:9px 12px;background:#fff;border:1px solid #e2e8f0;font-weight:600;">${fmt2(report.baseSalary)}</td></tr>
          <tr><td style="padding:9px 12px;background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;">مكافأة الإضافي</td><td style="padding:9px 12px;background:#f1f5f9;border:1px solid #e2e8f0;font-weight:600;color:#16a34a;">+${fmt2(report.overtimeBonus)}</td></tr>
          <tr><td style="padding:9px 12px;background:#fff;border:1px solid #e2e8f0;color:#64748b;">إجمالي الخصومات</td><td style="padding:9px 12px;background:#fff;border:1px solid #e2e8f0;font-weight:600;color:#dc2626;">−${fmt2(report.totalDeductions)}</td></tr>
          <tr><td style="padding:9px 12px;background:#dbeafe;border:1px solid #e2e8f0;color:#1e40af;"><strong>صافي الراتب</strong></td><td style="padding:9px 12px;background:#dbeafe;border:1px solid #e2e8f0;font-weight:700;color:#1d4ed8;font-size:16px;">${fmt2(report.netSalary)}</td></tr>
        </table>
      </div>`;
  }

  // ── Build detailed attendance log ────────────────────────────────────────
  const detailRows = (attendanceRecords ?? []).map((rec, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"};">
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;">${rec.date}</td>
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;">${fmtTime(rec.checkIn)}</td>
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;">${fmtTime(rec.checkOut)}</td>
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;">${fmtHours(rec.hoursWorked)}</td>
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;color:#7c3aed;">${rec.overtime > 0 ? fmtHours(rec.overtime) : "—"}</td>
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0f0f0;font-weight:700;color:${statusColor(rec.status)};">${statusLabel(rec.status)}${rec.lateMinutes > 0 ? ` (${rec.lateMinutes}د)` : ""}</td>
    </tr>`).join("");

  const detailSection = detailRows ? `
    <div style="padding:20px 32px 0;">
      <h2 style="font-size:15px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 14px;">📋 سجل الحضور التفصيلي</h2>
      <div style="overflow-x:auto;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07);">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#111827;color:#fff;">
              <th style="padding:8px 10px;text-align:right;font-weight:700;">التاريخ</th>
              <th style="padding:8px 10px;text-align:right;font-weight:700;">دخول</th>
              <th style="padding:8px 10px;text-align:right;font-weight:700;">خروج</th>
              <th style="padding:8px 10px;text-align:right;font-weight:700;">ساعات</th>
              <th style="padding:8px 10px;text-align:right;font-weight:700;">إضافي</th>
              <th style="padding:8px 10px;text-align:right;font-weight:700;">الحالة</th>
            </tr>
          </thead>
          <tbody>${detailRows}</tbody>
        </table>
      </div>
    </div>` : "";

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:660px;margin:auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4f46e5,#0ea5e9);padding:28px 32px;color:#fff;">
        <h1 style="margin:0;font-size:22px;font-weight:900;">${getAppName()}</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:.85;">التقرير الشهري التفصيلي — ${report.periodLabel}</p>
      </div>

      <!-- Greeting -->
      <div style="padding:22px 32px 0;">
        <p style="font-size:15px;margin:0 0 4px;">مرحباً <strong>${user.name}</strong>،</p>
        <p style="font-size:13px;color:#64748b;margin:0;">تقريرك الشهري الكامل لشهر <strong>${report.periodLabel}</strong> — يتضمن سجل الحضور وتفاصيل الراتب والمكافآت والخصومات.</p>
      </div>

      <!-- KPI Cards -->
      <div style="padding:18px 32px 0;display:flex;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:100px;background:#fff;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #16a34a;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="font-size:24px;font-weight:900;color:#16a34a;">${report.daysPresent}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">أيام الحضور</div>
        </div>
        <div style="flex:1;min-width:100px;background:#fff;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #dc2626;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="font-size:24px;font-weight:900;color:#dc2626;">${report.daysAbsent}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">أيام الغياب</div>
        </div>
        <div style="flex:1;min-width:100px;background:#fff;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="font-size:24px;font-weight:900;color:#f59e0b;">${report.lateArrivals}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">تأخيرات</div>
        </div>
        <div style="flex:1;min-width:100px;background:#fff;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #4f46e5;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="font-size:24px;font-weight:900;color:#4f46e5;">${report.totalHoursWorked.toFixed(1)}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">ساعات العمل</div>
        </div>
        <div style="flex:1;min-width:100px;background:#fff;border-radius:10px;padding:12px;text-align:center;border-top:3px solid #d97706;box-shadow:0 1px 3px rgba(0,0,0,.08);">
          <div style="font-size:24px;font-weight:900;color:#d97706;">${report.totalOvertimeHours.toFixed(1)}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:2px;">ساعات إضافية</div>
        </div>
      </div>

      <!-- Attendance Summary -->
      <div style="padding:18px 32px 0;">
        <h2 style="font-size:14px;font-weight:800;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:7px;margin:0 0 12px;">📊 ملخص الحضور</h2>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
          <tr><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;color:#64748b;font-size:12px;width:60%;">أيام العمل الرسمية</td><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;font-weight:700;font-size:12px;">${report.workingDaysInMonth} يوم</td></tr>
          <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">أيام الحضور الفعلية</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;font-weight:700;font-size:12px;color:#16a34a;">${report.daysPresent} يوم</td></tr>
          <tr><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">أيام الغياب</td><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;font-weight:700;font-size:12px;color:${report.daysAbsent > 0 ? "#dc2626" : "#16a34a"};">${report.daysAbsent} يوم</td></tr>
          ${pd && pd.paidLeaveDays > 0 ? `<tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">إجازة مدفوعة</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;font-weight:700;font-size:12px;color:#2563eb;">${pd.paidLeaveDays} يوم</td></tr>` : ""}
          ${pd && pd.unpaidLeaveDays > 0 ? `<tr><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">إجازة غير مدفوعة</td><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;font-weight:700;font-size:12px;color:#dc2626;">${pd.unpaidLeaveDays} يوم</td></tr>` : ""}
          <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">مرات التأخر</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;font-weight:700;font-size:12px;color:${report.lateArrivals > 0 ? "#f59e0b" : "#16a34a"};">${report.lateArrivals} مرة${pd && pd.totalLateMinutes > 0 ? ` (${pd.totalLateMinutes} دقيقة)` : ""}</td></tr>
          <tr><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">ساعات العمل الإجمالية</td><td style="padding:8px 12px;background:#fff;border:1px solid #f0f0f0;font-weight:700;font-size:12px;">${report.totalHoursWorked.toFixed(1)} ساعة</td></tr>
          <tr><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;color:#64748b;font-size:12px;">ساعات الإضافي</td><td style="padding:8px 12px;background:#f9fafb;border:1px solid #f0f0f0;font-weight:700;font-size:12px;color:#7c3aed;">${report.totalOvertimeHours.toFixed(1)} ساعة</td></tr>
          <tr><td style="padding:8px 12px;background:#dbeafe;border:1px solid #f0f0f0;color:#1e40af;font-size:12px;"><strong>نسبة الالتزام</strong></td><td style="padding:8px 12px;background:#dbeafe;border:1px solid #f0f0f0;font-weight:900;font-size:13px;color:#1d4ed8;">${attendancePct}%</td></tr>
        </table>
      </div>

      <!-- Salary (itemised or fallback) -->
      ${salarySection}

      <!-- Detailed Attendance Log -->
      ${detailSection}

      <!-- Footer -->
      <div style="margin-top:24px;padding:16px 32px;background:#f1f5f9;text-align:center;border-top:1px solid #e2e8f0;">
        <a href="${appUrl}" style="display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">فتح التطبيق</a>
        <p style="margin:12px 0 0;color:#94a3b8;font-size:10px;">${getAppName()} — نظام إدارة الحضور · ${report.period} · سري للاستخدام الداخلي</p>
      </div>
    </div>`;

  await send(user.email, subject, html);
}

export async function sendRejectionNotificationToUser(user: { name: string; email: string }) {
  const subject = `[${getAppName()}] Account Registration Update`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#dc2626;">Account Request Not Approved</h2>
      <p>Hi ${user.name},</p>
      <p>We're sorry to inform you that your account registration request for ${getAppName()} has not been approved at this time.</p>
      <p>Please contact your administrator if you believe this is a mistake.</p>
      <p style="margin-top:24px;color:#888;font-size:12px;">${getAppName()} — Employee Attendance System</p>
    </div>
  `;
  await send(user.email, subject, html);
}
