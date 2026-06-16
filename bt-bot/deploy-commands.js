/**
 * deploy-commands.js - register the slash commands for the BrosephTech bot.
 * Run once, and again whenever commands change: node deploy-commands.js
 */

import { REST, Routes } from 'discord.js';
import 'dotenv/config';

import { data as standup }  from './commands/standup.js';
import { data as board }    from './commands/board.js';
import { data as mytasks }  from './commands/mytasks.js';

var commands = [standup, board, mytasks].map(function(c) { return c.toJSON(); });

if (!process.env.BT_DISCORD_TOKEN || !process.env.BT_CLIENT_ID || !process.env.BT_GUILD_ID) {
  console.error('BT_DISCORD_TOKEN, BT_CLIENT_ID and BT_GUILD_ID must all be set in .env');
  process.exit(1);
}

var rest = new REST({ version: '10' }).setToken(process.env.BT_DISCORD_TOKEN);

(async function() {
  console.log('Registering ' + commands.length + ' slash command(s)...');
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.BT_CLIENT_ID, process.env.BT_GUILD_ID),
      { body: commands }
    );
    console.log('Registered ' + commands.length + ' slash command(s).');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
