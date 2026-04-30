-- Migration 095: cut_line + cut_after_game on tournaments
--
-- The clash form already lets admins set cut_line / cut_after_game (e.g. cut to
-- top 13 after game 4 for a 128-player competitive tournament), but the columns
-- were never persisted. The custom-tournament admin form is gaining the same
-- option in the UI, so persist both there too.
--
-- Both columns default to 0 to mean "no cut", which matches the existing
-- behaviour for every tournament that's been run so far.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS cut_line INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cut_after_game INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tournaments.cut_line IS
  'If > 0, the top N players (by points) advance after cut_after_game. 0 = no cut.';

COMMENT ON COLUMN public.tournaments.cut_after_game IS
  'Game number after which the cut is applied (1-indexed). 0 = no cut.';

-- Sanity: cut_after_game must be < round_count when a cut is configured.
-- We use a deferred check so existing draft rows that get the default (0,0)
-- always pass.
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_cut_consistency_chk
  CHECK (
    (cut_line = 0 AND cut_after_game = 0)
    OR (cut_line > 0 AND cut_after_game > 0 AND cut_after_game < round_count)
  ) NOT VALID;
