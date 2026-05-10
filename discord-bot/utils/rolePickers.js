/**
 * rolePickers.js — generalized reaction-role panels.
 *
 * Replaces the single hardcoded notify panel for arbitrary roles. Each panel:
 *   - Lives in `discord_role_pickers` (slug PK, channel_id, message_id, options[])
 *   - Has N options: { emoji, role_name, label, desc }
 *   - When users react / un-react, the role is added / removed
 *
 * The legacy `notifications` reaction panel (clash/tournament/live notify
 * roles) keeps working independently via reactionRoles.js. This module is
 * additive — host can build any number of extra panels.
 */

import { supabase } from './supabase.js';
import { brandEmbed, STATUS_COLOR } from './embedKit.js';

function findRoleByName(guild, name) {
  if (!guild || !name) return null;
  return guild.roles.cache.find(function(r) { return r.name === name; }) || null;
}

export function buildPanelEmbed(picker) {
  var lines = [];
  if (picker.intro) {
    lines.push(picker.intro);
    lines.push('');
  } else {
    lines.push('React below to opt in. Remove your reaction to opt out.');
    lines.push('');
  }
  (picker.options || []).forEach(function(opt) {
    var label = opt.label || opt.role_name;
    var desc = opt.desc ? (' — ' + opt.desc) : '';
    lines.push((opt.emoji || '•') + '  **' + label + '**' + desc);
  });
  if (!picker.options || picker.options.length === 0) {
    lines.push('_(no options yet — host: use /rolepicker add)_');
  }
  return brandEmbed({
    title: picker.title || 'Role picker',
    body: lines.join('\n'),
    color: STATUS_COLOR.notice,
    footerNote: 'reaction roles · curated by hosts',
  });
}

export async function listPickers(guildId) {
  var res = await supabase
    .from('discord_role_pickers')
    .select('slug, channel_id, message_id, title, intro, options, updated_at')
    .eq('guild_id', guildId)
    .order('slug', { ascending: true });
  if (res.error) throw new Error(res.error.message);
  return res.data || [];
}

export async function getPicker(guildId, slug) {
  var res = await supabase
    .from('discord_role_pickers')
    .select('*')
    .eq('guild_id', guildId)
    .eq('slug', slug)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data || null;
}

export async function getPickerByMessageId(messageId) {
  if (!messageId) return null;
  var res = await supabase
    .from('discord_role_pickers')
    .select('*')
    .eq('message_id', messageId)
    .maybeSingle();
  if (res.error) return null;
  return res.data || null;
}

export async function createPicker(guildId, slug, title, intro) {
  var res = await supabase
    .from('discord_role_pickers')
    .upsert([{ guild_id: guildId, slug: slug, title: title, intro: intro || null, options: [] }], { onConflict: 'slug' })
    .select()
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function deletePicker(guildId, slug) {
  var res = await supabase
    .from('discord_role_pickers')
    .delete()
    .eq('guild_id', guildId)
    .eq('slug', slug);
  if (res.error) throw new Error(res.error.message);
  return true;
}

export async function addPickerOption(guildId, slug, option) {
  var p = await getPicker(guildId, slug);
  if (!p) throw new Error('picker "' + slug + '" not found');
  var existing = (p.options || []).filter(function(o) {
    return o.role_name !== option.role_name && o.emoji !== option.emoji;
  });
  existing.push({
    emoji: option.emoji,
    role_name: option.role_name,
    label: option.label || option.role_name,
    desc: option.desc || null,
  });
  var res = await supabase
    .from('discord_role_pickers')
    .update({ options: existing })
    .eq('guild_id', guildId)
    .eq('slug', slug)
    .select()
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function removePickerOption(guildId, slug, roleName) {
  var p = await getPicker(guildId, slug);
  if (!p) throw new Error('picker "' + slug + '" not found');
  var filtered = (p.options || []).filter(function(o) { return o.role_name !== roleName; });
  var res = await supabase
    .from('discord_role_pickers')
    .update({ options: filtered })
    .eq('guild_id', guildId)
    .eq('slug', slug)
    .select()
    .single();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/**
 * Post the panel into a channel. Stores message_id + channel_id so the bot
 * can hydrate on restart and so reactions get routed correctly. If the
 * picker already had a posted message in a different channel, the old one
 * is deleted (best-effort).
 */
export async function postPicker(guild, slug, channel) {
  var p = await getPicker(guild.id, slug);
  if (!p) throw new Error('picker "' + slug + '" not found');

  // Best-effort: delete previous panel message if it exists in a different channel
  if (p.message_id && p.channel_id && p.channel_id !== channel.id) {
    try {
      var oldChannel = guild.channels.cache.get(p.channel_id);
      if (oldChannel) {
        var oldMsg = await oldChannel.messages.fetch(p.message_id).catch(function() { return null; });
        if (oldMsg) await oldMsg.delete().catch(function() {});
      }
    } catch (e) { /* swallow */ }
  }

  var msg = await channel.send({ embeds: [buildPanelEmbed(p)] });
  for (var i = 0; i < (p.options || []).length; i++) {
    var emoji = p.options[i].emoji;
    if (!emoji) continue;
    try { await msg.react(emoji); }
    catch (e) { console.warn('[rolePickers] react ' + emoji + ' failed: ' + ((e && e.message) || e)); }
  }
  var res = await supabase
    .from('discord_role_pickers')
    .update({ channel_id: channel.id, message_id: msg.id })
    .eq('guild_id', guild.id)
    .eq('slug', slug);
  if (res.error) throw new Error(res.error.message);
  return { message: msg, slug: slug };
}

/**
 * On startup, re-fetch every panel message into cache so reaction events fire.
 * Returns { hydrated: n, missing: n }.
 */
export async function hydrateAllPickers(client) {
  var guildId = process.env.GUILD_ID;
  if (!guildId) return { hydrated: 0, missing: 0 };
  var guild = client.guilds.cache.get(guildId);
  if (!guild) return { hydrated: 0, missing: 0 };
  var pickers = await listPickers(guildId);
  var hydrated = 0;
  var missing = 0;
  for (var p of pickers) {
    if (!p.message_id || !p.channel_id) continue;
    var ch = guild.channels.cache.get(p.channel_id);
    if (!ch) { missing += 1; continue; }
    try {
      await ch.messages.fetch(p.message_id);
      hydrated += 1;
    } catch (e) {
      missing += 1;
      // Clear stale message_id so it doesn't keep failing
      await supabase
        .from('discord_role_pickers')
        .update({ message_id: null })
        .eq('slug', p.slug)
        .catch(function() {});
    }
  }
  console.log('[rolePickers] hydrated ' + hydrated + ' panel(s), ' + missing + ' missing');
  return { hydrated: hydrated, missing: missing };
}

/**
 * Reaction dispatcher. Returns true if the reaction was on a managed picker
 * (so the caller can stop further dispatch).
 */
export async function handlePickerReaction(reaction, user, action) {
  if (!reaction || !reaction.message || !reaction.message.id) return false;
  var picker = await getPickerByMessageId(reaction.message.id);
  if (!picker) return false;
  var emojiName = (reaction.emoji && (reaction.emoji.name || reaction.emoji.toString())) || '';
  var opt = (picker.options || []).find(function(o) { return o.emoji === emojiName; });
  if (!opt) return true; // matched panel but no option for this emoji — still consumed
  var guild = reaction.message.guild;
  if (!guild) return true;
  var role = findRoleByName(guild, opt.role_name);
  if (!role) {
    console.warn('[rolePickers] role "' + opt.role_name + '" not found for picker ' + picker.slug);
    return true;
  }
  var member = await guild.members.fetch(user.id).catch(function() { return null; });
  if (!member) return true;
  try {
    if (action === 'add') {
      if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'rolepicker:' + picker.slug);
    } else {
      if (member.roles.cache.has(role.id)) await member.roles.remove(role, 'rolepicker:' + picker.slug);
    }
  } catch (e) {
    console.warn('[rolePickers] role ' + action + ' failed: ' + ((e && e.message) || e));
  }
  return true;
}
