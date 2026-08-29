-- Run this in Supabase SQL Editor before the injury-risk DB-backed cache
-- can persist across deploys / Render spin-downs.
CREATE TABLE IF NOT EXISTS ai_injury_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_name text NOT NULL,
  academy_id   text NOT NULL,
  result       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_name, academy_id)
);
