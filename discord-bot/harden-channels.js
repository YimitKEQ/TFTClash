/**
 * harden-channels.js -- Non-destructive channel hardening for the TFT Clash server.
 *
 * Run: node harden-channels.js
 *
 * What it does:
 *   1. Re-applies correct permission overwrites to every known channel
 *      (locks down read-only channels so @Player cannot type in announcements,
 *      results, standings, schedule, bracket, etc.)
 *   2. Creates a "HELP & FEEDBACK" category with how-to-clash, faq,
 *      feedback (forum), and bug-reports (forum) if they do not exist.
 *   3. Posts pinned guide embeds in info channels. Idempotent -- if the bot
 *      already pinned a guide there, it skips.
 *
 * What it does NOT do:
 *   - Delete channels
 *   - Delete or recreate roles
 *   - Wipe message history
 *
 * Safe to run multiple times.
 */

import {
  Client, GatewayIntentBits, PermissionFlagsBits, ChannelType,
  EmbedBuilder,
} from 'discord.js';
import 'dotenv/config';

var SEND          = PermissionFlagsBits.SendMessages;
var VIEW          = PermissionFlagsBits.ViewChannel;
var ADD_REACTIONS = PermissionFlagsBits.AddReactions;
var ATTACH_FILES  = PermissionFlagsBits.AttachFiles;
var EMBED_LINKS   = PermissionFlagsBits.EmbedLinks;
var READ_HISTORY  = PermissionFlagsBits.ReadMessageHistory;
var CREATE_THREAD = PermissionFlagsBits.CreatePublicThreads;
var SEND_THREAD   = PermissionFlagsBits.SendMessagesInThreads;

var CHAT_ALLOW = [SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY];
var FORUM_ALLOW = [VIEW, READ_HISTORY, CREATE_THREAD, SEND_THREAD, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS];

var PURPLE = 0x9B72CF;
var GOLD   = 0xE8A838;
var TEAL   = 0x4ECDC4;
var RED    = 0xC0392B;

// ─── Channel rule book ────────────────────────────────────────────────────────
// Each rule: a substring matched against channel name (case-insensitive),
// the gate it should sit behind, and whether it is read-only.
var CHANNEL_RULES = [
  // WELCOME (public, mostly read-only)
  { match: 'announcements',  gate: 'public',   readOnly: true  },
  { match: 'rules',          gate: 'public',   readOnly: true  },
  { match: 'verify',         gate: 'public',   readOnly: true  },

  // CLASH HQ (verified, read-only -- only host posts)
  { match: 'clash-schedule', gate: 'verified', readOnly: true  },
  { match: 'results',        gate: 'verified', readOnly: true  },
  { match: 'standings',      gate: 'verified', readOnly: true  },
  { match: 'bracket',        gate: 'verified', readOnly: true  },

  // COMMUNITY (verified, can chat)
  { match: 'general',        gate: 'verified', readOnly: false },
  { match: 'lfg',            gate: 'verified', readOnly: false },
  { match: 'clips',          gate: 'verified', readOnly: false },
  { match: 'meta-talk',      gate: 'verified', readOnly: false },
  { match: 'bot-commands',   gate: 'verified', readOnly: false },

  // HELP & FEEDBACK (verified, mixed)
  { match: 'how-to-clash',   gate: 'verified', readOnly: true  },
  { match: 'faq',            gate: 'verified', readOnly: true  },
  { match: 'feedback',       gate: 'verified', readOnly: false, kind: 'forum' },
  { match: 'bug-reports',    gate: 'verified', readOnly: false, kind: 'forum' },

  // ADMIN (host only)
  { match: 'bot-logs',       gate: 'host',     readOnly: false },
  { match: 'host-dashboard', gate: 'host',     readOnly: false },
  { match: 'dev',            gate: 'host',     readOnly: false },
];

// Channels we want to create if they do not exist
var TO_CREATE = [
  {
    category: '── HELP & FEEDBACK ──',
    children: [
      { name: '📖・how-to-clash', kind: 'text',  gate: 'verified', readOnly: true,  topic: 'Step-by-step guide on how a TFT Clash works.' },
      { name: '❓・faq',          kind: 'text',  gate: 'verified', readOnly: true,  topic: 'Frequently asked questions. Read before pinging a host.' },
      { name: '💡・feedback',     kind: 'forum', gate: 'verified', readOnly: false, topic: 'Suggestions, ideas, feature requests. One thread per idea.' },
      { name: '🐛・bug-reports',  kind: 'forum', gate: 'verified', readOnly: false, topic: 'Site or bot bug? Open a thread with steps to reproduce.' },
    ],
  },
];

// ─── Permission builder ───────────────────────────────────────────────────────
function buildOverwrites(gate, readOnly, isForum, roles) {
  var everyone = roles.everyone;
  var player = roles.player;
  var host = roles.host;
  var muted = roles.muted;

  var ow = [];

  if (gate === 'public') {
    if (readOnly) {
      ow.push({ id: everyone, deny: [SEND, ADD_REACTIONS] });
      if (host) {
        ow.push({ id: host.id, allow: [VIEW, SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY] });
      }
    }
    // public + writable: leave defaults (everyone can chat)
  } else if (gate === 'verified') {
    ow.push({ id: everyone, deny: [VIEW] });
    if (isForum) {
      // Forum: Player can browse, create threads, post inside their own threads
      if (player) ow.push({ id: player.id, allow: FORUM_ALLOW });
      if (host)   ow.push({ id: host.id,   allow: FORUM_ALLOW.concat([SEND]) });
    } else if (readOnly) {
      // Read-only text: Player can view + react but not send
      if (player) ow.push({ id: player.id, allow: [VIEW, ADD_REACTIONS, READ_HISTORY], deny: [SEND] });
      if (host)   ow.push({ id: host.id,   allow: [VIEW, SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY] });
    } else {
      // Community chat: Player + Host can chat freely
      if (player) ow.push({ id: player.id, allow: [VIEW].concat(CHAT_ALLOW) });
      if (host)   ow.push({ id: host.id,   allow: [VIEW].concat(CHAT_ALLOW) });
    }
  } else if (gate === 'host') {
    ow.push({ id: everyone, deny: [VIEW] });
    if (player) ow.push({ id: player.id, deny: [VIEW] });
    if (host)   ow.push({ id: host.id,   allow: [VIEW, SEND, ADD_REACTIONS, ATTACH_FILES, EMBED_LINKS, READ_HISTORY] });
  }

  if (muted) {
    ow.push({ id: muted.id, deny: [SEND, ADD_REACTIONS, SEND_THREAD] });
  }

  return ow;
}

// ─── Guide embeds ─────────────────────────────────────────────────────────────
function howToClashEmbed() {
  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('📖  How a TFT Clash Works')
    .setDescription('*A step-by-step walkthrough from registration to results.*')
    .addFields(
      {
        name: '1 ・ Register',
        value: 'When a clash opens, head to **tft-clash.vercel.app** and click Register on the active clash card. Free to compete, always.',
      },
      {
        name: '2 ・ Check in',
        value: 'About 30 minutes before the clash, **check-in** opens. Hit the Check In button on the platform or you lose your spot.',
      },
      {
        name: '3 ・ Find your lobby',
        value: 'Once the clash starts, the bot drops a `#bracket` post and a private lobby channel for each group. Use `/lobby` in DMs to see your lobby and opponents.',
      },
      {
        name: '4 ・ Play the round',
        value: 'Queue a Normal TFT game with your lobby mates. Stage 2-1 starts the round officially. Only the configured patch counts.',
      },
      {
        name: '5 ・ Submit your placement',
        value: 'After the game ends, run `/submit placement:<1-8>` here in Discord (or on the platform). Hosts approve placements before they hit standings.',
      },
      {
        name: '6 ・ Disputes',
        value: 'Wrong placement? Use `/dispute reason:"..."` immediately. Do **not** rage in `#general` -- a host will pick it up.',
      },
      {
        name: '7 ・ Points & standings',
        value: '1st = 8pts, 2nd = 7, 3rd = 6 ... 8th = 1pt. The bot updates `#standings` automatically once all games are settled.',
      },
    )
    .setFooter({ text: 'TFT Clash ・ /clash for the next event' })
    .setTimestamp();
}

function faqEmbed() {
  return new EmbedBuilder()
    .setColor(TEAL)
    .setTitle('❓  Frequently Asked Questions')
    .addFields(
      {
        name: 'Is it free?',
        value: 'Yes. Competing in clashes is **always** free. Pro and Host tiers add cosmetic / tooling perks but nothing gates the actual competition.',
      },
      {
        name: 'How do I link my Discord to my TFT Clash account?',
        value: 'Run `/link account username:<your-platform-name>` here. Once linked, role sync is automatic when your rank or tier changes.',
      },
      {
        name: 'How do I see who I am playing against?',
        value: 'Run `/lobby`. The bot DMs you your lobby number and the names of the other players.',
      },
      {
        name: 'I missed check-in. Can I still play?',
        value: 'No. Check-in exists so we know who is actually showing up. Late = replaced by an alternate. Be on time.',
      },
      {
        name: 'Where do I report a bug?',
        value: 'Open a thread in `#🐛・bug-reports`. Include: what you tried, what happened, what you expected, screenshots if possible.',
      },
      {
        name: 'I have a feature idea!',
        value: 'Open a thread in `#💡・feedback`. The hosts read every one.',
      },
      {
        name: 'How do tiers work?',
        value: 'Player (free) -- compete in everything. Pro (€4.99/mo) -- profile flair, advanced stats. Host (€19.99/mo) -- run your own branded tournaments.',
      },
      {
        name: 'How do I become a Host?',
        value: 'Apply at **tft-clash.vercel.app/host/apply**. We onboard hosts personally so we can vouch for tournament quality.',
      },
    )
    .setFooter({ text: 'TFT Clash ・ Still stuck? Ping a @Host' })
    .setTimestamp();
}

function feedbackGuideEmbed() {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('💡  Feedback & Feature Requests')
    .setDescription(
      'This forum is for **ideas, suggestions, and feature requests** for the TFT Clash platform and Discord bot.\n\n' +
      '**How to post a good suggestion:**\n' +
      '> 1️⃣  **One idea per thread.** Keep it focused.\n' +
      '> 2️⃣  **Title:** short and clear. Example: *"Add solo queue alongside lobbies"*\n' +
      '> 3️⃣  **Body:** describe the problem, then your proposed fix. *Why* it would help.\n' +
      '> 4️⃣  **React with 👍** on threads you support so we can prioritise.\n\n' +
      '**Bug reports go in `#🐛・bug-reports` instead.**\n\n' +
      'The hosts read every thread. If something gets shipped, the thread will be tagged accordingly.'
    )
    .setFooter({ text: 'TFT Clash ・ Built by the community' })
    .setTimestamp();
}

function bugReportGuideEmbed() {
  return new EmbedBuilder()
    .setColor(RED)
    .setTitle('🐛  Bug Reports')
    .setDescription(
      'Found a bug on the site or in the Discord bot? Open a thread here.\n\n' +
      '**A good bug report has:**\n' +
      '> 🪧  **Title:** one-liner. Example: *"Standings page crashes on Firefox"*\n' +
      '> 🔁  **Steps to reproduce:** numbered, exact clicks.\n' +
      '> 🎯  **What you expected** to happen.\n' +
      '> 💥  **What actually happened.**\n' +
      '> 🖼️  **Screenshot or screen recording** if possible.\n' +
      '> 🌐  **Browser / device** (Chrome on Windows, Safari on iPhone, etc.)\n\n' +
      '**Severity tag** -- mention one in your thread:\n' +
      '> 🔴  **Critical** -- cannot use the site at all\n' +
      '> 🟠  **High** -- a feature is broken\n' +
      '> 🟡  **Medium** -- annoying but workable\n' +
      '> 🟢  **Low** -- cosmetic or minor\n\n' +
      'Feature requests go in `#💡・feedback` instead.'
    )
    .setFooter({ text: 'TFT Clash ・ We fix what gets reported' })
    .setTimestamp();
}

function botCommandsGuideEmbed() {
  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('🤖  Bot Commands Cheat Sheet')
    .setDescription('*All slash commands available in TFT Clash. Type `/` to see them.*')
    .addFields(
      {
        name: '🎮 Clash flow',
        value:
          '`/clash` -- next event info\n' +
          '`/countdown` -- time until next clash\n' +
          '`/register` -- register for the active clash\n' +
          '`/checkin` -- check in when check-in opens\n' +
          '`/lobby` -- see your lobby + opponents\n' +
          '`/submit placement:<1-8>` -- submit your result\n' +
          '`/dispute reason:"..."` -- file a dispute',
      },
      {
        name: '📊 Stats & profile',
        value:
          '`/profile [user]` -- your player card\n' +
          '`/standings` -- season top 10\n' +
          '`/leaderboard` -- full top 20\n' +
          '`/top` -- season top 3 highlight\n' +
          '`/stats` -- your detailed stats\n' +
          '`/compare <user>` -- head-to-head comparison',
      },
      {
        name: '🔗 Account',
        value:
          '`/link account username:<name>` -- link your TFT Clash profile\n' +
          '`/tournament` -- current tournament summary\n' +
          '`/hype` -- random TFT tip',
      },
    )
    .setFooter({ text: 'TFT Clash ・ Use them anywhere except admin channels' })
    .setTimestamp();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function findRule(channelName) {
  var lower = channelName.toLowerCase();
  for (var i = 0; i < CHANNEL_RULES.length; i++) {
    if (lower.indexOf(CHANNEL_RULES[i].match) !== -1) return CHANNEL_RULES[i];
  }
  return null;
}

async function alreadyPinnedByBot(channel, embedTitle, botId) {
  try {
    var pins = await channel.messages.fetchPinned();
    return pins.some(function(m) {
      if (m.author.id !== botId) return false;
      if (!m.embeds || !m.embeds.length) return false;
      return m.embeds.some(function(e) { return e.title === embedTitle; });
    });
  } catch (err) {
    return false;
  }
}

async function postPinnedGuide(channel, embed, botId) {
  if (!channel) return false;
  var already = await alreadyPinnedByBot(channel, embed.data.title, botId);
  if (already) {
    console.log('  · ' + channel.name + ' guide already pinned, skipping');
    return false;
  }
  try {
    var msg = await channel.send({ embeds: [embed] });
    await msg.pin().catch(function() {});
    console.log('  ✓ pinned guide in #' + channel.name);
    return true;
  } catch (err) {
    console.error('  ✗ failed to post guide in #' + channel.name + ':', err.message);
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
var client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once('ready', async function() {
  console.log('\nLogged in as ' + client.user.tag);
  var guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) {
    console.error('Guild not found. Check GUILD_ID in .env');
    process.exit(1);
  }

  console.log('Hardening: ' + guild.name + '\n');

  await guild.roles.fetch();
  await guild.channels.fetch();

  var roles = {
    everyone: guild.roles.everyone.id,
    player:   guild.roles.cache.find(function(r) { return r.name === 'Player'; }),
    host:     guild.roles.cache.find(function(r) { return r.name === 'Host'; }),
    muted:    guild.roles.cache.find(function(r) { return r.name === 'Muted'; }),
  };

  if (!roles.player || !roles.host) {
    console.error('Missing required roles (Player or Host). Run `node setup.js` first or create them manually.');
    process.exit(1);
  }

  // 1. Re-apply permissions to every existing channel that matches a rule
  console.log('[1/3] Re-applying permissions to existing channels...');
  var fixed = 0;
  var skipped = 0;
  for (var pair of guild.channels.cache) {
    var ch = pair[1];
    if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildForum) continue;
    var rule = findRule(ch.name);
    if (!rule) {
      console.log('  · ' + ch.name + ' -- no rule, leaving untouched');
      skipped++;
      continue;
    }
    var isForum = ch.type === ChannelType.GuildForum;
    var ow = buildOverwrites(rule.gate, rule.readOnly, isForum, roles);
    try {
      await ch.permissionOverwrites.set(ow);
      console.log('  ✓ ' + ch.name + ' -> ' + rule.gate + (rule.readOnly ? ' (read-only)' : '') + (isForum ? ' (forum)' : ''));
      fixed++;
    } catch (err) {
      console.error('  ✗ ' + ch.name + ' failed:', err.message);
    }
  }
  console.log('  Fixed ' + fixed + ' channels, skipped ' + skipped + '.\n');

  // 2. Create missing categories and channels
  console.log('[2/3] Ensuring HELP & FEEDBACK category exists...');
  for (var group of TO_CREATE) {
    var category = guild.channels.cache.find(function(c) {
      return c.type === ChannelType.GuildCategory && c.name === group.category;
    });
    if (!category) {
      // Hide category from everyone by default; channels override per-rule
      var catOw = buildOverwrites('verified', false, false, roles);
      category = await guild.channels.create({
        name: group.category,
        type: ChannelType.GuildCategory,
        permissionOverwrites: catOw,
      });
      console.log('  + created category ' + group.category);
    } else {
      console.log('  · category exists: ' + group.category);
    }

    for (var def of group.children) {
      var existing = guild.channels.cache.find(function(c) {
        return (c.type === ChannelType.GuildText || c.type === ChannelType.GuildForum) && c.name === def.name;
      });
      if (existing) {
        console.log('    · channel exists: ' + def.name);
        continue;
      }
      var isForum = def.kind === 'forum';
      var ow = buildOverwrites(def.gate, def.readOnly, isForum, roles);
      try {
        var newCh = await guild.channels.create({
          name: def.name,
          type: isForum ? ChannelType.GuildForum : ChannelType.GuildText,
          parent: category.id,
          topic: def.topic || '',
          permissionOverwrites: ow,
        });
        console.log('    + created ' + (isForum ? 'forum' : 'text') + ' channel ' + def.name);
        // Re-fetch so subsequent guide-posting can find it
        guild.channels.cache.set(newCh.id, newCh);
      } catch (err) {
        console.error('    ✗ failed to create ' + def.name + ':', err.message);
      }
    }
  }
  console.log('');

  // 3. Post pinned guides (idempotent)
  console.log('[3/3] Posting pinned guides...');
  await guild.channels.fetch();

  function findCh(substr) {
    return guild.channels.cache.find(function(c) {
      return (c.type === ChannelType.GuildText || c.type === ChannelType.GuildForum) && c.name.toLowerCase().indexOf(substr) !== -1;
    });
  }

  await postPinnedGuide(findCh('how-to-clash'), howToClashEmbed(), client.user.id);
  await postPinnedGuide(findCh('faq'),          faqEmbed(),          client.user.id);
  await postPinnedGuide(findCh('bot-commands'), botCommandsGuideEmbed(), client.user.id);

  // Forum channels: pin a guide post (a thread) at the top
  var feedbackCh = findCh('feedback');
  if (feedbackCh && feedbackCh.type === ChannelType.GuildForum) {
    var hasGuideThread = false;
    try {
      var threads = await feedbackCh.threads.fetchActive();
      hasGuideThread = threads.threads.some(function(t) { return t.name === 'How to give good feedback'; });
    } catch (err) { /* ignore */ }
    if (!hasGuideThread) {
      try {
        await feedbackCh.threads.create({
          name: 'How to give good feedback',
          message: { embeds: [feedbackGuideEmbed()] },
        });
        console.log('  ✓ created guide thread in #' + feedbackCh.name);
      } catch (err) {
        console.error('  ✗ failed to create feedback guide thread:', err.message);
      }
    } else {
      console.log('  · feedback guide thread already exists');
    }
  }

  var bugCh = findCh('bug-reports');
  if (bugCh && bugCh.type === ChannelType.GuildForum) {
    var hasBugGuide = false;
    try {
      var bugThreads = await bugCh.threads.fetchActive();
      hasBugGuide = bugThreads.threads.some(function(t) { return t.name === 'How to file a good bug report'; });
    } catch (err) { /* ignore */ }
    if (!hasBugGuide) {
      try {
        await bugCh.threads.create({
          name: 'How to file a good bug report',
          message: { embeds: [bugReportGuideEmbed()] },
        });
        console.log('  ✓ created guide thread in #' + bugCh.name);
      } catch (err) {
        console.error('  ✗ failed to create bug guide thread:', err.message);
      }
    } else {
      console.log('  · bug-reports guide thread already exists');
    }
  }

  console.log('\n✅ Hardening complete.');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
