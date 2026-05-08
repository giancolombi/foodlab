-- Recipes are stored pre-translated in every supported locale instead of
-- being translated at request time. Each (slug, locale) is one row.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- The old UNIQUE on slug alone has to go so the same slug can carry
-- multiple translations. Drop it if it's still around (migrations may have
-- been run incrementally), then add the composite.
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS recipes_slug_locale_idx ON recipes(slug, locale);
CREATE INDEX IF NOT EXISTS recipes_locale_idx ON recipes(locale);
