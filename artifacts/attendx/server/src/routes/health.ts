import { Router } from "express";
const router = Router();
router.get("/healthz", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
router.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
export default router;
