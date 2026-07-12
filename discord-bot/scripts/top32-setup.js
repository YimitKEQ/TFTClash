/**
 * top32-setup.js - one-off setup for the Top 32 Playoffs (2026-07-11).
 *
 * Creates a private "TOP 32 PLAYOFFS" category (general + info channels,
 * visible only to the 32 seeded players + staff), then DMs all 32 their
 * invite. Reuses the bot's DM rate-limit queue so we stay under Discord's
 * ~5 DM/sec ceiling.
 *
 * Usage (from anywhere - env + imports are resolved by absolute/module path):
 *   node discord-bot/scripts/top32-setup.js --dry     # verify only, no writes
 *   node discord-bot/scripts/top32-setup.js           # create channels + send DMs
 *   node discord-bot/scripts/top32-setup.js --no-dm   # channels only
 *
 * This is intentionally standalone: it spins up its own gateway client, does
 * the work, and exits. It does not require the main bot to be running.
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
const NO_DM = process.argv.includes('--no-dm');
const NO_CHANNELS = process.argv.includes('--no-channels');

const GUILD_ID = process.env.GUILD_ID;
const TOKEN = process.env.DISCORD_TOKEN;
const CATEGORY_NAME = '🏆 TOP 32 PLAYOFFS';
const SITE_URL = 'https://tftclash.com';

// The 32 seeded players, in seed order. discord ids are the best-known snowflake
// (bot /link where present, else the site Discord-OAuth identity).
const PLAYERS = [
  { name: 'PortugueseBabe', id: '910857189105758239' },
  { name: 'RavingRaven', id: '455447266023571457' },
  { name: '૮꒰˶ - ˕ -꒱ა', id: '1343942160776691712' },
  { name: 'Nike3', id: '136065430799384577' },
  { name: 'wondeR', id: '246959391335645184' },
  { name: 'Lynx', id: '186851013817401346' },
  { name: 'magoose', id: '257509468298936330' },
  { name: 'Ricsi', id: '186834575694102528' },
  { name: 'Sacred Norris', id: '566547566364327956' },
  { name: 'BigClean', id: '1445746349760057485' },
  { name: 'Paellidac', id: '631044069967265802' },
  { name: 'dotdude', id: '567114371218538496' },
  { name: 'Nacht', id: '270195672064589834' },
  { name: 'Coelho', id: '469644179547488286' },
  { name: 'mibi', id: '305286826451795970' },
  { name: 'Fitspire', id: '86737758512513024' },
  { name: 'Lava', id: '534882472693989377' },
  { name: 'daniella', id: '821382618741735454' },
  { name: 'ChuYing', id: '416657340964536328' },
  { name: 'GAZDA', id: '178474885281087488' },
  { name: 'Kajuso', id: '1241731159478632514' },
  { name: 'TeaTimePrime', id: '214724521070952448' },
  { name: 'Yukineige', id: '330662370693349376' },
  { name: 'ochimop', id: '165834932919205888' },
  { name: 'KAIDO', id: '481920990092197898' },
  { name: 'Tamako', id: '165170281814556672' },
  { name: 'aya 🛒', id: '1045859668578275409' },
  { name: 'Matyuss', id: '270157059662544896' },
  { name: 'ThorThePaladin', id: '892464570621378571' },
  { name: 'Kreivo', id: '437218166326820887' },
  { name: 'DylanS', id: '545318837348728842' },
  { name: 'yatora1', id: '1000625185289932843' },
];

if (!TOKEN || !GUILD_ID) {
  console.error('[top32] Missing DISCORD_TOKEN or GUILD_ID in discord-bot/.env');
  process.exit(1);
}

function inviteEmbed(generalChannelId) {
  var lounge = generalChannelId ? '<#' + generalChannelId + '>' : '#top-32-general';
  return new EmbedBuilder()
    .setColor(0xEDC200)
    .setTitle('🏆 You made the Top 32')
    .setDescription(
      'Your season results locked you into tonight\'s **TFT Clash Top 32 Playoffs**.\n' +
      '32 players, 5 games, one shot. The **Top 8 advance to the Grand Final**.\n\n' +
      '🕔 **Start:** today **17:00 CEST**\n' +
      '🎮 **Format:** 5 games, best cumulative points, no eliminations\n' +
      '🎟️ **Check in from 16:45 CEST** with `/checkin` here or on ' + SITE_URL + '\n' +
      '💬 **Your lounge:** ' + lounge + '\n\n' +
      'Be online and checked in by 17:00 or your seat goes to an alternate.\n' +
      'Can\'t make it? Reply to this DM so we can slot in a standby. GLHF, see you on the Rift.'
    )
    .setFooter({ text: 'TFT Clash · Top 32 Playoffs' });
}

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Channel],
  });

  await client.login(TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  console.log('[top32] Connected as ' + client.user.tag + (DRY ? '  (DRY RUN)' : ''));

  const guild = await client.guilds.fetch(GUILD_ID).then(function(g) { return g.fetch(); });
  console.log('[top32] Guild: ' + guild.name + ' (' + guild.memberCount + ' members)');

  // Warm the member cache so permission overwrites and membership checks resolve.
  await guild.members.fetch().catch(function(e) {
    console.error('[top32] members.fetch failed (need GuildMembers intent):', e && e.message);
  });

  var present = [];
  var absent = [];
  PLAYERS.forEach(function(p) {
    if (guild.members.cache.has(p.id)) present.push(p);
    else absent.push(p);
  });

  console.log('[top32] In server: ' + present.length + '/' + PLAYERS.length);
  if (absent.length) {
    console.log('[top32] NOT in server (cannot DM or auto-add to channel):');
    absent.forEach(function(p) { console.log('   - ' + p.name + ' (' + p.id + ')'); });
  }

  if (DRY) {
    console.log('[top32] DRY RUN complete. No channels created, no DMs sent.');
    await client.destroy();
    process.exit(0);
  }

  // ── Channels ────────────────────────────────────────────────────────────────
  var generalId = null;
  if (!NO_CHANNELS) {
    var everyone = guild.roles.everyone.id;
    var staffRoleNames = ['Host', 'Admin', 'Staff', 'Mod', 'Moderator'];
    var staffRoles = staffRoleNames
      .map(function(n) { return guild.roles.cache.find(function(r) { return r.name === n; }); })
      .filter(Boolean);

    function memberAllow(perms) {
      return present.map(function(p) {
        return { id: p.id, type: OverwriteType.Member, allow: perms };
      });
    }
    function staffAllow(perms) {
      return staffRoles.map(function(r) {
        return { id: r.id, type: OverwriteType.Role, allow: perms };
      });
    }
    var botAllow = [{
      id: client.user.id, type: OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
    }];
    var denyEveryone = [{ id: everyone, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] }];

    // Reuse an existing category if this script already ran.
    var category = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME;
    });
    if (!category) {
      category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: denyEveryone
          .concat(botAllow)
          .concat(staffAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]))
          .concat(memberAllow([PermissionFlagsBits.ViewChannel])),
      });
      console.log('[top32] Category created: ' + category.name + ' (' + category.id + ')');
    } else {
      console.log('[top32] Reusing existing category ' + category.id);
    }

    var general = guild.channels.cache.find(function(c) {
      return c.parentId === category.id && c.name.indexOf('top-32-general') !== -1;
    });
    if (!general) {
      general = await guild.channels.create({
        name: '💬-top-32-general',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Private lounge for the Top 32 Playoffs finalists.',
        permissionOverwrites: denyEveryone
          .concat(botAllow)
          .concat(staffAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]))
          .concat(memberAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])),
      });
      console.log('[top32] #top-32-general created (' + general.id + ')');
    }
    generalId = general.id;

    var info = guild.channels.cache.find(function(c) {
      return c.parentId === category.id && c.name.indexOf('top-32-info') !== -1;
    });
    if (!info) {
      info = await guild.channels.create({
        name: '📣-top-32-info',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Read-only info for the Top 32 Playoffs.',
        permissionOverwrites: denyEveryone
          .concat(botAllow)
          .concat(staffAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]))
          .concat(memberAllow([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])),
      });
      console.log('[top32] #top-32-info created (' + info.id + ')');

      var roster = PLAYERS.map(function(p, i) { return (i + 1) + '. ' + p.name; }).join('\n');
      var infoEmbed = new EmbedBuilder()
        .setColor(0x00DBED)
        .setTitle('Top 32 Playoffs · Tonight 17:00 CEST')
        .setDescription(
          '**Format:** 32 players · 5 games · best cumulative points · no eliminations.\n' +
          'The **Top 8** advance to the Grand Final (separate date, checkmate format).\n\n' +
          '**Check-in:** opens **16:45 CEST** - `/checkin` here or on ' + SITE_URL + '.\n' +
          'Be checked in by 17:00 or your seat goes to a standby.\n\n' +
          '**Scoring:** 1st = 8pts, 2nd = 7 ... 8th = 1pt.'
        )
        .addFields({ name: 'The 32', value: roster.length > 1024 ? roster.slice(0, 1020) + '...' : roster })
        .setFooter({ text: 'TFT Clash · Good luck' });
      await info.send({ embeds: [infoEmbed] }).catch(function(e) { console.error('[top32] info post failed:', e && e.message); });
    } else {
      console.log('[top32] Reusing existing #top-32-info');
    }

    if (general) {
      await general.send('Welcome to the **Top 32 Playoffs** lounge. 🏆\nCheck in from **16:45 CEST**, games start **17:00**. Pinned info is in <#' + (info ? info.id : generalId) + '>. GLHF!')
        .then(function(m) { return m.pin().catch(function() {}); })
        .catch(function(e) { console.error('[top32] general welcome failed:', e && e.message); });
    }
  }

  // ── DMs ───────────────────────────────────────────────────────────────────
  if (!NO_DM) {
    var embed = inviteEmbed(generalId);
    console.log('[top32] Sending ' + PLAYERS.length + ' invite DMs...');
    var results = await runAll(PLAYERS, async function(p) {
      var user = await client.users.fetch(p.id);
      await user.send({ embeds: [embed] });
      return true;
    });
    var ok = results.filter(function(r) { return r.ok; });
    var failed = results.filter(function(r) { return !r.ok; });
    console.log('[top32] DMs sent: ' + ok.length + '/' + PLAYERS.length);
    if (failed.length) {
      console.log('[top32] DM FAILED (reach these another way):');
      failed.forEach(function(r) {
        console.log('   - ' + r.item.name + ' (' + r.item.id + '): ' + (r.error && r.error.message ? r.error.message : 'unknown'));
      });
    }
  }

  console.log('[top32] Done.');
  await client.destroy();
  process.exit(0);
}

main().catch(function(e) {
  console.error('[top32] FATAL:', e);
  process.exit(1);
});
