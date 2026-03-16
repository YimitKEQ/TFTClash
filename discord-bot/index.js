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
const commandFiles = readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const url = pathToFileURL(path.join(__dirname, 'commands', file)).href;
  const cmd = await import(url);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`[cmd] ${cmd.data.name}`);
  }
}

// ─── Ready ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, (c) => {
  console.log(`\n⚡ TFT Clash Bot online as ${c.user.tag}`);

  c.user.setPresence({
    activities: [{ name: 'TFT Clash · /clash', type: ActivityType.Playing }],
    status: 'online',
  });

  startScheduler(client);
});

// ─── Slash commands ───────────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  // Slash command
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(`[error] /${interaction.commandName}:`, err);
      logError(interaction.guild, interaction.user.tag, interaction.commandName, err);
      const msg = { content: '❌ Something went wrong. Try again or contact a Host.', ephemeral: true };
      interaction.deferred || interaction.replied
        ? await interaction.editReply(msg)
        : await interaction.reply(msg);
    }
    return;
  }

  // Button: verify
  if (interaction.isButton() && interaction.customId === 'verify') {
    const guild      = interaction.guild;
    const member     = interaction.member;
    const playerRole = guild.roles.cache.find(r => r.name === 'Player');

    if (!playerRole) {
      return interaction.reply({ content: '⚠️ Player role not found — contact a Host.', ephemeral: true });
    }

    if (member.roles.cache.has(playerRole.id)) {
      return interaction.reply({ content: '✅ You\'re already verified!', ephemeral: true });
    }

    try {
      await member.roles.add(playerRole, 'Self-verified via #verify');

      await interaction.reply({
        content:
          `✅ **Verified!** You now have access to the full server.\n\n` +
          `Next step: link your TFT Clash account with \`/link account <username>\``,
        ephemeral: true,
      });

      // Post welcome in #general
      const general = guild.channels.cache.find(c => c.name.includes('general'));
      if (general) {
        await general.send({ embeds: [welcomeEmbed(member)] });
      }

      console.log(`[verify] ${member.user.tag} verified`);
    } catch (err) {
      console.error('[verify error]', err);
      await interaction.reply({ content: '❌ Could not assign role — check bot permissions.', ephemeral: true });
    }
  }
});

// ─── New member join ──────────────────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`[join] ${member.user.tag}`);

  // DM welcome
  try {
    await member.send({ embeds: [welcomeDMEmbed(member)] });
  } catch {
    // DMs closed, silently skip
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function logError(guild, userTag, command, err) {
  if (!guild) return;
  const logCh = guild.channels.cache.find(c => c.name.includes('bot-logs'));
  if (logCh) {
    logCh.send(`**Error** \`/${command}\` by ${userTag}\n\`\`\`${err.message}\`\`\``).catch(() => {});
  }
}

client.login(process.env.DISCORD_TOKEN);
