-- Run this in Supabase SQL Editor before testing the gym feature

-- 1. Academy type flag: gates the gym pipeline vs the sport one.
ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS academy_type text NOT NULL DEFAULT 'sport';

-- 2. Trainer-logged gym sessions live in `checkins` alongside member check-ins.
--    `logged_by` is what separates the two: NULL = member self check-in,
--    'trainer' = a session the trainer logged for them.
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS logged_by        text,
  ADD COLUMN IF NOT EXISTS workout_type     text,
  ADD COLUMN IF NOT EXISTS muscle_groups    text[],
  ADD COLUMN IF NOT EXISTS session_duration integer,
  ADD COLUMN IF NOT EXISTS intensity        text,
  ADD COLUMN IF NOT EXISTS progression      text,
  ADD COLUMN IF NOT EXISTS goal_progress    text;

-- 3. A trainer session carries no wellness scores, so those columns must accept
--    NULL. (No-ops if they are already nullable.)
ALTER TABLE checkins ALTER COLUMN energy   DROP NOT NULL;
ALTER TABLE checkins ALTER COLUMN sleep    DROP NOT NULL;
ALTER TABLE checkins ALTER COLUMN soreness DROP NOT NULL;
ALTER TABLE checkins ALTER COLUMN mood     DROP NOT NULL;

-- 4. Both gym reads filter on logged_by, so index it.
CREATE INDEX IF NOT EXISTS checkins_academy_logged_by_idx
  ON checkins (academy_id, logged_by, created_at DESC);
