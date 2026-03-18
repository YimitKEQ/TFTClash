-- FIX-007: Normalize rank values and add CHECK constraint
UPDATE players SET rank = initcap(lower(rank)) WHERE rank IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_rank_check'
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT players_rank_check
        CHECK (rank IS NULL OR rank IN (
          'Iron','Bronze','Silver','Gold','Platinum',
          'Emerald','Diamond','Master','Grandmaster','Challenger'
        ));
  END IF;
END $$;
