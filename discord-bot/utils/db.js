// Discord ↔ platform account links — stored in Supabase `players.discord_user_id`
// Requires: ALTER TABLE players ADD COLUMN IF NOT EXISTS discord_user_id text unique;
import { supabase } from './supabase.js';

/**
 * Links a Discord user to a TFT Clash player row.
 * Sets `discord_user_id` on the players table row matching platformName.
 */
export async function linkAccount(discordId, _discordTag, platformName) {
  const { error } = await supabase
    .from('players')
    .update({ discord_user_id: discordId })
    .ilike('username', platformName)
    .limit(1);
  if (error) throw new Error(error.message);
}

/**
 * Returns the player row linked to discordId, or null.
 */
export async function getLink(discordId) {
  const { data, error } = await supabase
    .from('players')
    .select('username,rank,season_pts')
    .eq('discord_user_id', discordId)
    .single();
  if (error || !data) return null;
  return { platform_name: data.username, linked_at: Date.now() };
}

/**
 * Removes Discord link from the player row.
 */
export async function unlinkAccount(discordId) {
  await supabase
    .from('players')
    .update({ discord_user_id: null })
    .eq('discord_user_id', discordId);
}
