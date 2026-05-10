-- 111_role_pickers.sql
-- Generic Discord role-picker panels. Each row is one reaction-role panel
-- the host can curate at runtime via /rolepicker. Replaces hard-coded notify
-- panel for everything except the legacy 3-kind notify panel (which keeps
-- working alongside).

CREATE TABLE IF NOT EXISTS public.discord_role_pickers (
  slug         text PRIMARY KEY,
  guild_id     text NOT NULL,
  channel_id   text,
  message_id   text,
  title        text NOT NULL,
  intro        text,
  options      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discord_role_pickers_message_idx
  ON public.discord_role_pickers (message_id)
  WHERE message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.discord_role_pickers_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS discord_role_pickers_touch ON public.discord_role_pickers;
CREATE TRIGGER discord_role_pickers_touch
BEFORE UPDATE ON public.discord_role_pickers
FOR EACH ROW EXECUTE FUNCTION public.discord_role_pickers_touch();

ALTER TABLE public.discord_role_pickers ENABLE ROW LEVEL SECURITY;

-- Bot uses service role; explicit deny for anon. authenticated users can read
-- (so a future admin UI on the site can list panels) but only service_role
-- can write.
DROP POLICY IF EXISTS discord_role_pickers_read ON public.discord_role_pickers;
CREATE POLICY discord_role_pickers_read
  ON public.discord_role_pickers FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.discord_role_pickers FROM PUBLIC;
REVOKE ALL ON public.discord_role_pickers FROM anon;
GRANT SELECT ON public.discord_role_pickers TO authenticated;
GRANT ALL ON public.discord_role_pickers TO service_role;
