/**
 * repost-verify.js — Re-post the verify embed + button into the #verify channel.
 * Non-destructive. Run once when the verify message has been deleted by accident.
 *   node repost-verify.js
 */

import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import 'dotenv/config';
import { verifyEmbed, verifyButton } from './utils/embeds.js';

var client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async function () {
  console.log('\nLogged in as ' + client.user.tag);
  var guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) {
    console.error('Guild not found (GUILD_ID=' + process.env.GUILD_ID + ')');
    process.exit(1);
  }

  var channels = await guild.channels.fetch();
  var verifyCh = null;
  for (var entry of channels) {
    var ch = entry[1];
    if (!ch || ch.type !== ChannelType.GuildText) continue;
    var name = (ch.name || '').toLowerCase();
    if (name.indexOf('verify') !== -1) { verifyCh = ch; break; }
  }

  if (!verifyCh) {
    console.error('Could not find a #verify text channel.');
    process.exit(1);
  }

  console.log('Posting verify message in #' + verifyCh.name + '...');
  var msg = await verifyCh.send({
    embeds: [verifyEmbed()],
    components: [verifyButton()],
  });
  await msg.pin().catch(function () {});
  console.log('Verify message posted (id ' + msg.id + ') and pinned.');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
