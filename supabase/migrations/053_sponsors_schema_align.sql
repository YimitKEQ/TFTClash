-- Align sponsors table with existing UI shape: website, color, discount_code, notes.
ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.sponsors DROP CONSTRAINT IF EXISTS sponsors_tier_check;
ALTER TABLE public.sponsors
  ADD CONSTRAINT sponsors_tier_check
  CHECK (tier IN ('associate','official','title','partner','supporter','prize','friend'));

COMMENT ON COLUMN public.sponsors.placement IS 'Array of placement IDs (homepage, dashboard, bracket, footer, hall_of_fame, leaderboard, recap).';
COMMENT ON COLUMN public.sponsors.active IS 'UI "status" maps 1:1 - active=true, inactive=false.';
