import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// Limits are env-tunable so test suites (which sign up a user per scenario)
// can raise them without code changes.
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT || 20);
const LLM_LIMIT = Number(process.env.LLM_RATE_LIMIT || 30);

// Brute-force guard for signin/signup — these run pre-auth, so key by IP.
// argon2 verification is deliberately CPU-expensive, which makes an
// unthrottled /signin double as a CPU-DoS amplifier.
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: AUTH_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts — try again in a few minutes" },
});

// LLM-backed endpoints carry per-call provider cost. Key by user (they all
// sit behind requireAuth) so one account can't burn the household quota;
// fall back to IP for safety if mounted before auth.
export const llmLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: LLM_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) =>
    req.user?.sub ?? ipKeyGenerator(req.ip ?? ""),
  message: { error: "Too many AI requests — try again in a few minutes" },
});
