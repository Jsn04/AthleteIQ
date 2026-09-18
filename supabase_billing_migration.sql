-- Run this in Supabase SQL Editor before deploying the billing changes.

-- plan_tier      which tier they bought (coach / academy / institution)
-- billing_cycle  monthly or annual
-- paid_until     when paid access lapses. NULL on a paid row means a legacy
--                payment made before expiry existed; those are grandfathered.
ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS plan_tier     text,
  ADD COLUMN IF NOT EXISTS billing_cycle text,
  ADD COLUMN IF NOT EXISTS paid_until    timestamptz;

CREATE INDEX IF NOT EXISTS academies_paid_until_idx ON academies (paid_until);
