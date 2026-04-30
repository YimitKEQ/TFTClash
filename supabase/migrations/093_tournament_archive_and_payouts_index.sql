-- Migration 093: tournament archive marker + prize_claims listing index
-- Adds:
--   1. tournaments.archived_at (TIMESTAMPTZ) for soft-archive without losing data
--   2. partial index for fast filtering of archived tournaments
--   3. prize_claims composite index for the admin Payouts dashboard,
--      which filters by claim_status and orders by created_at DESC.

-- 1. archived_at column on tournaments
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.tournaments.archived_at IS
  'Set when admin force-archives a tournament. Phase=complete + archived_at IS NOT NULL means it is hidden from upcoming/live feeds but registrations and results remain.';

-- 2. partial index for the "show archived" filter (cheap because most rows have NULL)
CREATE INDEX IF NOT EXISTS tournaments_archived_at_idx
  ON public.tournaments (archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- 3. prize_claims listing index (admin Payouts tab)
CREATE INDEX IF NOT EXISTS prize_claims_status_created_idx
  ON public.prize_claims (claim_status, created_at DESC);
