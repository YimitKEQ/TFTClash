import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PTS } from './data.js';

export const PURPLE = 0x9B72CF;
export const GOLD   = 0xE8A838;
export const TEAL   = 0x4ECDC4;
export const RED    = 0xC0392B;
export const DARK   = 0x111827;

const DIVIDER = '---';

const PLACE_ICONS = ['', '🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

const RANK_ICON = {
  Challenger:  '⚡',
  Grandmaster: '🔥',
  Master:      '💜',
  Diamond:     '💎',
  Platinum:    '🌿',
  Gold:        '⭐',
  Iron:        '🔩',
};

function bar(value, max, len = 12) {
  const filled = Math.min(Math.round((value / Math.max(max, 1)) * len), len);
  return '`' + '█'.repeat(filled) + '░'.repeat(len - filled) + '`';
}

function rankIcon(rank) { return RANK_ICON[rank] ?? '🎮'; }

const SITE_URL = 'https://tft-clash.vercel.app';

// ─── RULES ────────────────────────────────────────────────────────────────────
export function rulesEmbed() {
  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('📜  TFT Clash - Server Rules')
    .setDescription('*Welcome to the official TFT Clash Discord. Read these rules before participating.*')
    .addFields(
      { name: '1 - Respect',      value: 'Treat every player with respect. No harassment, flaming, or targeted toxicity. Keep it competitive, not personal.' },
      { name: '2 - No Spoilers',  value: 'Do not post clash results in public channels before the bot drops the official results embed.' },
      { name: '3 - Fair Play',    value: 'Cheating, ghosting, or intentional stalling = immediate DQ with no appeal. Play to win.' },
      { name: '4 - Disputes',     value: 'All disputes go to a `@Host`. Do not air drama in public channels.' },
      { name: '5 - Self-Promote', value: 'No spamming links, streams, or socials. One clip per session in `#clips` is fine.' },
      { name: '6 - Language',     value: 'Keep main channels in English so everyone can follow. Use DMs for other languages.' },
    )
    .setFooter({ text: 'TFT Clash - Break rules = lose access' })
    .setTimestamp();
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────
export function verifyEmbed() {
  return new EmbedBuilder()
    .setColor(TEAL)
    .setTitle('✅  Verify to enter TFT Clash')
    .setDescription(
      'Click the button below to verify yourself and unlock the full server.\n\n' +
      'Once verified you can:\n' +
      '> 💬 Chat in **#general** and community channels\n' +
      '> 📊 Check **#standings** and **#results**\n' +
      '> 🤖 Use `/profile`, `/standings`, `/clash`\n' +
      '> 🔗 Link your TFT Clash account with `/link`\n\n' +
      '*By verifying you confirm you have read and accepted the rules.*'
    )
    .setFooter({ text: 'TFT Clash - One click to enter' });
}

export function verifyButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify')
      .setLabel('Verify Me')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );
}

// ─── WELCOME ─────────────────────────────────────────────────────────────────
export function welcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('👋  Welcome, ' + member.displayName + '!')
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      'You have joined **TFT Clash** - the weekly competitive TFT platform.\n\n' +
      '**Get started:**\n' +
      '> 1️⃣  Read the rules in #rules\n' +
      '> 2️⃣  Verify yourself in #verify\n' +
      '> 3️⃣  Link your account: `/link account <username>`\n' +
      '> 4️⃣  Register at [tft-clash.vercel.app](' + SITE_URL + ')\n\n' +
      '*Free to compete, always.*'
    )
    .setFooter({ text: 'TFT Clash - Member #' + member.guild.memberCount })
    .setTimestamp();
}

export function welcomeDMEmbed(member) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('⚡  You joined TFT Clash!')
    .setDescription(
      'Hey **' + member.displayName + '** - glad to have you.\n\n' +
      'TFT Clash is a weekly competitive TFT platform with season standings, brackets, and a proper points system.\n\n' +
      '**Quick links:**\n' +
      '> 🌐 Platform: ' + SITE_URL + '\n' +
      '> 📖 Rulebook: EMEA Esports format\n' +
      '> 🏆 Points: 1st=8pts, 8th=1pt\n\n' +
      'See you in the lobby.'
    )
    .setFooter({ text: 'TFT Clash - Free to compete, always.' });
}

// ─── STANDINGS ────────────────────────────────────────────────────────────────
// players: awaited result of getStandings()
// season: awaited result of getSeasonConfig()
export function standingsEmbed(players, season) {
  const maxPts = (players[0] && players[0].pts) || 1;
  const seasonName = (season && season.name) || 'Season 1';
  const currentClash = (season && season.currentClash) || '?';
  const totalClashes = (season && season.totalClashes) || '?';

  const rows = players.map(function(p, i) {
    const icon  = PLACE_ICONS[i + 1] || ('**' + (i + 1) + '.**');
    const rIcon = rankIcon(p.rank);
    const progress = bar(p.pts, maxPts);
    return icon + ' **' + p.name + '** ' + rIcon + ' *' + p.rank + '*\n' + progress + ' **' + p.pts + ' pts** - ' + p.wins + 'W - ' + p.top4 + ' Top4';
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('🏆  ' + seasonName + ' - Season Standings')
    .setDescription(rows || 'No players yet.')
    .addFields({
      name: '\u200b',
      value: '**Clash ' + currentClash + '** of ' + totalClashes + ' completed - Points: 1st=8, 8th=1',
    })
    .setFooter({ text: 'TFT Clash - Updated after every clash' })
    .setTimestamp();
}

// ─── PLAYER PROFILE ───────────────────────────────────────────────────────────
export function profileEmbed(player, standings, season) {
  standings = standings || [];
  const standing  = standings.findIndex(function(p) { return p.name === player.name; }) + 1;
  const maxPts    = (standings[0] && standings[0].pts) || player.pts || 1;
  const color     = (player.rank && { Challenger: GOLD, Grandmaster: PURPLE, Master: PURPLE, Diamond: TEAL, Platinum: 0x3FB68B, Gold: GOLD }[player.rank]) || PURPLE;
  const rIcon     = rankIcon(player.rank);
  const gamesPlayed = player.games || 0;
  const winRate   = gamesPlayed > 0 ? Math.round((player.wins / gamesPlayed) * 100) : 0;
  const top4Rate  = gamesPlayed > 0 ? Math.round((player.top4 / gamesPlayed) * 100) : 0;
  const seasonName = (season && season.name) || 'Season 1';
  const currentClash = (season && season.currentClash) || '?';
  const totalClashes = (season && season.totalClashes) || '?';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'TFT Clash - Player Card' })
    .setTitle(rIcon + '  ' + player.name)
    .addFields(
      { name: '🎖️ Rank',      value: '' + player.rank,                               inline: true },
      { name: '🏅 Standing',  value: '#' + (standing || '?') + ' of ' + standings.length, inline: true },
      { name: '✨ Points',    value: player.pts + ' pts',                              inline: true },
      { name: '🏆 Wins',      value: '' + player.wins,                                 inline: true },
      { name: '🎯 Top 4s',    value: '' + player.top4,                                 inline: true },
      { name: '📊 Win Rate',  value: winRate + '%',                                    inline: true },
    );

  if (player.riotId) {
    embed.addFields({ name: '🎮 Riot ID', value: player.riotId, inline: true });
  }

  embed.addFields({
    name: 'Season Progress',
    value:
      '**Points**   ' + bar(player.pts, maxPts) + ' ' + player.pts + '/' + maxPts + '\n' +
      '**Wins**     ' + bar(player.wins, Math.max(gamesPlayed, 1)) + ' ' + winRate + '%\n' +
      '**Top 4**    ' + bar(player.top4, Math.max(gamesPlayed, 1)) + ' ' + top4Rate + '%',
    inline: false,
  });

  embed
    .setFooter({ text: 'TFT Clash - ' + seasonName + ' - Clash ' + currentClash + '/' + totalClashes })
    .setTimestamp();

  return embed;
}

// ─── NEXT CLASH / CLASH INFO ─────────────────────────────────────────────────
// ts: awaited result of getTournamentState()
// season: awaited result of getSeasonConfig()
// regCount: number of registered players
export function clashInfoEmbed(ts, season, regCount) {
  const clashNum = (ts && ts.clashNumber) || (season && season.currentClash + 1) || '?';
  const phase = (ts && ts.phase) || 'idle';
  const clashDate = (ts && ts.clashDate) || 'TBD';
  const clashTime = (ts && ts.clashTime) || '8:00 PM GMT';
  const format = (ts && ts.format) || 'Standard - 8 per lobby';
  regCount = regCount || 0;

  const phaseLabel = {
    idle: '📋 Registration not yet open',
    registration: '🟢 Registration Open',
    checkin: '🔵 Check-in Active',
    inprogress: '🔴 LIVE - In Progress',
    complete: '✅ Complete',
  }[phase] || phase;

  return new EmbedBuilder()
    .setColor(phase === 'inprogress' ? RED : phase === 'registration' ? TEAL : GOLD)
    .setAuthor({ name: 'TFT Clash - Upcoming Event' })
    .setTitle('⚔️  Clash #' + clashNum + ' - ' + phaseLabel)
    .addFields(
      { name: '📅 Date',       value: '' + clashDate,    inline: true },
      { name: '🕗 Time',       value: '' + clashTime,    inline: true },
      { name: '⚙️ Format',     value: '' + format,       inline: true },
      { name: '👥 Registered', value: '' + regCount + ' players', inline: true },
      { name: '🎟️ Register',   value: '[Click here to register](' + SITE_URL + '/#/clash)', inline: false },
      {
        name: '💡 Points on offer',
        value: Object.entries(PTS).map(function(entry) { return (PLACE_ICONS[entry[0]] || entry[0]) + ' = **' + entry[1] + 'pts**'; }).join('  '),
        inline: false,
      },
    )
    .setFooter({ text: 'TFT Clash - Free to compete, always.' })
    .setTimestamp();
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
export function resultsEmbed(clashNum, placements) {
  const sorted = [].concat(placements).sort(function(a, b) { return a.place - b.place; });
  const winner = sorted[0];

  const podium = sorted.slice(0, 3).map(function(p) {
    const pts = PTS[p.place] || 0;
    return (PLACE_ICONS[p.place] || '') + ' **' + p.name + '** +' + pts + ' pts';
  }).join('\n');

  const rest = sorted.slice(3).map(function(p) {
    const pts = PTS[p.place] || 0;
    return (PLACE_ICONS[p.place] || '') + ' ' + p.name + '  +' + pts + 'pts';
  }).join('\n');

  return new EmbedBuilder()
    .setColor(GOLD)
    .setAuthor({ name: 'TFT Clash - Clash #' + clashNum + ' Results' })
    .setTitle('👑  ' + (winner ? winner.name : '?') + ' wins Clash #' + clashNum + '!')
    .addFields(
      { name: '🏆 Podium',   value: podium || '-',     inline: false },
      { name: '📋 Rest',     value: rest || '-',        inline: false },
      { name: '\u200b',       value: 'Standings updated. Use `/standings` to see the full leaderboard.' },
    )
    .setFooter({ text: 'TFT Clash' })
    .setTimestamp();
}

// ─── REMINDERS ────────────────────────────────────────────────────────────────
export function reminderEmbed(hoursUntil, ts) {
  const urgency = hoursUntil <= 1 ? '🚨' : '⏰';
  const label   = hoursUntil <= 1 ? 'LAST CALL - 1 hour left!' : hoursUntil + ' hours to go';
  const clashNum = (ts && ts.clashNumber) || '?';
  const clashDate = (ts && ts.clashDate) || 'Saturday';
  const clashTime = (ts && ts.clashTime) || '8:00 PM GMT';

  return new EmbedBuilder()
    .setColor(hoursUntil <= 1 ? RED : TEAL)
    .setTitle(urgency + '  Clash #' + clashNum + ' - ' + label)
    .setDescription(
      '**' + clashDate + '** at **' + clashTime + '**\n\n' +
      'Make sure you are registered and ready in time. Late arrivals may be replaced.\n\n' +
      '🔗 [Register / Check In](' + SITE_URL + '/#/clash)'
    )
    .setFooter({ text: 'TFT Clash - See you in the lobby' })
    .setTimestamp();
}

// ─── SEASON INTRO ─────────────────────────────────────────────────────────────
export function seasonIntroEmbed(season) {
  const seasonName = (season && season.name) || 'Season 1';

  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('⚡  ' + seasonName + ' is underway')
    .setDescription(
      'Welcome to **TFT Clash ' + seasonName + '** - the weekly competitive TFT platform.\n\n' +
      '**How it works:**\n' +
      '> 📅 Weekly clashes - register on the platform\n' +
      '> 🏆 Top 4 earns season points (1st=8pts, 8th=1pt)\n' +
      '> 📊 Season leaderboard updated after every clash\n' +
      '> 👑 Season Champion crowned at the end\n\n' +
      '🔗 [tft-clash.vercel.app](' + SITE_URL + ') - Use `/clash` for next event info'
    )
    .setFooter({ text: 'TFT Clash - Free to compete, always.' })
    .setTimestamp();
}

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────
export function countdownEmbed(ts, season) {
  const clashNum = (ts && ts.clashNumber) || '?';
  const clashDate = (ts && ts.clashDate) || 'TBD';
  const clashTime = (ts && ts.clashTime) || '8:00 PM GMT';
  const phase = (ts && ts.phase) || 'idle';

  let status;
  if (phase === 'inprogress') {
    status = '🔴 **LIVE NOW** - Clash is in progress!';
  } else if (phase === 'checkin') {
    status = '🔵 **Check-in is open** - Head to the platform to check in!';
  } else if (phase === 'registration') {
    status = '🟢 **Registration open** - Sign up at [tft-clash.vercel.app](' + SITE_URL + '/#/clash)';
  } else if (phase === 'complete') {
    status = '✅ Clash #' + clashNum + ' is complete. Check `/standings` for updated rankings.';
  } else {
    status = '📋 No active clash. Stay tuned for the next one!';
  }

  return new EmbedBuilder()
    .setColor(phase === 'inprogress' ? RED : phase === 'checkin' ? 0x3498DB : TEAL)
    .setTitle('⏱️  Clash #' + clashNum + ' - Countdown')
    .setDescription(status)
    .addFields(
      { name: '📅 Date', value: '' + clashDate, inline: true },
      { name: '🕗 Time', value: '' + clashTime, inline: true },
    )
    .setFooter({ text: 'TFT Clash' })
    .setTimestamp();
}

// ─── REGISTRATION CONFIRMATION ───────────────────────────────────────────────
export function registrationConfirmEmbed(playerName, clashNum, regCount) {
  return new EmbedBuilder()
    .setColor(TEAL)
    .setTitle('✅  Registered for Clash #' + clashNum)
    .setDescription(
      '**' + playerName + '** is now registered!\n\n' +
      '👥 ' + regCount + ' players registered so far.\n\n' +
      'Make sure to check in when check-in opens. See you in the lobby!'
    )
    .setFooter({ text: 'TFT Clash' })
    .setTimestamp();
}

// ─── LEADERBOARD (compact) ───────────────────────────────────────────────────
export function leaderboardEmbed(players, season) {
  const seasonName = (season && season.name) || 'Season 1';

  const rows = players.slice(0, 20).map(function(p, i) {
    const pos = i + 1;
    const medal = pos <= 3 ? PLACE_ICONS[pos] : ('`' + (pos < 10 ? ' ' : '') + pos + '.`');
    return medal + ' **' + p.name + '** ' + rankIcon(p.rank) + ' - ' + p.pts + ' pts (' + p.wins + 'W)';
  }).join('\n');

  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('📊  ' + seasonName + ' - Full Leaderboard')
    .setDescription(rows || 'No players yet.')
    .setFooter({ text: 'TFT Clash - Top 20 shown' })
    .setTimestamp();
}

// ─── EVENT NOTIFICATIONS (realtime) ──────────────────────────────────────────
export function phaseChangeEmbed(phase, ts) {
  const clashNum = (ts && ts.clashNumber) || '?';
  const labels = {
    registration: { title: '📋 Registration is now OPEN', color: TEAL, desc: 'Clash #' + clashNum + ' registration has opened! Head to [tft-clash.vercel.app](' + SITE_URL + '/#/clash) to sign up.' },
    checkin: { title: '🔵 Check-in is now OPEN', color: 0x3498DB, desc: 'Clash #' + clashNum + ' check-in is live! Make sure to check in or you will lose your spot.' },
    inprogress: { title: '🔴 Clash #' + clashNum + ' is LIVE', color: RED, desc: 'The clash has started! Good luck to all players. May the best player win.' },
    complete: { title: '✅ Clash #' + clashNum + ' is COMPLETE', color: GOLD, desc: 'Results are in! Use `/standings` to see updated rankings.' },
  };

  const info = labels[phase] || { title: 'Tournament Update', color: PURPLE, desc: 'Phase changed to: ' + phase };

  return new EmbedBuilder()
    .setColor(info.color)
    .setTitle(info.title)
    .setDescription(info.desc)
    .setFooter({ text: 'TFT Clash' })
    .setTimestamp();
}

export function newRegistrationEmbed(playerName, regCount, clashNum) {
  return new EmbedBuilder()
    .setColor(TEAL)
    .setDescription('🎟️ **' + playerName + '** registered for Clash #' + clashNum + ' (' + regCount + ' total)')
    .setTimestamp();
}
