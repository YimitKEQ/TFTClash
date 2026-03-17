-- Link tournaments to host profiles and add richer fields
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS host_profile_id bigint references host_profiles(id) on delete set null;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_featured boolean default false;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS region text default 'EUW';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_rounds int default 3;

CREATE INDEX IF NOT EXISTS tournaments_host_profile_idx ON tournaments (host_profile_id);
CREATE INDEX IF NOT EXISTS tournaments_featured_idx ON tournaments (is_featured) WHERE is_featured = true;
