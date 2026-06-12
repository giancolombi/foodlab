import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// Brute-force guard for signin/signup — these run pre-auth, so key by IP.
// argon2 verification is deliberately CPU-expensive, which makes an
// unthrottled /signin double as a CPU-DoS amplifier.
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts — try again in a few minutes" },
});

// LLM-backed endpoints carry per-call provider cost. Key by user (they all
// sit behind requireAuth) so one account can't burn the household quota;
// fall back to IP for safety if mounted before auth.
export const llmLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) =>
    req.user?.sub ?? ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many AI requests — try again in a few minutes" },
});
