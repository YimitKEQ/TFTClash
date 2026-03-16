/**
 * setup.js — Full TFT Clash Discord server build.
 * Run once: node setup.js
 */

import {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType,
  OverwriteType,
} from 'discord.js';
import 'dotenv/config';
import {
  rulesEmbed, verifyEmbed, verifyButton,
  standingsEmbed, clashInfoEmbed, seasonIntroEmbed,
} from './utils/embeds.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ─── Roles ────────────────────────────────────────────────────────────────────
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

// ─── Server structure ─────────────────────────────────────────────────────────
// gate: 'public' = anyone | 'verified' = @Player+ | 'host' = @Host only
// readOnly: only @Host can send messages
const STRUCTURE = [
  {
    name: '── WELCOME ──',
    gate: 'public',
    children: [
      { name: '📣・announcements', gate: 'public',   readOnly: true,  topic: 'Official TFT Clash announcements.' },
      { name: '📜・rules',         gate: 'public',   readOnly: true,  topic: 'Read the rules before competing.' },
      { name: '✅・verify',        gate: 'public',   readOnly: false, topic: 'Click the button to enter the server.' },
    ],
  },
  {
    name: '── CLASH HQ ──',
    gate: 'verified',
    children: [
      { name: '📅・clash-schedule', gate: 'verified', readOnly: true,  topic: 'Upcoming clash dates and formats. Bot-powered.' },
      { name: '🏆・results',        gate: 'verified', readOnly: true,  topic: 'Official results posted here after every clash.' },
      { name: '📊・standings',      gate: 'verified', readOnly: true,  topic: 'Season leaderboard — updated after each clash.' },
      { name: '🎯・bracket',        gate: 'verified', readOnly: true,  topic: 'Bracket and lobby info dropped before each clash.' },
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

// ─── Build permission overwrites ──────────────────────────────────────────────
function buildOverwrites(gate, readOnly, roles) {
  const { everyone, player, host } = roles;
  const SEND  = PermissionFlagsBits.SendMessages;
  const VIEW  = PermissionFlagsBits.ViewChannel;

  const ow = [];

  if (gate === 'public') {
    // Everyone can see; only hosts can send in readOnly channels
    if (readOnly) {
      ow.push({ id: everyone, deny: [SEND] });
      ow.push({ id: host.id,  allow: [SEND, VIEW] });
    }
  } else if (gate === 'verified') {
    // Hide from unverified (@everyone); show to @Player+
    ow.push({ id: everyone,   deny:  [VIEW] });
    ow.push({ id: player.id,  allow: [VIEW] });
    ow.push({ id: host.id,    allow: [VIEW, SEND] });
    if (readOnly) {
      ow.push({ id: player.id, deny: [SEND] });
      ow.push({ id: host.id,   allow: [SEND] });
    }
  } else if (gate === 'host') {
    // Only hosts
    ow.push({ id: everyone,  deny:  [VIEW] });
    ow.push({ id: host.id,   allow: [VIEW, SEND] });
  }

  // Always deny @Muted from sending
  if (roles.muted) {
    ow.push({ id: roles.muted.id, deny: [SEND] });
  }

  return ow;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`\nLogged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); }

  console.log(`Setting up: ${guild.name}\n`);

  // 1. Wipe channels
  console.log('[1/5] Clearing channels...');
  for (const [, ch] of await guild.channels.fetch()) {
    try { await ch.delete(); } catch {}
  }

  // 2. Create roles
  console.log('[2/5] Creating roles...');
  for (const def of ROLE_DEFS) {
    const exists = guild.roles.cache.find(r => r.name === def.name);
    if (!exists) {
      await guild.roles.create({ name: def.name, color: def.color, hoist: def.hoist, mentionable: def.mentionable });
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

  // 3. Build channels
  console.log('[3/5] Building channels...');
  const channelMap = {};

  for (const cat of STRUCTURE) {
    const catOw = buildOverwrites(cat.gate, false, roles);

    const category = await guild.channels.create({
      name: cat.name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: catOw,
    });
    console.log(`  ${cat.name}`);

    for (const ch of cat.children) {
      const isVoice = ch.type === 'voice';
      const chOw    = buildOverwrites(ch.gate, ch.readOnly ?? false, roles);

      const channel = await guild.channels.create({
        name:                 ch.name,
        type:                 isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent:               category.id,
        topic:                ch.topic ?? '',
        permissionOverwrites: chOw,
      });

      // Store by clean name for lookup
      const key = ch.name.replace(/[^a-z0-9\-]/gi, '').toLowerCase();
      channelMap[key] = channel;
      console.log(`    ${ch.name}`);
    }
  }

  // 4. Post initial content
  console.log('\n[4/5] Posting initial content...');

  const get = (key) => Object.entries(channelMap).find(([k]) => k.includes(key))?.[1];

  // Rules
  const rulesCh = get('rules');
  if (rulesCh) {
    const m = await rulesCh.send({ embeds: [rulesEmbed()] });
    await m.pin().catch(() => {});
    console.log('  ✓ rules');
  }

  // Verify
  const verifyCh = get('verify');
  if (verifyCh) {
    const m = await verifyCh.send({ embeds: [verifyEmbed()], components: [verifyButton()] });
    await m.pin().catch(() => {});
    console.log('  ✓ verify');
  }

  // Announcements
  const annCh = get('announcements');
  if (annCh) {
    await annCh.send({ embeds: [seasonIntroEmbed()] });
    console.log('  ✓ announcements');
  }

  // Clash schedule
  const schedCh = get('clashschedule');
  if (schedCh) {
    await schedCh.send({ embeds: [clashInfoEmbed()] });
    console.log('  ✓ clash-schedule');
  }

  // Standings
  const standCh = get('standings');
  if (standCh) {
    await standCh.send({ embeds: [standingsEmbed()] });
    console.log('  ✓ standings');
  }

  // 5. Set bot status
  console.log('\n[5/5] Setting bot status...');
  client.user.setPresence({
    activities: [{ name: 'TFT Clash · /clash', type: 0 }],
    status: 'online',
  });

  console.log('\n✅ Server is ready. Run: node index.js\n');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
