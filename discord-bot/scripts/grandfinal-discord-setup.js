/**
 * grandfinal-discord-setup.js - create a private "👑 GRAND FINAL" category
 * (locked to the 8 finalists + staff) with #general and #info channels, post
 * a clear plain-language explainer of the checkmate format, and DM all 8
 * finalists their invite.
 *
 * Usage:
 *   node discord-bot/scripts/grandfinal-discord-setup.js --dry   # verify only
 *   node discord-bot/scripts/grandfinal-discord-setup.js
 */

import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  OverwriteType, EmbedBuilder, Partials,
} from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { runAll } from '../utils/dmQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DRY = process.argv.includes('--dry');
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_NAME = '👑 GRAND FINAL';
const SITE_URL = 'https://tftclash.com';

const FINALISTS = [
  { name: 'wondeR', id: '246959391335645184', seed: 1, pts: 33 },
  { name: 'yatora1', id: '1000625185289932843', seed: 2, pts: 32 },
  { name: 'Sacred Norris', id: '566547566364327956', seed: 3, pts: 31 },
  { name: 'RavingRaven', id: '455447266023571457', seed: 4, pts: 31 },
  { name: 'Lynx', id: '186851013817401346', seed: 5, pts: 30 },
  { name: 'Nike3', id: '136065430799384577', seed: 6, pts: 28 },
  { name: 'PortugueseBabe', id: '910857189105758239', seed: 7, pts: 27 },
  { name: 'magoose', id: '257509468298936330', seed: 8, pts: 27 },
];

var FORMAT_TEXT =
  'One lobby, all 8 of you, playing game after game until someone wins the whole thing.\n\n' +
  '**The rule: first to 20+ cumulative points, then you need to WIN a game.**\n' +
  'Being at 20 or more is not enough by itself. The moment a player places **1st** in a game ' +
  'while their running total (including that game) is **20 or higher**, they are instantly the ' +
  '**Season Champion**. Game over, right there.\n\n' +
  '⚠️ **This means multiple players can be sitting at 20+ waiting.** If that happens, it comes down ' +
  'to whoever wins the very next game they\'re in - it does not matter who has the most points overall, ' +
  'only who converts a 20+ standing into an actual win first.\n\n' +
  'Scoring is standard (1st=8pts ... 8th=1pt). There is no fixed number of games - we play until someone clinches it.';

function inviteEmbed() {
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('👑 You made the Grand Final')
    .setDescription(
      'You finished in the Top 8 of tonight\'s Playoffs - and tomorrow you play for the season title.\n\n' +
      '🕔 **Tomorrow, 17:00 CEST** (same time as today)\n' +
      '🎟️ **Check in from 16:30 CEST** - `/checkin` or ' + SITE_URL + '\n\n' +
      FORMAT_TEXT + '\n\n' +
      'Be checked in by 17:00 or your seat goes to a standby. See you tomorrow.'
    )
    .setFooter({ text: 'TFT Clash · Grand Final' });
}

function infoEmbed() {
  var roster = FINALISTS.map(function(f) { return f.seed + '. ' + f.name + ' - ' + f.pts + ' pts (Playoffs)'; }).join('\n');
  return new EmbedBuilder()
    .setColor(0x00DBED)
    .setTitle('Grand Final · Tomorrow 17:00 CEST')
    .setDescription(FORMAT_TEXT + '\n\n**Check-in:** opens 16:30 CEST - `/checkin` or ' + SITE_URL + '.')
    .addFields({ name: 'The Top 8', value: roster })
    .setFooter({ text: 'TFT Clash · Grand Final' });
}

async function main() {
  if (!TOKEN || !GUILD_ID) { console.error('[gf-discord] missing env'); process.exit(1); }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
    partials: [Partials.Channel],
  });
  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  console.log('[gf-discord] connected as ' + client.user.tag + (DRY ? ' (DRY)' : ''));

  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.members.fetch().catch(function() {});

  var present = FINALISTS.filter(function(f) { return guild.members.cache.has(f.id); });
  var absent = FINALISTS.filter(function(f) { return !guild.members.cache.has(f.id); });
  console.log('[gf-discord] in server: ' + present.length + '/' + FINALISTS.length);
  absent.forEach(function(f) { console.log('   NOT in server: ' + f.name + ' (' + f.id + ')'); });

  if (DRY) { await client.destroy(); process.exit(0); }

  var everyone = guild.roles.everyone.id;
  var staffRoleNames = ['Host', 'Admin', 'Staff', 'Mod', 'Moderator'];
  var staffRoles = staffRoleNames.map(function(n) { return guild.roles.cache.find(function(r) { return r.name === n; }); }).filter(Boolean);
  function memberAllow(perms) { return present.map(function(f) { return { id: f.id, type: OverwriteType.Member, allow: perms }; }); }
  function staffAllow(perms) { return staffRoles.map(function(r) { return { id: r.id, type: OverwriteType.Role, allow: perms }; }); }
  var botAllow = [{ id: client.user.id, type: OverwriteType.Member, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] }];
  var denyEveryone = [{ id: everyone, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] }];

  var category = guild.channels.cache.find(function(c) { return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME; });
  if (!category) {
    category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: denyEveryone.concat(botAllow).concat(staffAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])).concat(memberAllow([PermissionFlagsBits.ViewChannel])),
    });
    console.log('[gf-discord] category created: ' + category.id);
  }

  var general = guild.channels.cache.find(function(c) { return c.parentId === category.id && c.name.indexOf('grand-final-general') !== -1; });
  if (!general) {
    general = await guild.channels.create({
      name: '💬-grand-final-general',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Private lounge for the Grand Final Top 8.',
      permissionOverwrites: denyEveryone.concat(botAllow).concat(staffAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])).concat(memberAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])),
    });
    console.log('[gf-discord] #grand-final-general created');
  }

  var info = guild.channels.cache.find(function(c) { return c.parentId === category.id && c.name.indexOf('grand-final-info') !== -1; });
  if (!info) {
    info = await guild.channels.create({
      name: '📣-grand-final-info',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Read-only info for the Grand Final.',
      permissionOverwrites: denyEveryone.concat(botAllow).concat(staffAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages])).concat(memberAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])),
    });
    var posted = await info.send({ embeds: [infoEmbed()] });
    await posted.pin().catch(function() {});
    console.log('[gf-discord] #grand-final-info created + format pinned');
  }

  if (general) {
    await general.send('Welcome to the **Grand Final** lounge. 👑\nCheck in from **16:30 CEST** tomorrow, the final starts **17:00**. Format explained in <#' + info.id + '>. Good luck to all 8 of you.')
      .then(function(m) { return m.pin().catch(function() {}); }).catch(function() {});
  }

  var results = await runAll(present, async function(f) {
    var user = await client.users.fetch(f.id);
    await user.send({ embeds: [inviteEmbed()] });
    return true;
  });
  var ok = results.filter(function(r) { return r.ok; });
  console.log('[gf-discord] DMs sent: ' + ok.length + '/' + present.length);
  results.filter(function(r) { return !r.ok; }).forEach(function(r) {
    console.log('   DM FAILED: ' + r.item.name + ': ' + (r.error && r.error.message ? r.error.message : 'unknown'));
  });

  await client.destroy();
  process.exit(0);
}

main().catch(function(e) { console.error('[gf-discord] FATAL:', e); process.exit(1); });
