import { Router } from "express";
import { z } from "zod";

import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  restrictions: z.array(z.string().min(1).max(80)).default([]),
  preferences: z.array(z.string().min(1).max(80)).default([]),
  allergies: z.array(z.string().min(1).max(80)).default([]),
  notes: z.string().max(2000).optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, restrictions, preferences, allergies, notes, created_at, updated_at
     FROM profiles WHERE user_id = $1 ORDER BY created_at ASC`,
    [req.user!.sub],
  );
  res.json({ profiles: rows });
});

router.post("/", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload" });
    return;
  }
  const { name, restrictions, preferences, allergies, notes } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO profiles (user_id, name, restrictions, preferences, allergies, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, restrictions, preferences, allergies, notes, created_at, updated_at`,
    [req.user!.sub, name, restrictions, preferences, allergies, notes ?? null],
  );
  res.status(201).json({ profile: rows[0] });
});

router.put("/:id", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile payload" });
    return;
  }
  const { name, restrictions, preferences, allergies, notes } = parsed.data;
  const { rows } = await pool.query(
    `UPDATE profiles
     SET name = $1, restrictions = $2, preferences = $3, allergies = $4, notes = $5, updated_at = now()
     WHERE id = $6 AND user_id = $7
     RETURNING id, name, restrictions, preferences, allergies, notes, created_at, updated_at`,
    [
      name,
      restrictions,
      preferences,
      allergies,
      notes ?? null,
      req.params.id,
      req.user!.sub,
    ],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({ profile: rows[0] });
});

router.delete("/:id", async (req, res) => {
  const { rowCount } = await pool.query(
    `DELETE FROM profiles WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user!.sub],
  );
  if (!rowCount) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.status(204).send();
});

export default router;
