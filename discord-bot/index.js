/**
 * index.js — TFT Clash Discord Bot
 * Start: node index.js
 */

import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import 'dotenv/config';

import { startScheduler } from './scheduler.js';
import { startListeners } from './listeners.js';
import { startDashboard } from './dashboard/server.js';
import { syncAllRoles } from './utils/roles.js';
import { welcomeEmbed, welcomeDMEmbed } from './utils/embeds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
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
  }
});

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
