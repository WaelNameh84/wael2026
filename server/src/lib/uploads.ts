import { Router } from "express";
import { createReadStream, existsSync } from "fs";
import path from "path";

const router = Router();

router.get("/uploads/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(process.cwd(), "uploads", filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.setHeader("Content-Type", "image/jpeg");
  createReadStream(filePath).pipe(res);
});

export default router;
