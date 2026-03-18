-- ============================================================
-- RECOMMENDED-MIGRATIONS.sql
-- TFT Clash — Fixes for audit findings
-- Apply in order. All migrations are idempotent.
-- ============================================================

-- ============================================================
-- FIX-001: Rename unnumbered migrations (manual step — rename files)
-- create_tournaments.sql         -> 000_create_tournaments.sql
-- add_site_settings.sql          -> 000b_add_site_settings.sql
-- create_subscriptions.sql       -> 026_create_subscriptions.sql
-- create_tournament_results.sql  -> 027_create_tournament_results.sql
-- add_discord_user_id.sql        -> (already covered by 001)
-- tighten_site_settings_rls.sql  -> 028_tighten_site_settings_rls.sql
-- ============================================================

-- ============================================================
-- FIX-002: Fix broken RLS policies (CRITICAL C-1, C-2, C-3, H-1, H-2, H-3)
-- ============================================================

-- C-3: Drop the permissive "write all" site_settings policy
DROP POLICY IF EXISTS "write all" ON site_settings;

-- C-1: Fix registrations UPDATE — require ownership via player link
DROP POLICY IF EXISTS "Authenticated users can update own registration" ON registrations;
CREATE POLICY "Authenticated users can update own registration"
  ON registrations FOR UPDATE
  TO authenticated
  USING (
    player_id = (
      SELECT id FROM players WHERE auth_user_id = (SELECT auth.uid())
    )
  );

-- C-2: Remove open game_results write policies; restrict to service_role only
DROP POLICY IF EXISTS "Authenticated users can insert game results" ON game_results;
DROP POLICY IF EXISTS "Authenticated users can update game results" ON game_results;
DROP POLICY IF EXISTS "Authenticated users can delete game_results" ON game_results;

-- H-1: Fix players INSERT — must own the row
DROP POLICY IF EXISTS "Authenticated users can insert players" ON players;
CREATE POLICY "Authenticated users can insert own player"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- H-2: Fix players DELETE — restrict to service_role
DROP POLICY IF EXISTS "Authenticated users can delete players" ON players;

-- H-3: Fix seasons INSERT — service_role only
DROP POLICY IF EXISTS "Authenticated can insert seasons" ON seasons;

-- H-4: Fix tournament_rounds — require tournament ownership
DROP POLICY IF EXISTS "Authenticated users can insert tournament_rounds" ON tournament_rounds;
DROP POLICY IF EXISTS "Authenticated users can update tournament_rounds" ON tournament_rounds;

CREATE POLICY "Hosts can insert tournament_rounds"
  ON tournament_rounds FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND t.host_user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Hosts can update tournament_rounds"
  ON tournament_rounds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND t.host_user_id = (SELECT auth.uid())
    )
  );

-- M-3: Fix notifications INSERT — service_role only
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;

-- M-4: Fix audit_log INSERT — service_role only
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON audit_log;

-- L-3: Fix host_profiles SELECT policy
DROP POLICY IF EXISTS "Anyone can read approved host profiles" ON host_profiles;
CREATE POLICY "Anyone can read approved host profiles"
  ON host_profiles FOR SELECT
  USING (status = 'approved' OR user_id = (SELECT auth.uid()));

-- L-4: Remove redundant permissive user_roles SELECT policy
DROP POLICY IF EXISTS "Authenticated can read roles" ON user_roles;

-- ============================================================
-- FIX-003: Fix FK type mismatches (CRITICAL H-6)
-- ============================================================

ALTER TABLE seasons
  DROP CONSTRAINT IF EXISTS seasons_champion_player_id_fkey;
ALTER TABLE seasons
  ALTER COLUMN champion_player_id TYPE bigint
    USING CASE WHEN champion_player_id IS NULL THEN NULL
               ELSE champion_player_id::text::bigint END;
ALTER TABLE seasons
  ADD CONSTRAINT seasons_champion_player_id_fkey
    FOREIGN KEY (champion_player_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE player_achievements
  DROP CONSTRAINT IF EXISTS player_achievements_player_id_fkey;
ALTER TABLE player_achievements
  ALTER COLUMN player_id TYPE bigint
    USING player_id::text::bigint;
ALTER TABLE player_achievements
  ADD CONSTRAINT player_achievements_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE tournament_results
  ALTER COLUMN player_id SET NOT NULL;
ALTER TABLE tournament_results
  ADD CONSTRAINT tournament_results_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS tournament_results_tournament_idx
  ON tournament_results (tournament_id);
CREATE INDEX IF NOT EXISTS tournament_results_player_idx
  ON tournament_results (player_id);

-- ============================================================
-- FIX-004: Fix broken stats trigger (CRITICAL H-5)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_player_stats()
RETURNS TRIGGER AS $$
DECLARE
  pid BIGINT;  -- was UUID — now correct bigint to match players.id
BEGIN
  IF TG_OP = 'DELETE' THEN
    pid := OLD.player_id;
  ELSE
    pid := NEW.player_id;
  END IF;

  UPDATE players SET
    season_pts    = COALESCE(s.total_pts, 0),
    wins          = COALESCE(s.wins, 0),
    top4          = COALESCE(s.top4, 0),
    games         = COALESCE(s.games, 0),
    avg_placement = COALESCE(s.avg_placement, 0),
    updated_at    = now()
  FROM (
    SELECT
      player_id,
      COUNT(*) FILTER (WHERE NOT is_dnp)       AS games,
      COALESCE(SUM(points), 0)                 AS total_pts,
      SUM(CASE WHEN placement = 1 AND NOT is_dnp THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN placement <= 4 AND NOT is_dnp THEN 1 ELSE 0 END) AS top4,
      ROUND(AVG(placement) FILTER (WHERE NOT is_dnp)::numeric, 1)   AS avg_placement
    FROM game_results
    WHERE player_id = pid
    GROUP BY player_id
  ) s
  WHERE players.id = pid AND s.player_id = pid;

  IF NOT FOUND AND TG_OP = 'DELETE' THEN
    UPDATE players SET
      season_pts = 0, wins = 0, top4 = 0,
      games = 0, avg_placement = 0, updated_at = now()
    WHERE id = pid;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_player_stats ON game_results;
CREATE TRIGGER trg_refresh_player_stats
  AFTER INSERT OR UPDATE OR DELETE ON game_results
  FOR EACH ROW
  EXECUTE FUNCTION refresh_player_stats();

-- ============================================================
-- FIX-005: Add game_number column to game_results (M-1)
-- ============================================================

ALTER TABLE game_results ADD COLUMN IF NOT EXISTS game_number INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS game_results_tournament_game_order_idx
  ON game_results (tournament_id, round_number, game_number DESC);

-- ============================================================
-- FIX-006: Add DNP/DQ tracking to registrations (M-7)
-- ============================================================

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS dnp_count INT NOT NULL DEFAULT 0;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS disqualified_reason TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS registrations_disqualified_idx
  ON registrations (tournament_id, disqualified)
  WHERE disqualified = true;

CREATE INDEX IF NOT EXISTS registrations_waitlist_idx
  ON registrations (tournament_id, waitlist_position)
  WHERE status = 'waitlisted';

-- ============================================================
-- FIX-007: Add CHECK constraint to players.rank (M-8)
-- ============================================================

UPDATE players SET rank = initcap(lower(rank)) WHERE rank IS NOT NULL;

ALTER TABLE players
  ADD CONSTRAINT players_rank_check
    CHECK (rank IN (
      'Iron','Bronze','Silver','Gold','Platinum',
      'Emerald','Diamond','Master','Grandmaster','Challenger'
    ));

-- ============================================================
-- FIX-008: Add updated_at trigger to players (M-10)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- FIX-009: Add subscription billing columns (M-6)
-- ============================================================

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- FIX-010: Add GIN index on tournament_rounds.lobby_assignments
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tournament_rounds_lobby_assignments_gin
  ON tournament_rounds USING GIN (lobby_assignments);

-- ============================================================
-- NEW-001: lobby_players junction table
-- ============================================================

CREATE TABLE IF NOT EXISTS lobby_players (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lobby_id     BIGINT NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed_rank    INT,
  is_lobby_host BOOLEAN NOT NULL DEFAULT false,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lobby_id, player_id)
);

CREATE INDEX IF NOT EXISTS lobby_players_lobby_idx  ON lobby_players (lobby_id);
CREATE INDEX IF NOT EXISTS lobby_players_player_idx ON lobby_players (player_id);

ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read lobby_players"    ON lobby_players FOR SELECT USING (true);
CREATE POLICY "Service role manages lobby_players" ON lobby_players FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- NEW-002: head_to_head table
-- ============================================================

CREATE TABLE IF NOT EXISTS head_to_head (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id    BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  game_number      INT NOT NULL DEFAULT 1,
  player_a_id      BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_b_id      BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_a_placement INT NOT NULL CHECK (player_a_placement BETWEEN 1 AND 8),
  player_b_placement INT NOT NULL CHECK (player_b_placement BETWEEN 1 AND 8),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (player_a_id < player_b_id)
);

CREATE INDEX IF NOT EXISTS h2h_player_a_idx ON head_to_head (player_a_id, player_b_id);
CREATE INDEX IF NOT EXISTS h2h_player_b_idx ON head_to_head (player_b_id, player_a_id);
CREATE INDEX IF NOT EXISTS h2h_tournament_idx ON head_to_head (tournament_id);

ALTER TABLE head_to_head ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read h2h"       ON head_to_head FOR SELECT USING (true);
CREATE POLICY "Service role manages h2h"  ON head_to_head FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- NEW-003: tournament_stages table (multi-stage / Swiss)
-- ============================================================

CREATE TABLE IF NOT EXISTS tournament_stages (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id     BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage_number      INT NOT NULL,
  stage_name        TEXT NOT NULL DEFAULT 'Stage 1',
  format            TEXT NOT NULL DEFAULT 'single_stage'
                      CHECK (format IN ('single_stage','two_stage','swiss')),
  games_per_lobby   INT NOT NULL DEFAULT 3,
  advancement_count INT,
  points_reset      BOOLEAN NOT NULL DEFAULT false,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','active','completed')),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, stage_number)
);

CREATE INDEX IF NOT EXISTS tournament_stages_tournament_idx ON tournament_stages (tournament_id);
CREATE INDEX IF NOT EXISTS tournament_stages_status_idx    ON tournament_stages (status);

ALTER TABLE tournament_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read stages"       ON tournament_stages FOR SELECT USING (true);
CREATE POLICY "Service role manages stages"  ON tournament_stages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Hosts can insert stages"
  ON tournament_stages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id
        AND t.host_user_id = (SELECT auth.uid())
    )
  );

-- ============================================================
-- NEW-004: bye_assignments table
-- ============================================================

CREATE TABLE IF NOT EXISTS bye_assignments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage_number  INT NOT NULL DEFAULT 1,
  game_number   INT NOT NULL DEFAULT 1,
  player_id     BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  bye_reason    TEXT DEFAULT 'uneven_field',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, stage_number, game_number, player_id)
);

CREATE INDEX IF NOT EXISTS bye_tournament_idx ON bye_assignments (tournament_id);
CREATE INDEX IF NOT EXISTS bye_player_idx     ON bye_assignments (player_id);

ALTER TABLE bye_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read byes"       ON bye_assignments FOR SELECT USING (true);
CREATE POLICY "Service role manages byes"  ON bye_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- NEW-005: Improved player_stats_v with DNP count
-- ============================================================

CREATE OR REPLACE VIEW player_stats_v AS
SELECT
  player_id,
  COUNT(*) FILTER (WHERE NOT is_dnp)                                              AS games,
  COUNT(*) FILTER (WHERE is_dnp)                                                  AS dnp_count,
  COALESCE(SUM(points), 0)                                                        AS total_pts,
  SUM(CASE WHEN placement = 1 AND NOT is_dnp THEN 1 ELSE 0 END)                  AS wins,
  SUM(CASE WHEN placement <= 4 AND NOT is_dnp THEN 1 ELSE 0 END)                 AS top4,
  ROUND(AVG(placement) FILTER (WHERE NOT is_dnp)::numeric, 1)                    AS avg_placement
FROM game_results
GROUP BY player_id;
