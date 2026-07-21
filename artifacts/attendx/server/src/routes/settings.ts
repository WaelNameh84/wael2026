import { Router } from "express";
import { db, userSettingsTable } from "../../../db/src/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import {
  getAppName, saveAppName, getAppLogo, saveAppLogo,
  getWorkStartTime, saveWorkStartTime, getLateGraceMinutes, saveLateGraceMinutes,
  getBreakMinutes, saveBreakMinutes,
  getAppTimezone, saveAppTimezone,
  getCloudinaryConfig, saveCloudinaryConfig, clearCloudinaryConfig, isCloudinaryConfigured,
  getVapidConfig, saveVapidConfig, clearVapidConfig, isVapidConfigured, maskKey,
  getManagerApiAccess, saveManagerApiAccess,
  getGpsEnabled, saveGpsEnabled, getGpsRadius, saveGpsRadius,
  getLogoDisplaySettings, saveLogoDisplaySettings,
  getUiSettings, saveUiSettings, persistBatch,
} from "../lib/gemini-config.js";
import { initVapid } from "./push.js";
import { getPrimaryAdminEmail } from "../lib/mailer.js";

const router = Router();

function appConfigResponse(adminEmail: string) {
  return {
    appName: getAppName(),
    appLogo: getAppLogo(),
    adminEmail,
    workStartTime: getWorkStartTime(),
    lateGraceMinutes: getLateGraceMinutes(),
    breakMinutes: getBreakMinutes(),
    appTimezone: getAppTimezone(),
    gpsEnabled: getGpsEnabled(),
    gpsRadius: getGpsRadius(),
    ...getLogoDisplaySettings(),
    uiSettings: getUiSettings(),
  };
}

router.get("/app", async (_req, res) => {
  try {
    const adminEmail = await getPrimaryAdminEmail();
    return res.json(appConfigResponse(adminEmail ?? ""));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/app", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = z.object({
      appName: z.string().min(1).max(100).optional(),
      appLogo: z.string().optional(),
      workStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      lateGraceMinutes: z.number().int().min(0).max(120).optional(),
      breakMinutes: z.number().int().min(0).max(240).optional(),
      appTimezone: z.string().min(1).max(100).optional(),
      gpsEnabled: z.boolean().optional(),
      gpsRadius: z.number().int().min(50).max(50000).optional(),
      // Logo display settings
      logoWidth:     z.number().int().min(24).max(300).optional(),
      logoHeight:    z.number().int().min(24).max(300).optional(),
      logoRotation:  z.number().int().min(-180).max(180).optional(),
      logoOffsetX:   z.number().int().min(-200).max(200).optional(),
      logoOffsetY:   z.number().int().min(-200).max(200).optional(),
      logoBgEnabled: z.boolean().optional(),
      logoBgColor:   z.string().max(20).optional(),
      logoBgOpacity: z.number().int().min(0).max(100).optional(),
      logoBgRadius:  z.number().int().min(0).max(100).optional(),
      // Global UI settings blob — partial patch merged into existing blob
      uiSettings: z.record(z.unknown()).optional(),
    }).parse(req.body);

    // Collect all changes and write to DB in a single operation
    const changes: Record<string, unknown> = {};
    if (body.appName !== undefined) changes.appName = body.appName.trim();
    if (body.appLogo !== undefined) changes.appLogo = body.appLogo;
    if (body.workStartTime !== undefined) changes.workStartTime = body.workStartTime;
    if (body.lateGraceMinutes !== undefined) changes.lateGraceMinutes = body.lateGraceMinutes;
    if (body.breakMinutes !== undefined) changes.breakMinutes = body.breakMinutes;
    if (body.appTimezone !== undefined) changes.appTimezone = body.appTimezone;
    if (body.gpsEnabled !== undefined) changes.gpsEnabled = body.gpsEnabled;
    if (body.gpsRadius !== undefined) changes.gpsRadius = body.gpsRadius;
    if (body.logoWidth !== undefined) changes.logoWidth = body.logoWidth;
    if (body.logoHeight !== undefined) changes.logoHeight = body.logoHeight;
    if (body.logoRotation !== undefined) changes.logoRotation = body.logoRotation;
    if (body.logoOffsetX !== undefined) changes.logoOffsetX = body.logoOffsetX;
    if (body.logoOffsetY !== undefined) changes.logoOffsetY = body.logoOffsetY;
    if (body.logoBgEnabled !== undefined) changes.logoBgEnabled = body.logoBgEnabled;
    if (body.logoBgColor !== undefined) changes.logoBgColor = body.logoBgColor;
    if (body.logoBgOpacity !== undefined) changes.logoBgOpacity = body.logoBgOpacity;
    if (body.logoBgRadius !== undefined) changes.logoBgRadius = body.logoBgRadius;

    // Merge partial UI settings into the existing blob
    if (body.uiSettings && Object.keys(body.uiSettings).length > 0) {
      const current = getUiSettings();
      changes.uiSettings = JSON.stringify({ ...current, ...body.uiSettings });
    }

    // Single DB write for all changes
    if (Object.keys(changes).length > 0) {
      persistBatch(changes as any);
    }

    const adminEmail = await getPrimaryAdminEmail();
    return res.json(appConfigResponse(adminEmail ?? ""));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get("/", requireAuth, async (req: any, res) => {
  try {
    const existing = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, req.userId)).limit(1);
    if (existing.length === 0) {
      const [created] = await db.insert(userSettingsTable).values({ userId: req.userId }).returning();
      return res.json(created);
    }
    return res.json(existing[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/", requireAuth, async (req: any, res) => {
  try {
    const schema = z.object({
      theme: z.enum(["light", "dark", "system", "ocean", "forest", "rose", "sunset", "purple", "gold", "ruby", "slate", "indigo", "lime", "coral", "midnight"]).optional(),
      fontSize: z.enum(["small", "medium", "large"]).optional(),
      language: z.enum(["ar", "en", "sv"]).optional(),
    });
    const body = schema.parse(req.body);
    await db.insert(userSettingsTable).values({ userId: req.userId, ...body }).onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: body,
    });
    const [settings] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, req.userId)).limit(1);
    return res.json(settings);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ─── AI Key — stored in DB (persists across deployments) ─── */

router.get("/my-ai-key", requireAuth, async (req: any, res) => {
  try {
    const [row] = await db.select({ aiKey: userSettingsTable.aiKey })
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, req.userId))
      .limit(1);
    const key = row?.aiKey ?? "";
    return res.json({
      hasKey: !!key,
      maskedKey: key ? key.slice(0, 8) + "••••••••" + key.slice(-4) : null,
      key,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/my-ai-key", requireAuth, async (req: any, res) => {
  try {
    const { key } = z.object({ key: z.string() }).parse(req.body);
    await db.insert(userSettingsTable)
      .values({ userId: req.userId, aiKey: key || null })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: { aiKey: key || null },
      });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

/* ─── Integration Keys (Cloudinary + VAPID) ─── */

router.get("/integrations", requireAuth, requireAdmin, async (_req, res) => {
  const cl = getCloudinaryConfig();
  const vp = getVapidConfig();
  return res.json({
    cloudinary: {
      configured: isCloudinaryConfigured(),
      cloudName:  cl.cloudName  ? maskKey(cl.cloudName)  : null,
      apiKey:     cl.apiKey     ? maskKey(cl.apiKey)      : null,
      apiSecret:  cl.apiSecret  ? maskKey(cl.apiSecret)   : null,
    },
    vapid: {
      configured:  isVapidConfigured(),
      publicKey:   vp.publicKey  ? maskKey(vp.publicKey)  : null,
      privateKey:  vp.privateKey ? maskKey(vp.privateKey) : null,
      email:       vp.email ?? null,
    },
  });
});

router.post("/integrations/cloudinary", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = z.object({
      cloudName: z.string().min(1),
      apiKey:    z.string().min(1),
      apiSecret: z.string().min(1),
    }).parse(req.body);
    saveCloudinaryConfig({ cloudName: body.cloudName.trim(), apiKey: body.apiKey.trim(), apiSecret: body.apiSecret.trim() });
    return res.json({ ok: true, configured: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/integrations/cloudinary", requireAuth, requireAdmin, async (_req, res) => {
  clearCloudinaryConfig();
  return res.json({ ok: true, configured: false });
});

router.post("/integrations/vapid", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = z.object({
      publicKey:  z.string().min(1),
      privateKey: z.string().min(1),
      email:      z.string().optional(),
    }).parse(req.body);
    saveVapidConfig({ publicKey: body.publicKey.trim(), privateKey: body.privateKey.trim(), email: body.email?.trim() });
    initVapid();   // re-init webpush with new keys immediately
    return res.json({ ok: true, configured: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete("/integrations/vapid", requireAuth, requireAdmin, async (_req, res) => {
  clearVapidConfig();
  return res.json({ ok: true, configured: false });
});

// ── Manager API Keys access toggle ────────────────────────────────────────────
router.get("/integrations/manager-api-access", requireAuth, async (_req, res) => {
  // managers need to read this to know if they can see the API keys section
  return res.json({ allowed: getManagerApiAccess() });
});

router.post("/integrations/manager-api-access", requireAuth, requireAdmin, async (req, res) => {
  const { allowed } = z.object({ allowed: z.boolean() }).parse(req.body);
  saveManagerApiAccess(allowed);
  return res.json({ ok: true, allowed });
});

export default router;
