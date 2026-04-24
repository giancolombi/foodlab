-- User-owned recipe forks. NULL owner_user_id = curated/seeded.
-- Slug remains globally unique; user copies get a slug suffix (e.g. "...-a3f2c1").
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_slug TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS modification_note TEXT;

CREATE INDEX IF NOT EXISTS recipes_owner_idx ON recipes(owner_user_id);
CREATE INDEX IF NOT EXISTS recipes_parent_idx ON recipes(parent_slug);
