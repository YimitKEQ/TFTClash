/**
 * make-invite.js — One-off: create a non-expiring, unlimited-uses invite to the guild.
 * Usage: node make-invite.js
 */

import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import 'dotenv/config';

var client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async function() {
  try {
    var guild = await client.guilds.fetch(process.env.GUILD_ID);
    if (!guild) { console.error('Guild not found'); process.exit(1); }

    // Pick the best public-facing channel. Prefer verify (public, the gate),
    // then announcements, then any text channel as a last resort.
    var channels = await guild.channels.fetch();
    var pickByName = function(needle) {
      return channels.find(function(c) {
        return c && c.type === ChannelType.GuildText && c.name && c.name.includes(needle);
      });
    };
    var channel =
      pickByName('verify') ||
      pickByName('announcements') ||
      pickByName('rules') ||
      pickByName('general') ||
      channels.find(function(c) { return c && c.type === ChannelType.GuildText; });

    if (!channel) { console.error('No text channel available for invite'); process.exit(1); }

    var invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 0,
      unique: true,
      reason: 'Permanent public invite generated via make-invite.js'
    });

    console.log('\n=================================================');
    console.log('PERMANENT INVITE: https://discord.gg/' + invite.code);
    console.log('=================================================');
    console.log('Channel: #' + channel.name);
    console.log('Expires: never');
    console.log('Max uses: unlimited');
    console.log('');
  } catch (err) {
    console.error('Failed to create invite:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
