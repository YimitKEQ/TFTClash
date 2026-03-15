// ─── Data helpers — live from Supabase, SEED fallback ─────────────────────────
import { supabase } from './supabase.js';

// Local fallback used when Supabase is not configured or query fails
const SEED_PLAYERS = [
  { id: 1,  name: 'Levitate',    rank: 'Challenger', pts: 1024, wins: 16, top4: 22 },
  { id: 2,  name: 'Zounderkite', rank: 'Grandmaster', pts: 847, wins: 11, top4: 19 },
  { id: 3,  name: 'Uri',         rank: 'Grandmaster', pts: 791, wins: 9,  top4: 17 },
  { id: 4,  name: 'BingBing',    rank: 'Master',      pts: 734, wins: 8,  top4: 15 },
  { id: 5,  name: 'Wiwi',        rank: 'Master',      pts: 698, wins: 7,  top4: 14 },
  { id: 6,  name: 'Ole',         rank: 'Diamond',     pts: 621, wins: 6,  top4: 12 },
  { id: 7,  name: 'Sybor',       rank: 'Diamond',     pts: 574, wins: 5,  top4: 11 },
  { id: 8,  name: 'Ivdim',       rank: 'Diamond',     pts: 512, wins: 4,  top4: 10 },
  { id: 9,  name: 'Vlad',        rank: 'Platinum',    pts: 443, wins: 3,  top4: 8  },
];

export const SEASON = {
  number: 1,
  name: 'Season 1',
  champion: 'Levitate',
  totalClashes: 20,
  currentClash: 15,
};

export const NEXT_CLASH = {
  number: 16,
  date: 'Saturday, March 22 2026',
  time: '8:00 PM GMT',
  format: 'Single Lobby — 8 Players',
  registrationUrl: 'https://tft-clash.vercel.app',
};

export const PTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

export const RANK_COLORS = {
  Challenger:   0xE8A838,
  Grandmaster:  0x9B72CF,
  Master:       0x9B72CF,
  Diamond:      0x4ECDC4,
  Platinum:     0x3FB68B,
  Gold:         0xE8A838,
};

/** Returns top-10 players sorted by season points from Supabase. */
export async function getStandings() {
  const { data, error } = await supabase
    .from('players')
    .select('username,rank,season_pts,wins,top4')
    .order('season_pts', { ascending: false })
    .limit(10);
  if (error || !data?.length) return [...SEED_PLAYERS].sort((a, b) => b.pts - a.pts);
  return data.map(r => ({ name: r.username, rank: r.rank, pts: r.season_pts, wins: r.wins, top4: r.top4 }));
}

/** Looks up a single player by username (case-insensitive). */
export async function getPlayer(name) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .ilike('username', name)
    .single();
  if (error || !data) return SEED_PLAYERS.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null;
  return { name: data.username, rank: data.rank, pts: data.season_pts, wins: data.wins, top4: data.top4, riotId: data.riot_id, region: data.region };
}

/** Looks up a player by their linked Discord user ID. */
export async function getPlayerByDiscordId(discordUserId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .single();
  if (error || !data) return null;
  return { name: data.username, rank: data.rank, pts: data.season_pts, wins: data.wins, top4: data.top4, riotId: data.riot_id, region: data.region };
}
