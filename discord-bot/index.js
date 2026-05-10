/**
 * index.js — TFT Clash Discord Bot
 * Start: node index.js
 */

import { Client, GatewayIntentBits, Collection, Events, ActivityType, Partials } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import 'dotenv/config';

import { startScheduler } from './scheduler.js';
import { startListeners } from './listeners.js';
import { startDashboard } from './dashboard/server.js';
import { syncAllRoles } from './utils/roles.js';
import { welcomeEmbed, welcomeDMEmbed } from './utils/embeds.js';
import { ensureNotifyRoles, addNotifyRole, removeNotifyRole } from './utils/notifyRoles.js';
import { hydratePanel, reactionToKind } from './utils/reactionRoles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ─── Load slash commands ──────────────────────────────────────────────────────
client.commands = new Collection();
const commandFiles = readdirSync(path.join(__dirname, 'commands')).filter(function(f) { return f.endsWith('.js'); });
for (const file of commandFiles) {
  const url = pathToFileURL(path.join(__dirname, 'commands', file)).href;
  const cmd = await import(url);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log('[cmd] ' + cmd.data.name);
  }
}

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, function(c) {
  console.log('\n⚡ TFT Clash Bot online as ' + c.user.tag);

  c.user.setPresence({
    activities: [{ name: 'TFT Clash - /clash', type: ActivityType.Playing }],
    status: 'online',
  });

  startScheduler(client);
  startListeners(client);
  startDashboard(client);

  // Sync all Discord roles on startup
  var guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (guild) {
    syncAllRoles(guild).then(function(results) {
      var changed = results.filter(function(r) { return r.added && (r.added.length || r.removed.length); });
      console.log('[roles] Startup sync complete: ' + results.length + ' players checked, ' + changed.length + ' updated');
    }).catch(function(e) { console.error('[roles] Startup sync failed:', e.message); });

    // Bootstrap notify + Pre-Game roles, then hydrate the reaction-role panel.
    ensureNotifyRoles(guild).then(function(res) {
      if (!res.ok) {
        console.warn('[notifyRoles] startup not OK — hierarchy=' + res.hierarchyOk + ' manage=' + res.manageOk + '. Reactions will still register but role grants may fail until fixed.');
      } else {
        console.log('[notifyRoles] all 4 managed roles present, hierarchy OK');
      }
      // Hydrate panel cache so reaction events fire after restart.
      hydratePanel(client).then(function(h) {
        if (h.ok) console.log('[reactionRoles] panel ready');
        else console.log('[reactionRoles] no panel hydrated (' + (h.reason || 'unknown') + ') — run /setupnotify');
      }).catch(function(e) { console.warn('[reactionRoles] hydrate failed: ' + ((e && e.message) || e)); });
    }).catch(function(e) { console.error('[notifyRoles] bootstrap failed: ' + ((e && e.message) || e)); });
  }
});

// ─── Reaction roles ──────────────────────────────────────────────────────────
async function handleReaction(reaction, user, action) {
  if (!reaction || !user || user.bot) return;
  try {
    if (reaction.partial) {
      try { await reaction.fetch(); } catch (e) { return; }
    }
    if (reaction.message && reaction.message.partial) {
      try { await reaction.message.fetch(); } catch (e) { return; }
    }
    var msg = reaction.message;
    var guild = msg.guild;
    if (!guild) return;
    // Only respond to reactions on the persisted notify panel
    var loadPanelId = (await import('./utils/reactionRoles.js')).loadPanelMessageId;
    var panelId = await loadPanelId();
    if (!panelId || msg.id !== panelId) return;

    var emojiName = (reaction.emoji && (reaction.emoji.name || reaction.emoji.toString())) || '';
    var kind = reactionToKind(emojiName);
    if (!kind) return;
    var member = await guild.members.fetch(user.id).catch(function() { return null; });
    if (!member) return;
    if (action === 'add') {
      await addNotifyRole(member, kind);
    } else {
      await removeNotifyRole(member, kind);
    }
  } catch (e) {
    console.warn('[reactionRoles] handler ' + action + ' failed: ' + ((e && e.message) || e));
  }
}

client.on(Events.MessageReactionAdd, function(reaction, user) { handleReaction(reaction, user, 'add'); });
client.on(Events.MessageReactionRemove, function(reaction, user) { handleReaction(reaction, user, 'remove'); });

// ─── Slash commands ───────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async function(interaction) {
  // Slash command
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error('[error] /' + interaction.commandName + ':', err);
      logError(interaction.guild, interaction.user.tag, interaction.commandName, err);
      const msg = { content: '❌ Something went wrong. Try again or contact a Host.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply(msg);
      }
    }
    return;
  }

  // Button: verify
  if (interaction.isButton() && interaction.customId === 'verify') {
    const guild      = interaction.guild;
    const member     = interaction.member;
    const playerRole = guild.roles.cache.find(function(r) { return r.name === 'Player'; });

    if (!playerRole) {
      return interaction.reply({ content: '⚠️ Player role not found - contact a Host.', ephemeral: true });
    }

    if (member.roles.cache.has(playerRole.id)) {
      return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
    }

    try {
      await member.roles.add(playerRole, 'Self-verified via #verify');

      await interaction.reply({
        content:
          '✅ **Verified!** You now have access to the full server.\n\n' +
          'Next step: link your TFT Clash account with `/link account <username>`',
        ephemeral: true,
      });

      // Post welcome in #newcomers (fallback to #general for older servers)
      const welcomeCh =
        guild.channels.cache.find(function(c) { return c.type === 0 && c.name.includes('newcomers'); }) ||
        guild.channels.cache.find(function(c) { return c.type === 0 && c.name.includes('general'); });
      if (welcomeCh) {
        await welcomeCh.send({ embeds: [welcomeEmbed(member)] });
      }

      console.log('[verify] ' + member.user.tag + ' verified');
    } catch (err) {
      console.error('[verify error]', err);
      await interaction.reply({ content: '❌ Could not assign role - check bot permissions.', ephemeral: true });
    }
  }
});

// ─── New member join ──────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async function(member) {
  console.log('[join] ' + member.user.tag);

  // DM welcome
  try {
    await member.send({ embeds: [welcomeDMEmbed(member)] });
  } catch (e) {
    // DMs closed, silently skip
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function logError(guild, userTag, command, err) {
  if (!guild) return;
  const logCh = guild.channels.cache.find(function(c) { return c.name.includes('bot-logs'); });
  if (logCh) {
    logCh.send('**Error** `/' + command + '` by ' + userTag + '\n```' + err.message + '```').catch(function() {});
  }
}

client.login(process.env.DISCORD_TOKEN);
