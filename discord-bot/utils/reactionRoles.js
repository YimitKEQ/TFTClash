/**
 * reactionRoles.js — manage the #notifications reaction-role panel.
 *
 * Persists the panel message id to site_settings.notify_panel_message_id
 * so the bot can re-hydrate the message cache on restart (Discord won't
 * dispatch reaction events for un-fetched older messages).
 *
 * Public surface:
 *   buildPanelEmbed(kinds)
 *   postPanel(channel, kinds)              -> { messageId, message }
 *   loadPanelMessageId()                   -> string | null
 *   savePanelMessageId(id)
 *   hydratePanel(client)                   -> { ok, message } (run on ClientReady)
 *   reactionToKind(emojiName)              -> 'clash' | 'tournament' | 'live' | null
 */

import { supabase } from './supabase.js';
import { brandEmbed, STATUS_COLOR } from './embedKit.js';
import { NOTIFY_KINDS } from './notifyRoles.js';

var SETTING_KEY = 'notify_panel_message_id';
var PANEL_CHANNEL_ID_KEY = 'notify_panel_channel_id';

export function buildPanelEmbed() {
  var lines = [];
  lines.push('React below to opt in to the notifications you want. Remove your reaction to opt out.');
  lines.push('');
  Object.keys(NOTIFY_KINDS).forEach(function(k) {
    var d = NOTIFY_KINDS[k];
    lines.push(d.emoji + '  **' + d.label + '** — ' + d.desc);
  });
  lines.push('');
  lines.push('No spam, no @everyone. You decide what pings you.');
  return brandEmbed({
    title: 'TFT Clash Notifications',
    body: lines.join('\n'),
    color: STATUS_COLOR.notice,
    footerNote: 'opt-in roles · powered by reactions',
  });
}

export async function postPanel(channel) {
  if (!channel) throw new Error('postPanel: channel required');
  var msg = await channel.send({ embeds: [buildPanelEmbed()] });
  // Add reactions in NOTIFY_KINDS order
  var keys = Object.keys(NOTIFY_KINDS);
  for (var i = 0; i < keys.length; i++) {
    try {
      await msg.react(NOTIFY_KINDS[keys[i]].emoji);
    } catch (e) {
      console.warn('[reactionRoles] react ' + keys[i] + ' failed: ' + ((e && e.message) || e));
    }
  }
  await savePanelMessageId(msg.id, channel.id);
  return { messageId: msg.id, message: msg };
}

export async function savePanelMessageId(messageId, channelId) {
  try {
    await supabase
      .from('site_settings')
      .upsert([{ key: SETTING_KEY, value: messageId }], { onConflict: 'key' });
    if (channelId) {
      await supabase
        .from('site_settings')
        .upsert([{ key: PANEL_CHANNEL_ID_KEY, value: channelId }], { onConflict: 'key' });
    }
    return true;
  } catch (e) {
    console.error('[reactionRoles] savePanelMessageId failed: ' + ((e && e.message) || e));
    return false;
  }
}

export async function clearPanelMessageId() {
  try {
    await supabase
      .from('site_settings')
      .upsert([{ key: SETTING_KEY, value: null }], { onConflict: 'key' });
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadPanelMessageId() {
  var res = await supabase.from('site_settings').select('value').eq('key', SETTING_KEY).limit(1);
  if (res.error || !res.data || !res.data.length) return null;
  var v = res.data[0].value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && v.id) return String(v.id);
  return null;
}

export async function loadPanelChannelId() {
  var res = await supabase.from('site_settings').select('value').eq('key', PANEL_CHANNEL_ID_KEY).limit(1);
  if (res.error || !res.data || !res.data.length) return null;
  var v = res.data[0].value;
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && v.id) return String(v.id);
  return null;
}

/**
 * On ClientReady, fetch the persisted panel message into cache so reaction
 * events fire. If the message was deleted, clear the setting and log it.
 */
export async function hydratePanel(client) {
  var messageId = await loadPanelMessageId();
  if (!messageId) return { ok: false, reason: 'no panel set' };
  var channelId = await loadPanelChannelId();
  var guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return { ok: false, reason: 'no guild' };

  var channel = null;
  if (channelId) channel = guild.channels.cache.get(channelId) || null;
  if (!channel) {
    channel = guild.channels.cache.find(function(c) { return c.type === 0 && c.name.includes('notifications'); }) || null;
  }
  if (!channel) {
    console.warn('[reactionRoles] panel channel not found, clearing setting');
    await clearPanelMessageId();
    return { ok: false, reason: 'channel missing' };
  }
  try {
    var msg = await channel.messages.fetch(messageId);
    console.log('[reactionRoles] hydrated panel ' + messageId + ' in #' + channel.name);
    return { ok: true, message: msg, channel: channel };
  } catch (e) {
    console.warn('[reactionRoles] panel message ' + messageId + ' missing — clearing setting (post via /setupnotify to repost)');
    await clearPanelMessageId();
    return { ok: false, reason: 'message 404' };
  }
}

/**
 * Map a reaction emoji name (or unicode) to a notify kind.
 */
export function reactionToKind(emojiName) {
  if (!emojiName) return null;
  var keys = Object.keys(NOTIFY_KINDS);
  for (var i = 0; i < keys.length; i++) {
    if (NOTIFY_KINDS[keys[i]].emoji === emojiName) return keys[i];
  }
  return null;
}
