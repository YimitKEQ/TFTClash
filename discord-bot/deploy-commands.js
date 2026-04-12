/**
 * deploy-commands.js — Registers all slash commands with Discord.
 * Run this once (and again any time you add/change commands).
 *
 * Usage: node deploy-commands.js
 */

import { REST, Routes } from 'discord.js';
import 'dotenv/config';

import { data as standings }    from './commands/standings.js';
import { data as profile }      from './commands/profile.js';
import { data as link }         from './commands/link.js';
import { data as clash }        from './commands/clash.js';
import { data as results }      from './commands/results.js';
import { data as register }     from './commands/register.js';
import { data as checkin }      from './commands/checkin.js';
import { data as leaderboard }  from './commands/leaderboard.js';
import { data as countdown }    from './commands/countdown.js';

const commands = [standings, profile, link, clash, results, register, checkin, leaderboard, countdown].map(function(c) { return c.toJSON(); });

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async function() {
  console.log('Registering ' + commands.length + ' slash commands...');
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );
    console.log('✓ ' + commands.length + ' slash commands registered.');
  } catch (err) {
    console.error(err);
  }
})();
