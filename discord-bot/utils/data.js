// ─── Data helpers — live from Supabase ───────────────────────────────────────
import { supabase } from './supabase.js';

export const PTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

export const RANK_COLORS = {
  Challenger:   0xE8A838,
  Grandmaster:  0x9B72CF,
  Master:       0x9B72CF,
  Diamond:      0x4ECDC4,
  Platinum:     0x3FB68B,
  Gold:         0xE8A838,
  Iron:         0x888888,
};

/** Fetch season config from site_settings. */
export async function getSeasonConfig() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'season_config')
    .single();
  if (error || !data) return { number: 1, name: 'Season 1', totalClashes: 20, currentClash: 1, champion: '' };
  try { return JSON.parse(data.value); } catch { return { number: 1, name: 'Season 1', totalClashes: 20, currentClash: 1, champion: '' }; }
}

/** Fetch tournament_state from site_settings. */
export async function getTournamentState() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'tournament_state')
    .single();
  if (error || !data) return null;
  try { return JSON.parse(data.value); } catch { return null; }
}

/** Returns top-N players sorted by season points from Supabase. */
export async function getStandings(limit = 10) {
  const { data, error } = await supabase
    .from('players')
    .select('username,rank,season_pts,wins,top4,games_played')
    .order('season_pts', { ascending: false })
    .limit(limit);
  if (error || !data || !data.length) return [];
  return data.map(r => ({
    name: r.username,
    rank: r.rank || 'Iron',
    pts: r.season_pts || 0,
    wins: r.wins || 0,
    top4: r.top4 || 0,
    games: r.games_played || 0,
  }));
}

/** Looks up a single player by username (case-insensitive). */
export async function getPlayer(name) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .ilike('username', name)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.username,
    rank: data.rank || 'Iron',
    pts: data.season_pts || 0,
    wins: data.wins || 0,
    top4: data.top4 || 0,
    games: data.games_played || 0,
    riotId: data.riot_id_eu || data.riot_id || '',
    riotIdEu: data.riot_id_eu || '',
    riotIdNa: data.riot_id_na || '',
    region: data.region || 'EUW',
    bio: data.bio || '',
    auth_user_id: data.auth_user_id,
    discord_user_id: data.discord_user_id,
  };
}

/** Looks up a player by their linked Discord user ID. */
export async function getPlayerByDiscordId(discordUserId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.username,
    rank: data.rank || 'Iron',
    pts: data.season_pts || 0,
    wins: data.wins || 0,
    top4: data.top4 || 0,
    games: data.games_played || 0,
    riotId: data.riot_id_eu || data.riot_id || '',
    riotIdEu: data.riot_id_eu || '',
    riotIdNa: data.riot_id_na || '',
    region: data.region || 'EUW',
    auth_user_id: data.auth_user_id,
  };
}

/** Resolve the tournament_id (uuid) for a given clash number by looking it up in the tournaments table. */
export async function getTournamentIdByClashNumber(clashNumber) {
  if (!clashNumber) return null;
  const { data } = await supabase
    .from('tournaments')
    .select('id')
    .eq('type', 'season_clash')
    .ilike('name', 'Clash Week ' + clashNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? data.id : null;
}

/** Get registrations for the current clash. */
export async function getRegistrations() {
  const ts = await getTournamentState();
  if (!ts) return [];
  const tournamentId = ts.dbTournamentId || (await getTournamentIdByClashNumber(ts.clashNumber));
  if (!tournamentId) return [];
  const { data, error } = await supabase
    .from('registrations')
    .select('player_id,status,players(username,rank,riot_id_eu,riot_id)')
    .eq('tournament_id', tournamentId);
  if (error || !data) return [];
  return data.map(r => ({
    playerId: r.player_id,
    status: r.status,
    name: r.players ? r.players.username : 'Unknown',
    rank: r.players ? r.players.rank : 'Iron',
    riotId: r.players ? (r.players.riot_id_eu || r.players.riot_id || '') : '',
  }));
}

/** Get latest game_results for a given clash number. */
export async function getClashResults(clashNumber) {
  const tournamentId = await getTournamentIdByClashNumber(clashNumber);
  if (!tournamentId) return [];
  const { data, error } = await supabase
    .from('game_results')
    .select('player_id,placement,game_number,players(username)')
    .eq('tournament_id', tournamentId)
    .order('placement', { ascending: true });
  if (error || !data) return [];
  return data.map(r => ({
    playerId: r.player_id,
    name: r.players ? r.players.username : 'Unknown',
    place: r.placement,
    gameNumber: r.game_number,
  }));
}

/** Count total registered players. */
export async function getPlayerCount() {
  const { count, error } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}
