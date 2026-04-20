-- 052_go_live_hardening.sql
-- Foundation: unblock prize uploads, persist sponsors, lock results integrity,
-- add waitlist promotion, prize claim tracking, and admin RLS gaps.

-- =========================================================================
-- 1. STORAGE: allow admin/host uploads to host-assets/prizes/ folder
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can upload host assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload host assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'host-assets'
    AND (storage.foldername(name))[1] IN ('host-images', 'prizes', 'sponsors', 'tournament-banners')
  );

DROP POLICY IF EXISTS "Authenticated users can update host assets" ON storage.objects;
CREATE POLICY "Authenticated users can update host assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'host-assets'
    AND (
      owner = auth.uid()
      OR public.is_admin_or_mod(auth.uid())
    )
  );

-- =========================================================================
-- 2. SPONSORS table + RLS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  url TEXT,
  tier TEXT DEFAULT 'partner' CHECK (tier IN ('title','partner','supporter','prize','friend')),
  placement TEXT[] DEFAULT ARRAY[]::TEXT[],
  blurb TEXT,
  order_index INTEGER DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sponsors_active_order_idx ON public.sponsors(active, order_index);
CREATE INDEX IF NOT EXISTS sponsors_placement_gin ON public.sponsors USING GIN (placement);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active sponsors" ON public.sponsors;
CREATE POLICY "Public can read active sponsors" ON public.sponsors
  FOR SELECT USING (
    active = TRUE
    OR public.is_admin_or_mod(auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage sponsors" ON public.sponsors;
CREATE POLICY "Admins manage sponsors" ON public.sponsors
  FOR ALL TO authenticated
  USING (public.is_admin_or_mod(auth.uid()))
  WITH CHECK (public.is_admin_or_mod(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sponsors_touch_updated_at ON public.sponsors;
CREATE TRIGGER sponsors_touch_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 3. GAME RESULTS: integrity guard — no duplicate placements per game
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'game_results_unique_placement_per_game'
  ) THEN
    ALTER TABLE public.game_results
      ADD CONSTRAINT game_results_unique_placement_per_game
      UNIQUE (tournament_id, game_number, player_id);
  END IF;
END $$;

-- =========================================================================
-- 4. WAITLIST auto-promote trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_drop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_reg_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('registered','checked_in')
     AND NEW.status IN ('dropped','cancelled','waitlist','disqualified') THEN

    SELECT id INTO target_reg_id
    FROM public.registrations
    WHERE tournament_id = NEW.tournament_id
      AND status = 'waitlist'
    ORDER BY waitlist_position NULLS LAST, created_at ASC
    LIMIT 1;

    IF target_reg_id IS NOT NULL THEN
      UPDATE public.registrations
      SET status = 'registered',
          waitlist_position = NULL,
          waitlist_notified_at = NOW()
      WHERE id = target_reg_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS registrations_promote_waitlist ON public.registrations;
CREATE TRIGGER registrations_promote_waitlist
  AFTER UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist_on_drop();

-- =========================================================================
-- 5. PRIZE CLAIMS table — winner claim / redemption tracking
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.prize_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  placement INTEGER NOT NULL CHECK (placement BETWEEN 1 AND 8),
  prize_label TEXT NOT NULL,
  prize_type TEXT CHECK (prize_type IN ('cash','rp','code','physical','other')),
  prize_amount NUMERIC,
  prize_currency TEXT,
  prize_image_url TEXT,
  sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
  claim_code TEXT UNIQUE,
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed','claimed','shipped','delivered','disputed','refunded','forfeited')),
  claim_email TEXT,
  claim_address JSONB,
  claimed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, player_id, placement)
);

CREATE INDEX IF NOT EXISTS prize_claims_tournament_idx ON public.prize_claims(tournament_id);
CREATE INDEX IF NOT EXISTS prize_claims_player_idx ON public.prize_claims(player_id);
CREATE INDEX IF NOT EXISTS prize_claims_status_idx ON public.prize_claims(claim_status);

ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players read own claims" ON public.prize_claims;
CREATE POLICY "Players read own claims" ON public.prize_claims
  FOR SELECT USING (
    public.is_admin_or_mod(auth.uid())
    OR player_id IN (SELECT id FROM public.players WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Players claim own prize" ON public.prize_claims;
CREATE POLICY "Players claim own prize" ON public.prize_claims
  FOR UPDATE TO authenticated
  USING (player_id IN (SELECT id FROM public.players WHERE auth_user_id = auth.uid()))
  WITH CHECK (player_id IN (SELECT id FROM public.players WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage claims" ON public.prize_claims;
CREATE POLICY "Admins manage claims" ON public.prize_claims
  FOR ALL TO authenticated
  USING (public.is_admin_or_mod(auth.uid()))
  WITH CHECK (public.is_admin_or_mod(auth.uid()));

DROP TRIGGER IF EXISTS prize_claims_touch_updated_at ON public.prize_claims;
CREATE TRIGGER prize_claims_touch_updated_at
  BEFORE UPDATE ON public.prize_claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- 6. RLS gaps identified in audit
-- =========================================================================
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read tournament_results" ON public.tournament_results;
CREATE POLICY "Public read tournament_results" ON public.tournament_results FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Admins manage tournament_results" ON public.tournament_results;
CREATE POLICY "Admins manage tournament_results" ON public.tournament_results
  FOR ALL TO authenticated
  USING (public.is_admin_or_mod(auth.uid()))
  WITH CHECK (public.is_admin_or_mod(auth.uid()));

ALTER TABLE public.point_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage point_adjustments" ON public.point_adjustments;
CREATE POLICY "Admins manage point_adjustments" ON public.point_adjustments
  FOR ALL TO authenticated
  USING (public.is_admin_or_mod(auth.uid()))
  WITH CHECK (public.is_admin_or_mod(auth.uid()));
