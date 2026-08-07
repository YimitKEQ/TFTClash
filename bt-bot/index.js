/**
 * index.js - BrosephTech accountability bot entry point.
 * Start: node index.js
 *
 * Standalone process. Independent of the TFT Clash bot. Shares only the
 * Supabase backend (read-only) for the content board.
 */

import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import path from 'path';
import 'dotenv/config';

import { generateDependencyReport } from '@discordjs/voice';

import { startScheduler } from './scheduler.js';
import { startFeed } from './lib/feed.js';
import { startDashboard } from './web/server.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize the voice encryption backend up front so the first /record never
// races libsodium loading. libsodium-wrappers ships a broken ESM entry, so load
// it via CommonJS require (the same path @discordjs/voice uses) instead of a
// static import. Also log what the voice stack resolved to, which is the fastest
// way to diagnose "the bot joined but recorded silence".
var require = createRequire(import.meta.url);
try {
  var _sodium = require('libsodium-wrappers');
  if (_sodium && _sodium.ready) await _sodium.ready;
} catch (e) {
  console.warn('[voice] libsodium init skipped: ' + ((e && e.message) || e));
}
console.log('[voice] dependency report:\n' + generateDependencyReport());

// Guilds for slash commands/embeds, GuildVoiceStates so the bot can join a
// voice channel and receive audio for /record. Neither is a privileged intent
// (GuildVoiceStates does not require the portal toggle); message content and
// the member list are still never read.
var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ---- Load slash commands -----------------------------------------------------
// A command owns its own interactive pieces. Exporting `componentIds` registers
// the customId prefixes it answers to, so adding a command with buttons never
// means editing a hardcoded prefix table down in the interaction handler.
client.commands = new Collection();
var componentOwners = {};
var commandFiles = readdirSync(path.join(__dirname, 'commands')).filter(function(f) { return f.endsWith('.js'); });
for (var i = 0; i < commandFiles.length; i++) {
  var file = commandFiles[i];
  var url = pathToFileURL(path.join(__dirname, 'commands', file)).href;
  var cmd = await import(url);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    var prefixes = Array.isArray(cmd.componentIds) ? cmd.componentIds : [];
    prefixes.forEach(function(prefix) { componentOwners[prefix] = cmd.data.name; });
    console.log('[cmd] ' + cmd.data.name + (prefixes.length ? ' (components: ' + prefixes.join(', ') + ')' : ''));
  }
}

// Map a component customId ("rec:approve:123") to the command that owns it.
function ownerOfComponent(customId) {
  var prefix = String(customId || '').split(':')[0];
  return componentOwners[prefix] || null;
}

// ---- Ready -------------------------------------------------------------------
client.once(Events.ClientReady, function(c) {
  console.log('BrosephTech bot online as ' + c.user.tag);
  c.user.setPresence({
    activities: [{ name: 'the board', type: ActivityType.Watching }],
    status: 'online',
  });
  startScheduler(client);
  startFeed(client).catch(function(e) {
    console.error('[feed] startFeed failed: ' + ((e && e.message) || e));
  });
  try { startDashboard(); } catch (e) {
    console.error('[dashboard] start failed: ' + ((e && e.message) || e));
  }
});

// ---- Interaction handler -----------------------------------------------------
client.on(Events.InteractionCreate, async function(interaction) {
  // Modal submissions (e.g. the /meeting capture modal).
  if (interaction.isModalSubmit()) {
    if (interaction.customId.indexOf('meeting:') === 0) {
      var meetingCmd = client.commands.get('meeting');
      if (meetingCmd && meetingCmd.handleModal) {
        try {
          await meetingCmd.handleModal(interaction);
        } catch (err) {
          console.error('[error] meeting modal:', err);
          var failMsg = { content: 'Something went wrong capturing that meeting.', ephemeral: true };
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(failMsg).catch(function() {});
          } else {
            await interaction.reply(failMsg).catch(function() {});
          }
        }
      }
    }
    return;
  }

  // Autocomplete must answer inside about three seconds and must never throw:
  // an unanswered autocomplete leaves the user staring at a spinner.
  if (interaction.isAutocomplete()) {
    var acCmd = client.commands.get(interaction.commandName);
    if (acCmd && acCmd.autocomplete) {
      try {
        await acCmd.autocomplete(interaction);
      } catch (err) {
        console.error('[error] autocomplete /' + interaction.commandName + ':', err);
        await interaction.respond([]).catch(function() {});
      }
    }
    return;
  }

  // Buttons / select menus routed to their owning command by customId prefix.
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    var cid = String(interaction.customId || '');
    var ownerName = ownerOfComponent(cid);
    if (ownerName) {
      var ownerCmd = client.commands.get(ownerName);
      if (ownerCmd && ownerCmd.handleComponent) {
        try {
          await ownerCmd.handleComponent(interaction);
        } catch (err) {
          console.error('[error] ' + ownerName + ' component:', err);
          var cFail = { content: 'Something went wrong handling that action.', ephemeral: true };
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(cFail).catch(function() {});
          } else {
            await interaction.reply(cFail).catch(function() {});
          }
        }
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  var cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;
  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error('[error] /' + interaction.commandName + ':', err);
    var msg = { content: 'Something went wrong running that command. Try again in a moment.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(function() {});
    } else {
      await interaction.reply(msg).catch(function() {});
    }
  }
});

client.login(process.env.BT_DISCORD_TOKEN);
