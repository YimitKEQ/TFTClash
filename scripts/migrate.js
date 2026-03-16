// Run with: node scripts/migrate.js
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or discord-bot/.env
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env vars from root .env and discord-bot/.env
function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8').split('\n')
        .filter(l => l && !l.startsWith('#'))
        .map(l => l.split('=').map((v, i) => i === 0 ? v.trim() : v.trim()))
    );
  } catch { return {}; }
}

const env = { ...loadEnv(path.join(__dirname, '../.env')), ...loadEnv(path.join(__dirname, '../discord-bot/.env')) };
const URL  = env.VITE_SUPABASE_URL  || env.SUPABASE_URL;
const KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY || KEY === 'your-service-role-key') {
  console.error('❌  Fill in SUPABASE_SERVICE_ROLE_KEY in discord-bot/.env first'); process.exit(1);
}

const sb = createClient(URL, KEY);

// ── SQL ─────────────────────────────────────────────────────────────────────
const SQL = `
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  riot_id text, region text, rank text, lp int default 0,
  season_pts int default 0, wins int default 0, games int default 0,
  top4 int default 0, avg_placement numeric(4,2),
  discord_user_id text unique,
  created_at timestamptz default now()
);

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null, date date, season text,
  format text, phase text default 'registration',
  player_cap int default 8, prize_pool int default 0,
  created_at timestamptz default now()
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  status text default 'registered', checked_in_at timestamptz,
  created_at timestamptz default now(),
  unique(tournament_id, player_id)
);

create table if not exists lobbies (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  round_num int not null, game_num int not null,
  host_player_id uuid references players(id), lobby_code text,
  created_at timestamptz default now()
);

create table if not exists lobby_players (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid references lobbies(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  placement int, points_earned int,
  created_at timestamptz default now()
);

create table if not exists tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  final_placement int, total_points int default 0,
  wins int default 0, top4_count int default 0,
  created_at timestamptz default now()
);

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  achievement_code text not null, tier text,
  unlocked_at timestamptz default now(),
  unique(player_id, achievement_code)
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  plan text not null,
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists site_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

create index if not exists players_discord_user_id_idx on players (discord_user_id)
  where discord_user_id is not null;

alter table players enable row level security;
alter table tournaments enable row level security;
alter table registrations enable row level security;
alter table lobbies enable row level security;
alter table lobby_players enable row level security;
alter table tournament_results enable row level security;
alter table achievements enable row level security;
alter table subscriptions enable row level security;
alter table site_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='players' and policyname='read all') then
    create policy "read all" on players for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tournaments' and policyname='read all') then
    create policy "read all" on tournaments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='registrations' and policyname='read all') then
    create policy "read all" on registrations for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='lobbies' and policyname='read all') then
    create policy "read all" on lobbies for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='lobby_players' and policyname='read all') then
    create policy "read all" on lobby_players for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='tournament_results' and policyname='read all') then
    create policy "read all" on tournament_results for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='achievements' and policyname='read all') then
    create policy "read all" on achievements for select using (true);
  end if;
end $$;
`;

// Seed players from App.jsx SEED constant
const SEED = [
  { username:'Levitate',    riot_id:'Levitate#EUW',    region:'EUW', rank:'Challenger',  lp:1024, season_pts:1024, wins:16, games:22, top4:22 },
  { username:'Zounderkite', riot_id:'Zounderkite#EUW', region:'EUW', rank:'Grandmaster', lp:847,  season_pts:847,  wins:11, games:19, top4:19 },
  { username:'Uri',         riot_id:'Uri#EUW',         region:'EUW', rank:'Grandmaster', lp:791,  season_pts:791,  wins:9,  games:17, top4:17 },
  { username:'BingBing',    riot_id:'BingBing#EUW',    region:'EUW', rank:'Master',      lp:734,  season_pts:734,  wins:8,  games:15, top4:15 },
  { username:'Wiwi',        riot_id:'Wiwi#EUW',        region:'EUW', rank:'Master',      lp:698,  season_pts:698,  wins:7,  games:14, top4:14 },
  { username:'Ole',         riot_id:'Ole#EUW',         region:'EUW', rank:'Diamond',     lp:621,  season_pts:621,  wins:6,  games:12, top4:12 },
  { username:'Sybor',       riot_id:'Sybor#EUW',       region:'EUW', rank:'Diamond',     lp:574,  season_pts:574,  wins:5,  games:11, top4:11 },
  { username:'Ivdim',       riot_id:'Ivdim#EUW',       region:'EUW', rank:'Diamond',     lp:512,  season_pts:512,  wins:4,  games:10, top4:10 },
  { username:'Vlad',        riot_id:'Vlad#EUW',        region:'EUW', rank:'Platinum',    lp:443,  season_pts:443,  wins:3,  games:8,  top4:8  },
];

async function run() {
  console.log('🔗  Connecting to', URL);

  // Run schema via Management API
  const res = await fetch(`${URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'apikey': KEY },
    body: JSON.stringify({ sql: SQL }),
  });

  if (!res.ok) {
    // Fallback: try to at least seed data (tables may already exist)
    console.log('⚠️  Could not run DDL via REST (expected — run SQL manually in Supabase dashboard)');
    console.log('    Attempting to seed player data...');
  } else {
    console.log('✅  Schema created');
  }

  // Seed players (upsert — safe to run multiple times)
  const { error } = await sb.from('players').upsert(SEED, { onConflict: 'username' });
  if (error) {
    console.error('❌  Seed failed:', error.message);
    console.log('    (If tables do not exist yet, run the SQL schema in the Supabase dashboard first)');
  } else {
    console.log('✅  Players seeded:', SEED.map(p => p.username).join(', '));
  }

  console.log('\nDone. Next: add ADMIN_PASSWORD to Vercel env vars and push to deploy.');
}

run().catch(console.error);
