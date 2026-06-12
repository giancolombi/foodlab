import cors from "cors";
import express from "express";

import { pool } from "./db.js";
import { checkLLM } from "./llm.js";
import authRoutes from "./routes/auth.js";
import matchRoutes from "./routes/match.js";
import planRoutes from "./routes/plans.js";
import profileRoutes from "./routes/profiles.js";
import ratingRoutes from "./routes/ratings.js";
import recipeRoutes from "./routes/recipes.js";
import translateRoutes from "./routes/translate.js";

const app = express();
const PORT = Number(process.env.API_PORT || 3001);

// nginx (and Railway's edge) sit in front of the API — trust them so req.ip
// reflects the real client for rate limiting. Override hop count if needed.
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

// Auth is Bearer-token (no cookies), so wildcard CORS is low-risk — but allow
// locking to specific origins in production via a comma-separated env var.
const corsOrigins = process.env.CORS_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(corsOrigins?.length ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const llm = await checkLLM();
  let db: { ok: boolean; error?: string };
  try {
    await pool.query("SELECT 1");
    db = { ok: true };
  } catch (err) {
    db = { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? "ok" : "degraded",
    db,
    llm,
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/translate", translateRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
});
