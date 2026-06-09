/**
 * adminAlerts.js — private #admin-alerts channel for ops alerts.
 *
 * - ensureAdminAlerts(client): find-or-create a Host-only text channel
 *   (same gating as bot-logs) + a webhook named "TFT Sentry" inside it.
 *   The webhook URL is what Sentry (via /api/discord-notify?source=sentry)
 *   posts to. The URL is printed to the bot log once so it can be copied
 *   into Vercel env (DISCORD_ALERT_WEBHOOK_URL).
 * - postAdminAlert(client, title, body): push an alert embed to the channel.
 * - attachProcessAlertHandlers(client): unhandledRejection / uncaughtException
 *   get reported to the channel so the bot never dies silently mid-clash.
 */

import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

var CHANNEL_NAME = '🚨・admin-alerts';
var CHANNEL_MATCH = 'admin-alerts';
var WEBHOOK_NAME = 'TFT Sentry';
var RED = 0xC0392B;

var cachedChannelId = null;

function findGuild(client) {
  return client.guilds.cache.get(process.env.GUILD_ID) || null;
}

function findAlertsChannel(guild) {
  return guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && c.name.indexOf(CHANNEL_MATCH) !== -1;
  }) || null;
}

export async function ensureAdminAlerts(client) {
  var guild = findGuild(client);
  if (!guild) return { ok: false, reason: 'no-guild' };

  var channel = findAlertsChannel(guild);
  if (!channel) {
    // Mirror the bot-logs gate: everyone+Player denied, Host allowed.
    var hostRole = guild.roles.cache.find(function(r) { return r.name === 'Host'; });
    var playerRole = guild.roles.cache.find(function(r) { return r.name === 'Player'; });
    var ows = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
    if (playerRole) ows.push({ id: playerRole.id, deny: [PermissionFlagsBits.ViewChannel] });
    if (hostRole) ows.push({
      id: hostRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
      ],
    });

    // Sit next to bot-logs if it exists, otherwise top-level.
    var botLogs = guild.channels.cache.find(function(c) { return c.name.indexOf('bot-logs') !== -1; });
    var createOpts = {
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: 'Production alerts: Sentry errors, bot crashes, tournament-day warnings. Host-only.',
      permissionOverwrites: ows,
    };
    if (botLogs && botLogs.parentId) createOpts.parent = botLogs.parentId;

    try {
      channel = await guild.channels.create(createOpts);
      console.log('[adminAlerts] Created ' + CHANNEL_NAME);
    } catch (e) {
      console.error('[adminAlerts] channel create failed: ' + ((e && e.message) || e));
      return { ok: false, reason: 'create-failed' };
    }
  }
  cachedChannelId = channel.id;

  // Ensure the Sentry webhook exists and surface its URL for Vercel env.
  var webhookUrl = null;
  try {
    var hooks = await channel.fetchWebhooks();
    var hook = hooks.find(function(h) { return h.name === WEBHOOK_NAME; });
    if (!hook) {
      hook = await channel.createWebhook({ name: WEBHOOK_NAME, reason: 'Sentry alert relay' });
      console.log('[adminAlerts] Created webhook "' + WEBHOOK_NAME + '"');
    }
    webhookUrl = hook.url;
    console.log('[adminAlerts] Sentry relay webhook ready. Set this in Vercel as DISCORD_ALERT_WEBHOOK_URL:');
    console.log('[adminAlerts] ' + webhookUrl);
  } catch (e) {
    console.warn('[adminAlerts] webhook setup failed (need Manage Webhooks perm): ' + ((e && e.message) || e));
  }

  return { ok: true, channelId: channel.id, webhookUrl: webhookUrl };
}

export async function postAdminAlert(client, title, body) {
  try {
    var guild = findGuild(client);
    if (!guild) return false;
    var channel = (cachedChannelId && guild.channels.cache.get(cachedChannelId)) || findAlertsChannel(guild);
    if (!channel) return false;
    var embed = new EmbedBuilder()
      .setColor(RED)
      .setTitle(String(title || 'Alert').slice(0, 250))
      .setDescription(String(body || '').slice(0, 3500))
      .setTimestamp(new Date());
    await channel.send({ embeds: [embed] });
    return true;
  } catch (e) {
    console.error('[adminAlerts] post failed: ' + ((e && e.message) || e));
    return false;
  }
}

export function attachProcessAlertHandlers(client) {
  process.on('unhandledRejection', function(reason) {
    var msg = reason && reason.stack ? reason.stack : String(reason);
    console.error('[process] unhandledRejection: ' + msg);
    postAdminAlert(client, 'Bot: unhandled promise rejection', '```' + msg.slice(0, 3000) + '```').catch(function() {});
  });
  process.on('uncaughtException', function(err) {
    var msg = err && err.stack ? err.stack : String(err);
    console.error('[process] uncaughtException: ' + msg);
    // Try to get the alert out, then exit so the supervisor restarts clean.
    postAdminAlert(client, 'Bot: CRASHED (uncaught exception) - restarting', '```' + msg.slice(0, 3000) + '```')
      .catch(function() {})
      .then(function() { setTimeout(function() { process.exit(1); }, 1500); });
    setTimeout(function() { process.exit(1); }, 5000);
  });
  console.log('[adminAlerts] process-level crash reporting attached');
}
