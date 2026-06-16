/**
 * deploy-commands.js - register the slash commands for the BrosephTech bot.
 * Run once, and again whenever commands change: node deploy-commands.js
 *
 * Loads every command in commands/ dynamically so new commands register
 * automatically.
 */

import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import 'dotenv/config';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

var commands = [];
var files = readdirSync(path.join(__dirname, 'commands')).filter(function(f) { return f.endsWith('.js'); });
for (var i = 0; i < files.length; i++) {
  var mod = await import(pathToFileURL(path.join(__dirname, 'commands', files[i])).href);
  if (mod.data && typeof mod.data.toJSON === 'function') {
    commands.push(mod.data.toJSON());
  }
}

if (!process.env.BT_DISCORD_TOKEN || !process.env.BT_CLIENT_ID || !process.env.BT_GUILD_ID) {
  console.error('BT_DISCORD_TOKEN, BT_CLIENT_ID and BT_GUILD_ID must all be set in .env');
  process.exit(1);
}

if (process.env.BT_DISCORD_TOKEN.indexOf('PASTE') !== -1) {
  console.error('BT_DISCORD_TOKEN is still the placeholder. Paste the real bot token from the Discord Developer Portal (your app > Bot tab > Reset Token) into bt-bot/.env, then run npm run deploy again.');
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
    if (err && err.status === 401) {
      console.error('401 Unauthorized: Discord rejected the bot token. Reset it in the Bot tab and update BT_DISCORD_TOKEN in bt-bot/.env (the token is the secret, not the Application ID).');
    } else {
      console.error('Failed to register commands: ' + ((err && err.message) || err));
    }
    process.exitCode = 1;
  }
})();
