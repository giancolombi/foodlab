-- Recipe servings count. Nullable — most existing recipes don't specify
-- one explicitly; only a handful (mostly breakfasts) include a "Makes: N"
-- line. The parser fills it in when present and the quick-edit ladder
-- uses it as the denominator for "scale to N servings" instead of
-- assuming 4.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS servings INT;
