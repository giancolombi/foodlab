import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import { signToken, verifyToken } from "../middleware/auth.js";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(100).optional(),
});

router.post("/signup", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password (min 8 chars)" });
    return;
  }
  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [normalizedEmail],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      [normalizedEmail, passwordHash, displayName ?? null],
    );

    const user = rows[0];
    const token = signToken({ sub: user.id, email: user.email });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  } catch (err) {
    console.error("signup error", err);
    res.status(500).json({ error: "Sign up failed" });
  }
});

router.post("/signin", async (req, res) => {
  const parsed = credentialsSchema
    .pick({ email: true, password: true })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, display_name
       FROM users WHERE email = $1`,
      [normalizedEmail],
    );
    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ sub: user.id, email: user.email });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  } catch (err) {
    console.error("signin error", err);
    res.status(500).json({ error: "Sign in failed" });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const { rows } = await pool.query(
      `SELECT id, email, display_name FROM users WHERE id = $1`,
      [payload.sub],
    );
    if (!rows[0]) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      user: {
        id: rows[0].id,
        email: rows[0].email,
        displayName: rows[0].display_name,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
