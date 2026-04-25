-- Migration 072: Per-region tournament_state slots
--
-- The legacy `site_settings.tournament_state` row holds the "active weekly
-- clash" config (date, phase, prize pool, registered ids, etc.). With one
-- global row, scheduling an NA clash overwrites the EU clash and vice versa.
--
-- This migration adds a second slot, `tournament_state_na`, so EU and NA can
-- run concurrently. The legacy `tournament_state` row continues to act as the
-- EU slot (renaming is risky given the number of references).
--
-- Idempotent.

BEGIN;

INSERT INTO public.site_settings (key, value, updated_at)
VALUES (
  'tournament_state_na',
  '{}'::text,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- If the existing tournament_state happens to be NA-keyed (server = 'NA'),
-- migrate it into the NA slot and reset EU to empty so admin can re-schedule.
DO $$
DECLARE
  existing_value text;
  parsed jsonb;
BEGIN
  SELECT value INTO existing_value FROM public.site_settings WHERE key = 'tournament_state';
  IF existing_value IS NOT NULL THEN
    BEGIN
      parsed := existing_value::jsonb;
      IF parsed->>'server' = 'NA' THEN
        UPDATE public.site_settings
          SET value = existing_value, updated_at = NOW()
          WHERE key = 'tournament_state_na';
        UPDATE public.site_settings
          SET value = '{}'::text, updated_at = NOW()
          WHERE key = 'tournament_state';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- value isn't valid JSON; leave it alone
      NULL;
    END;
  END IF;
END $$;

COMMIT;
