-- Run this in Supabase SQL Editor before testing check-in text analysis.
-- Stores the structured signals extracted from the athlete's free-text note.
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS text_analysis jsonb;
