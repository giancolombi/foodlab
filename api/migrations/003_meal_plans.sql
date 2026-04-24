-- Weekly meal plan per user. Each user has exactly one "current" plan.
-- The assignments column stores a JSON object keyed by slot (e.g. "0-dinner")
-- with values { slug, assignedAt }. The active_profile_ids column tracks
-- which dietary profiles are selected for this plan.
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignments JSONB NOT NULL DEFAULT '{}',
  active_profile_ids UUID[] NOT NULL DEFAULT '{}',
  include_serve_with BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
