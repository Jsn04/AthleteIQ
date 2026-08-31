-- Run this in Supabase SQL Editor before testing the DM feature.
-- One thread per athlete per academy (coach is a single shared identity
-- per academy, same as the rest of the app), so no separate threads table.
CREATE TABLE IF NOT EXISTS messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id   text NOT NULL,
  athlete_name text NOT NULL,
  sender       text NOT NULL CHECK (sender IN ('coach', 'athlete')),
  text         text NOT NULL,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx
  ON messages (academy_id, athlete_name, created_at);

-- Tenant isolation is enforced in the backend (every query filters by
-- academy_id), same as every other table in this app. Match that model
-- instead of leaving RLS on with no policy, which blocks every insert.
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
