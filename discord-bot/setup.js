/**
 * setup.js -- TFT Clash Discord server build.
 *
 * Default mode: IDEMPOTENT. Existing categories, channels, roles, and
 * messages are LEFT ALONE. Only missing pieces are created. Safe to
 * re-run after any structural change.
 *
 * Force-wipe mode: pass `--force-wipe` to nuke every channel before
 * rebuilding (the original behavior). Only use this on a brand-new or
 * scratch server -- it deletes user history.
 *
 *   node setup.js               (idempotent, recommended)
 *   node setup.js --force-wipe  (destructive, fresh server only)
 */

import {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType,
} from 'discord.js';
import 'dotenv/config';
import {
  rulesEmbed, verifyEmbed, verifyButton,
  standingsEmbed, clashInfoEmbed, seasonIntroEmbed,
} from './utils/embeds.js';
import { getStandings, getSeasonConfig, getTournamentState, getRegistrations } from './utils/data.js';

var FORCE_WIPE = process.argv.includes('--force-wipe');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Roles
const ROLE_DEFS = [
  { name: 'Season Champion', color: 0xFFD700, hoist: true,  mentionable: true  },
  { name: 'Host',            color: 0xE8A838, hoist: true,  mentionable: true  },
  { name: 'Pro',             color: 0x9B72CF, hoist: true,  mentionable: true  },
  { name: 'Player',          color: 0x4ECDC4, hoist: true,  mentionable: true  },
  { name: 'Challenger',      color: 0xFFD700, hoist: false, mentionable: false },
  { name: 'Grandmaster',     color: 0xC0392B, hoist: false, mentionable: false },
  { name: 'Master',          color: 0x9B72CF, hoist: false, mentionable: false },
  { name: 'Diamond',         color: 0x4ECDC4, hoist: false, mentionable: false },
  { name: 'Platinum',        color: 0x3FB68B, hoist: false, mentionable: false },
  { name: 'Muted',           color: 0x555555, hoist: false, mentionable: false },
];

// Server structure. type defaults to text. kind: 'forum' creates a forum channel.
const STRUCTURE = [
  {
    name: '── WELCOME ──',
    gate: 'public',
    children: [
      { name: '📣・announcements', gate: 'public',   readOnly: true,  topic: 'Official TFT Clash announcements.' },
      { name: '📜・rules',         gate: 'public',   readOnly: true,  topic: 'Read the rules before competing.' },
      { name: '✅・verify',        gate: 'public',   readOnly: false, topic: 'Click the button to enter the server.' },
      { name: '👋・newcomers',     gate: 'verified', readOnly: false, topic: 'Welcome posts for newly verified members. Say hi!' },
    ],
  },
  {
    name: '── CLASH HQ ──',
    gate: 'verified',
    children: [
      { name: '📅・clash-schedule',      gate: 'verified', readOnly: true,  topic: 'Upcoming clash dates and formats. Bot-powered.' },
      { name: '🎟️・clash-registrations', gate: 'verified', readOnly: true,  topic: 'Live feed of new clash registrations.' },
      { name: '🏆・results',             gate: 'verified', readOnly: true,  topic: 'Official results posted here after every clash.' },
      { name: '📊・standings',           gate: 'verified', readOnly: true,  topic: 'Season leaderboard updated after each clash.' },
      { name: '🎯・bracket',             gate: 'verified', readOnly: true,  topic: 'Bracket and lobby info dropped before each clash.' },
    ],
  },
  {
    name: '── COMMUNITY ──',
    gate: 'verified',
    children: [
      { name: '💬・general',      gate: 'verified', readOnly: false, topic: 'Main chat. Keep it chill.' },
      { name: '🔍・lfg',          gate: 'verified', readOnly: false, topic: 'Looking for scrims or fill spots? Post here.' },
      { name: '🎬・clips',        gate: 'verified', readOnly: false, topic: 'Highlight reels, clutch plays, funny moments.' },
      { name: '🧠・meta-talk',    gate: 'verified', readOnly: false, topic: 'Comp discussion, patch notes, theory-crafting.' },
      { name: '🤖・bot-commands', gate: 'verified', readOnly: false, topic: 'Use /profile /standings /clash here.' },
    ],
  },
  {
    name: '── HELP & FEEDBACK ──',
    gate: 'verified',
    children: [
      { name: '📖・how-to-clash', gate: 'verified', readOnly: true,  topic: 'Step-by-step guide on how a TFT Clash works.' },
      { name: '❓・faq',          gate: 'verified', readOnly: true,  topic: 'Frequently asked questions. Read before pinging a host.' },
      { name: '💡・feedback',     gate: 'verified', readOnly: false, topic: 'Suggestions, ideas, feature requests. One thread per idea.', kind: 'forum' },
      { name: '🐛・bug-reports',  gate: 'verified', readOnly: false, topic: 'Site or bot bug? Open a thread with steps to reproduce.', kind: 'forum' },
    ],
  },
  {
    name: '── VOICE ──',
    gate: 'verified',
    children: [
      { name: '🎮  Lobby 1',    type: 'voice', gate: 'verified' },
      { name: '🎮  Lobby 2',    type: 'voice', gate: 'verified' },
      { name: '👁️  Spectators', type: 'voice', gate: 'verified' },
    ],
  },
  {
    name: '── ADMIN ──',
    gate: 'host',
    children: [
      { name: '📋・bot-logs',       gate: 'host', readOnly: false, topic: 'All bot actions and errors logged here.' },
      { name: '⚙️・host-dashboard', gate: 'host', readOnly: false, topic: 'Use /post-results and admin commands here.' },
      { name: '💻・dev',            gate: 'host', readOnly: false, topic: 'Deployment notes, API status, debug.' },
    ],
  },
];

// Permission overwrites
function buildOverwrites(gate, readOnly, isForum, roles) {
  const { everyone, player, host, muted } = roles;
  const SEND          = PermissionFlagsBits.SendMessages;
  const VIEW          = PermissionFlagsBits.ViewChannel;
  const ADD_REACTIONS = PermissionFlagsBits.AddReactions;
  const ATTACH_FILES  = PermissionFlagsBits.AttachFiles;
  const EMBED_LINKS   = PermissionFlagsBits.EmbedLinks;
  const READ_HISTORY  = PermissionFlagsBits.ReadMessageHistory;
  const CREATE_THREAD = PermissionFlagsBits.CreatePublicThreads;
  const SEND_THREAD   = PermissionFlagsBits.SendMessagesInThreads;

  const CHAT_ALLOW  = [SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY];
  const FORUM_ALLOW = [VIEW, READ_HISTORY, CREATE_THREAD, SEND_THREAD, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS];

  const ow = [];

  if (gate === 'public') {
    if (readOnly) {
      ow.push({ id: everyone, deny: [SEND] });
      if (host) ow.push({ id: host.id, allow: [VIEW, SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY] });
    }
  } else if (gate === 'verified') {
    ow.push({ id: everyone, deny: [VIEW] });
    if (isForum) {
      if (player) ow.push({ id: player.id, allow: FORUM_ALLOW });
      if (host)   ow.push({ id: host.id,   allow: FORUM_ALLOW.concat([SEND]) });
    } else if (readOnly) {
      if (player) ow.push({ id: player.id, allow: [VIEW, ADD_REACTIONS, READ_HISTORY], deny: [SEND] });
      if (host)   ow.push({ id: host.id,   allow: [VIEW, SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY] });
    } else {
      if (player) ow.push({ id: player.id, allow: [VIEW].concat(CHAT_ALLOW) });
      if (host)   ow.push({ id: host.id,   allow: [VIEW].concat(CHAT_ALLOW) });
    }
  } else if (gate === 'host') {
    ow.push({ id: everyone, deny: [VIEW] });
    if (player) ow.push({ id: player.id, deny: [VIEW] });
    if (host)   ow.push({ id: host.id,   allow: [VIEW, SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY] });
  }

  if (muted) ow.push({ id: muted.id, deny: [SEND, ADD_REACTIONS] });

  return ow;
}

function channelTypeFor(ch) {
  if (ch.type === 'voice') return ChannelType.GuildVoice;
  if (ch.kind === 'forum') return ChannelType.GuildForum;
  return ChannelType.GuildText;
}

// Find existing category by name
function findCategory(guild, name) {
  return guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && c.name === name;
  });
}

// Find existing channel by name (any non-category type)
function findChannel(guild, name) {
  return guild.channels.cache.find(function(c) {
    return c.type !== ChannelType.GuildCategory && c.name === name;
  });
}

client.once('ready', async () => {
  console.log(`\nLogged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); }

  console.log(`Setting up: ${guild.name}`);
  console.log(`Mode: ${FORCE_WIPE ? 'FORCE-WIPE (destructive)' : 'IDEMPOTENT (safe)'}\n`);

  // 1. Optional wipe (only with --force-wipe)
  if (FORCE_WIPE) {
    console.log('[1/5] Force-wipe: deleting all channels...');
    for (const [, ch] of await guild.channels.fetch()) {
      try { await ch.delete(); } catch {}
    }
  } else {
    console.log('[1/5] Skip wipe (idempotent mode). Existing channels preserved.');
  }

  // 2. Create roles (idempotent: skip if exists)
  console.log('[2/5] Ensuring roles...');
  for (const def of ROLE_DEFS) {
    const exists = guild.roles.cache.find(r => r.name === def.name);
    if (!exists) {
      await guild.roles.create({ name: def.name, color: def.color, hoist: def.hoist, mentionable: def.mentionable });
      console.log(`  + created role ${def.name}`);
    }
  }
  await guild.roles.fetch();

  const roleMap = name => guild.roles.cache.find(r => r.name === name);
  const roles = {
    everyone: guild.roles.everyone.id,
    player:   roleMap('Player'),
    host:     roleMap('Host'),
    muted:    roleMap('Muted'),
  };

  // 3. Build channels (idempotent: skip if category/channel exists by name)
  console.log('[3/5] Ensuring categories and channels...');
  await guild.channels.fetch();
  const channelMap = {};

  for (const cat of STRUCTURE) {
    let category = findCategory(guild, cat.name);
    if (!category) {
      const catOw = buildOverwrites(cat.gate, false, false, roles);
      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: catOw,
      });
      console.log(`  + created category ${cat.name}`);
    } else {
      console.log(`  · category exists: ${cat.name}`);
    }

    for (const ch of cat.children) {
      const existing = findChannel(guild, ch.name);
      if (existing) {
        const key = ch.name.replace(/[^a-z0-9\-]/gi, '').toLowerCase();
        channelMap[key] = existing;
        console.log(`    · channel exists: ${ch.name}`);
        continue;
      }
      const isForum = ch.kind === 'forum';
      const chOw    = buildOverwrites(ch.gate, ch.readOnly ?? false, isForum, roles);
      try {
        const channel = await guild.channels.create({
          name:                 ch.name,
          type:                 channelTypeFor(ch),
          parent:               category.id,
          topic:                ch.topic ?? '',
          permissionOverwrites: chOw,
        });
        const key = ch.name.replace(/[^a-z0-9\-]/gi, '').toLowerCase();
        channelMap[key] = channel;
        console.log(`    + created ${isForum ? 'forum' : (ch.type === 'voice' ? 'voice' : 'text')} channel ${ch.name}`);
      } catch (err) {
        console.error(`    ✗ failed to create ${ch.name}: ${err.message}`);
      }
    }
  }

  // 4. Post initial content (only when wiping; otherwise leave history alone)
  if (FORCE_WIPE) {
    console.log('\n[4/5] Posting initial content (force-wipe mode)...');

    const get = (key) => Object.entries(channelMap).find(([k]) => k.includes(key))?.[1];

    const rulesCh = get('rules');
    if (rulesCh) {
      const m = await rulesCh.send({ embeds: [rulesEmbed()] });
      await m.pin().catch(() => {});
      console.log('  ✓ rules');
    }

    const verifyCh = get('verify');
    if (verifyCh) {
      const m = await verifyCh.send({ embeds: [verifyEmbed()], components: [verifyButton()] });
      await m.pin().catch(() => {});
      console.log('  ✓ verify');
    }

    const season = await getSeasonConfig();
    const ts = await getTournamentState();
    const players = await getStandings(10);
    const regs = await getRegistrations();

    const annCh = get('announcements');
    if (annCh) {
      await annCh.send({ embeds: [seasonIntroEmbed(season)] });
      console.log('  ✓ announcements');
    }

    const schedCh = get('clashschedule');
    if (schedCh) {
      await schedCh.send({ embeds: [clashInfoEmbed(ts, season, regs.length)] });
      console.log('  ✓ clash-schedule');
    }

    const standCh = get('standings');
    if (standCh) {
      await standCh.send({ embeds: [standingsEmbed(players, season)] });
      console.log('  ✓ standings');
    }
  } else {
    console.log('\n[4/5] Skip seeding (idempotent mode). Run `node harden-channels.js` to refresh pinned guides safely.');
  }

  // 5. Bot status
  console.log('\n[5/5] Setting bot status...');
  client.user.setPresence({
    activities: [{ name: 'TFT Clash · /clash', type: 0 }],
    status: 'online',
  });

  console.log(`\n✅ Server is ready (${FORCE_WIPE ? 'wiped + rebuilt' : 'safely synced'}). Run: node index.js\n`);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
