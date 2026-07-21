import { Router } from "express";
import { db, usersTable, userSettingsTable, sessionsTable } from "../../../db/src/index.js";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { sendNewUserNotificationToAdmin } from "../lib/mailer.js";
import { createNotification } from "../lib/notify.js";

const router = Router();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── كلمة المرور: scrypt (آمن) مع ترقية تلقائية من SHA-256 القديم ─────────────
// الهاش الجديد: "scrypt:<salt_hex>:<hash_hex>"
// الهاش القديم: 64-حرف hex بدون prefix
function hashPassword(password: string): string {
  // استخدام SHA-256 القديم فقط للتحقق أثناء الترقية — لا تستخدم لإنشاء هاش جديد
  return crypto.createHash("sha256").update(password + "attendance_salt_2024").digest("hex");
}

async function hashPasswordSecure(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key))
  );
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith("scrypt:")) {
    const [, salt, hashHex] = storedHash.split(":");
    const hash = await new Promise<Buffer>((resolve, reject) =>
      crypto.scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key))
    );
    return crypto.timingSafeEqual(Buffer.from(hashHex, "hex"), hash);
  }
  // SHA-256 القديم — تحقق ثم رقّي في الخلفية
  return storedHash === hashPassword(password);
}

// ── حماية من Brute Force: حد أقصى 10 محاولات / 15 دقيقة لكل IP ─────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { blocked: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const WINDOW = 15 * 60 * 1000; // 15 دقيقة
  const MAX    = 10;

  let entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW };
    loginAttempts.set(ip, entry);
  }
  entry.count++;
  const remaining   = Math.max(0, MAX - entry.count);
  const resetInSec  = Math.ceil((entry.resetAt - now) / 1000);
  return { blocked: entry.count > MAX, remaining, resetInSec };
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

// تنظيف Map كل ساعة لمنع تراكم الإدخالات
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts) {
    if (now > val.resetAt) loginAttempts.delete(key);
  }
}, 60 * 60 * 1000);

function generateToken(userId: number): string {
  const payload = `${userId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`;
  return Buffer.from(payload).toString("base64");
}

async function createSession(userId: number): Promise<string> {
  const token = generateToken(userId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

async function getUserIdFromToken(token: string): Promise<number | null> {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    return null;
  }
  return session.userId;
}

export async function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  const userId = await getUserIdFromToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.userId = userId;
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  requireAuth(req, res, async () => {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    if (!user[0] || !["admin", "manager"].includes(user[0].role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = user[0];
    next();
  });
}

// فقط role === "admin" — المدير (manager) لا يملك صلاحية هذا المسار
export function requireSuperAdmin(req: any, res: any, next: any) {
  requireAuth(req, res, async () => {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    if (!user[0] || user[0].role !== "admin") {
      return res.status(403).json({ error: "Super-admin access required" });
    }
    req.user = user[0];
    next();
  });
}

function appUrl(): string {
  return process.env.REPLIT_APP_URL ?? process.env.APP_URL ?? "https://building-block--ellanam2.replit.app";
}

router.post("/register", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
    });
    const body = schema.parse(req.body);
    const emailNorm = body.email.trim().toLowerCase();
    const existing = await db.select().from(usersTable)
      .where(sql`LOWER(${usersTable.email}) = ${emailNorm}`)
      .limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Security: the public registration form can never create an admin account.
    // The only exception is bootstrapping the very first account in a brand-new
    // system (no admin exists yet) so the app isn't permanently locked out.
    const [existingAdmin] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.role, "admin")).limit(1);
    const isAdmin = !existingAdmin;

    const [user] = await db.insert(usersTable).values({
      name: body.name,
      email: body.email,
      passwordHash: await hashPasswordSecure(body.password),
      role: isAdmin ? "admin" : "employee",
      isApproved: isAdmin,
    }).returning();
    await db.insert(userSettingsTable).values({ userId: user.id }).onConflictDoNothing();

    if (!isAdmin) {
      sendNewUserNotificationToAdmin({ name: body.name, email: body.email, role: "employee" }, appUrl()).catch(console.error);
      createNotification({
        type: "REGISTRATION",
        title: `New sign-up: ${body.name}`,
        message: `${body.name} (${body.email}) registered and is awaiting approval.`,
        relatedId: user.id,
        relatedType: "user",
      }).catch(console.error);
      return res.status(202).json({ pending: true, message: "Account pending admin approval" });
    }

    const token = await createSession(user.id);
    const { passwordHash, ...safeUser } = user;
    return res.status(201).json({ user: safeUser, token });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  // ── Brute Force Protection ────────────────────────────────────────────────
  const ip = (req.headers["x-forwarded-for"] as string ?? req.socket.remoteAddress ?? "unknown")
    .split(",")[0].trim();
  const rate = checkRateLimit(ip);
  if (rate.blocked) {
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${Math.ceil(rate.resetInSec / 60)} minutes.`,
      code: "RATE_LIMITED",
    });
  }

  try {
    const schema = z.object({ email: z.string(), password: z.string() });
    const body = schema.parse(req.body);
    const emailNorm = body.email.trim().toLowerCase();
    const [user] = await db.select().from(usersTable)
      .where(sql`LOWER(${usersTable.email}) = ${emailNorm}`)
      .limit(1);

    const valid = user ? await verifyPassword(body.password.trim(), user.passwordHash) : false;
    if (!user || !valid) {
      return res.status(401).json({
        error: "Invalid email or password",
        attemptsLeft: rate.remaining,
      });
    }

    // ترقية تلقائية من SHA-256 إلى scrypt عند أول تسجيل دخول ناجح
    if (!user.passwordHash.startsWith("scrypt:")) {
      hashPasswordSecure(body.password.trim()).then(newHash =>
        db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id))
      ).catch(() => {});
    }

    if (!user.isApproved) {
      return res.status(403).json({ error: "Account pending approval", code: "PENDING_APPROVAL" });
    }

    clearRateLimit(ip); // بعد النجاح امسح عداد المحاولات
    const token = await createSession(user.id);
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser, token });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/logout", async (req: any, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token)).catch(() => {});
  }
  return res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { passwordHash, ...safeUser } = user;
    return res.json(safeUser);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/change-password", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({ currentPassword: z.string(), newPassword: z.string().min(6) });
    const body = schema.parse(req.body);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
    const valid = user ? await verifyPassword(body.currentPassword, user.passwordHash) : false;
    if (!user || !valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const newHash = await hashPasswordSecure(body.newPassword);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.userId));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
