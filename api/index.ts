import cors from "cors";
import express from "express";

import { checkOllama } from "./llm.js";
import authRoutes from "./routes/auth.js";
import matchRoutes from "./routes/match.js";
import planRoutes from "./routes/plans.js";
import profileRoutes from "./routes/profiles.js";
import ratingRoutes from "./routes/ratings.js";
import recipeRoutes from "./routes/recipes.js";
import translateRoutes from "./routes/translate.js";

const app = express();
const PORT = Number(process.env.API_PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const ollama = await checkOllama();
  res.json({
    status: "ok",
    ollama,
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
