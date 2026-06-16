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
import path from 'path';
import 'dotenv/config';

import { startScheduler } from './scheduler.js';
import { startFeed } from './lib/feed.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only the Guilds intent is needed: the bot posts embeds and replies to slash
// commands. It never reads message content or fetches members (mentions use
// raw user ids), so no privileged intents are required.
var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// ---- Load slash commands -----------------------------------------------------
client.commands = new Collection();
var commandFiles = readdirSync(path.join(__dirname, 'commands')).filter(function(f) { return f.endsWith('.js'); });
for (var i = 0; i < commandFiles.length; i++) {
  var file = commandFiles[i];
  var url = pathToFileURL(path.join(__dirname, 'commands', file)).href;
  var cmd = await import(url);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log('[cmd] ' + cmd.data.name);
  }
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
