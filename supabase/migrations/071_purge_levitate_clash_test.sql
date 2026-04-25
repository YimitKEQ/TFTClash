-- Migration 071: Hard-delete "Levitate's Clash Test" data
--
-- Removes the dummy/QA tournament rows that leaked into production. Matches by
-- name (case-insensitive) on the tournaments table; cascades to registrations,
-- lobbies, game_results, etc. via existing FKs.
--
-- Idempotent: safe to re-run. No-op if the rows are already gone.

BEGIN;

-- 1. Purge tournaments named like the test clash
DELETE FROM public.tournaments
WHERE LOWER(name) LIKE '%levitate%clash%test%'
   OR LOWER(name) LIKE '%clash test%levitate%'
   OR LOWER(name) = 'test clash'
   OR LOWER(name) = 'levitate test';

-- 2. Drop any flash_tournaments with the same vibes
DO $$
BEGIN
  IF to_regclass('public.flash_tournaments') IS NOT NULL THEN
    DELETE FROM public.flash_tournaments
    WHERE LOWER(name) LIKE '%levitate%clash%test%'
       OR LOWER(name) LIKE '%clash test%levitate%'
       OR LOWER(name) = 'test clash'
       OR LOWER(name) = 'levitate test';
  END IF;
END $$;

-- 3. Clean any leftover audit_log mentions (best-effort, drops the trail too)
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    DELETE FROM public.audit_log
    WHERE LOWER(action) LIKE '%levitate%clash%test%'
       OR LOWER(detail) LIKE '%levitate%clash%test%';
  END IF;
END $$;

COMMIT;
