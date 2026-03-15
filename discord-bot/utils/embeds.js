import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { SEASON, NEXT_CLASH, RANK_COLORS, PTS } from './data.js';

export const PURPLE = 0x9B72CF;
export const GOLD   = 0xE8A838;
export const TEAL   = 0x4ECDC4;
export const RED    = 0xC0392B;
export const DARK   = 0x111827;

const DIVIDER = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

const PLACE_ICONS = ['', '🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

const RANK_ICON = {
  Challenger:  '⚡',
  Grandmaster: '🔥',
  Master:      '💜',
  Diamond:     '💎',
  Platinum:    '🌿',
  Gold:        '⭐',
};

function bar(value, max, len = 12) {
  const filled = Math.min(Math.round((value / max) * len), len);
  return '`' + '█'.repeat(filled) + '░'.repeat(len - filled) + '`';
}

function rankIcon(rank) { return RANK_ICON[rank] ?? '🎮'; }

// ─── RULES ────────────────────────────────────────────────────────────────────
export function rulesEmbed() {
  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle('📜  TFT Clash — Server Rules')
    .setDescription(`*Welcome to the official TFT Clash Discord. Read these rules before participating.*\n\n${DIVIDER}`)
    .addFields(
      { name: '1 · Respect',      value: 'Treat every player with respect. No harassment, flaming, or targeted toxicity. Keep it competitive, not personal.' },
      { name: '2 · No Spoilers',  value: 'Do not post clash results in public channels before the bot drops the official results embed.' },
      { name: '3 · Fair Play',    value: 'Cheating, ghosting, or intentional stalling = immediate DQ with no appeal. Play to win.' },
      { name: '4 · Disputes',     value: 'All disputes go to a `@Host`. Do not air drama in public channels — it will be ignored and you may be muted.' },
      { name: '5 · Self-Promote', value: 'No spamming links, streams, or socials. One clip per session in `#clips` is fine.' },
      { name: '6 · Language',     value: 'Keep main channels in English so everyone can follow. Use DMs for other languages.' },
      { name: `${DIVIDER}`, value: `**Free to compete, always.** Paid tiers (Pro / Host) unlock platform features — never tournament entry.\n\n🔗 [tft-clash.vercel.app](https://tft-clash.vercel.app)` },
    )
    .setFooter({ text: 'TFT Clash · Break rules = lose access' })
    .setTimestamp();
}

// ─── VERIFY ───────────────────────────────────────────────────────────────────
export function verifyEmbed() {
  return new EmbedBuilder()
    .setColor(TEAL)
    .setTitle('✅  Verify to enter TFT Clash')
    .setDescription(
      `Click the button below to verify yourself and unlock the full server.\n\n` +
      `Once verified you can:\n` +
      `> 💬 Chat in **#general** and community channels\n` +
      `> 📊 Check **#standings** and **#results**\n` +
      `> 🤖 Use \`/profile\`, \`/standings\`, \`/clash\`\n` +
      `> 🔗 Link your TFT Clash account with \`/link\`\n\n` +
      `${DIVIDER}\n*By verifying you confirm you've read and accepted the rules.*`
    )
    .setFooter({ text: 'TFT Clash · One click to enter' });
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
    .setTitle(`👋  Welcome, ${member.displayName}!`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(
      `You've joined **TFT Clash** — the weekly competitive TFT platform for the community.\n\n` +
      `${DIVIDER}\n` +
      `**Get started:**\n` +
      `> 1️⃣  Read the rules in <#RULES_ID>\n` +
      `> 2️⃣  Verify yourself in <#VERIFY_ID>\n` +
      `> 3️⃣  Link your account: \`/link account <username>\`\n` +
      `> 4️⃣  Register for the next clash at [tft-clash.vercel.app](https://tft-clash.vercel.app)\n\n` +
      `${DIVIDER}\n*Free to compete, always.*`
    )
    .setFooter({ text: `TFT Clash · Member #${member.guild.memberCount}` })
    .setTimestamp();
}

export function welcomeDMEmbed(member) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('⚡  You joined TFT Clash!')
    .setDescription(
      `Hey **${member.displayName}** — glad to have you.\n\n` +
      `TFT Clash is a weekly competitive TFT platform with season standings, brackets, and a proper points system.\n\n` +
      `**Quick links:**\n` +
      `> 🌐 Platform: https://tft-clash.vercel.app\n` +
      `> 📖 Rulebook: EMEA Esports format\n` +
      `> 🏆 Points: 1st=8pts → 8th=1pt\n\n` +
      `See you in the lobby.`
    )
    .setFooter({ text: 'TFT Clash — Free to compete, always.' });
}

// ─── STANDINGS ────────────────────────────────────────────────────────────────
// players: awaited result of getStandings()
export function standingsEmbed(players) {
  const maxPts  = players[0]?.pts ?? 1;

  const rows = players.map((p, i) => {
    const icon  = PLACE_ICONS[i + 1] ?? `**${i + 1}.**`;
    const rIcon = rankIcon(p.rank);
    const progress = bar(p.pts, maxPts);
    return `${icon} **${p.name}** ${rIcon} *${p.rank}*\n${progress} **${p.pts} pts** · ${p.wins}W · ${p.top4} Top4`;
  }).join('\n\n');

  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle(`🏆  ${SEASON.name} — Season Standings`)
    .setDescription(rows)
    .addFields({
      name: DIVIDER,
      value: `**Clash ${SEASON.currentClash}** of ${SEASON.totalClashes} completed · Points: 1st=8 → 8th=1`,
    })
    .setFooter({ text: 'TFT Clash · Updated after every clash' })
    .setTimestamp();
}

// ─── PLAYER PROFILE ───────────────────────────────────────────────────────────
export function profileEmbed(player) {
  const standings = getStandings();
  const standing  = standings.findIndex(p => p.name === player.name) + 1;
  const maxPts    = standings[0]?.pts ?? 1;
  const color     = RANK_COLORS[player.rank] ?? PURPLE;
  const rIcon     = rankIcon(player.rank);
  const winRate   = Math.round((player.wins / SEASON.currentClash) * 100);
  const top4Rate  = Math.round((player.top4 / SEASON.currentClash) * 100);

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: 'TFT Clash · Player Card' })
    .setTitle(`${rIcon}  ${player.name}`)
    .setDescription(`${DIVIDER}`)
    .addFields(
      { name: '🎖️ Rank',      value: `${player.rank}`,                          inline: true },
      { name: '🏅 Standing',  value: `#${standing} of ${standings.length}`,     inline: true },
      { name: '✨ Points',    value: `${player.pts} pts`,                        inline: true },
      { name: '🏆 Wins',      value: `${player.wins}`,                           inline: true },
      { name: '🎯 Top 4s',    value: `${player.top4}`,                           inline: true },
      { name: '📊 Win Rate',  value: `${winRate}%`,                              inline: true },
      {
        name: 'Season Progress',
        value:
          `**Points**   ${bar(player.pts, maxPts)} ${player.pts}/${maxPts}\n` +
          `**Wins**     ${bar(player.wins, SEASON.currentClash)} ${winRate}%\n` +
          `**Top 4**    ${bar(player.top4, SEASON.currentClash)} ${top4Rate}%`,
        inline: false,
      },
    )
    .setFooter({ text: `TFT Clash · ${SEASON.name} · Clash ${SEASON.currentClash}/${SEASON.totalClashes}` })
    .setTimestamp();
}

// ─── NEXT CLASH ───────────────────────────────────────────────────────────────
export function clashInfoEmbed() {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setAuthor({ name: 'TFT Clash · Upcoming Event' })
    .setTitle(`⚔️  Clash #${NEXT_CLASH.number} — Registration Open`)
    .setDescription(`${DIVIDER}`)
    .addFields(
      { name: '📅 Date',       value: NEXT_CLASH.date,     inline: true },
      { name: '🕗 Time',       value: NEXT_CLASH.time,     inline: true },
      { name: '⚙️ Format',     value: NEXT_CLASH.format,   inline: true },
      { name: '🎟️ Register',   value: `[Click here to register](${NEXT_CLASH.registrationUrl})`, inline: false },
      {
        name: '💡 Points on offer',
        value: Object.entries(PTS).map(([place, pts]) => `${PLACE_ICONS[place]} = **${pts}pts**`).join('  '),
        inline: false,
      },
    )
    .setFooter({ text: 'TFT Clash · Free to compete, always.' })
    .setTimestamp();
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
export function resultsEmbed(clashNum, placements) {
  const sorted = [...placements].sort((a, b) => a.place - b.place);
  const winner = sorted[0];

  const podium = sorted.slice(0, 3).map(p => {
    const pts = PTS[p.place] ?? 0;
    return `${PLACE_ICONS[p.place]} **${p.name}** +${pts} pts`;
  }).join('\n');

  const rest = sorted.slice(3).map(p => {
    const pts = PTS[p.place] ?? 0;
    return `${PLACE_ICONS[p.place]} ${p.name}  +${pts}pts`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(GOLD)
    .setAuthor({ name: `TFT Clash · Clash #${clashNum} Results` })
    .setTitle(`👑  ${winner?.name} wins Clash #${clashNum}!`)
    .setDescription(`${DIVIDER}`)
    .addFields(
      { name: '🏆 Podium',   value: podium,          inline: false },
      { name: '📋 Rest',     value: rest || '—',     inline: false },
      { name: DIVIDER,       value: `Standings updated. Use \`/standings\` to see the full leaderboard.` },
    )
    .setFooter({ text: `TFT Clash · ${SEASON.name}` })
    .setTimestamp();
}

// ─── REMINDERS ────────────────────────────────────────────────────────────────
export function reminderEmbed(hoursUntil) {
  const urgency = hoursUntil <= 1 ? '🚨' : '⏰';
  const label   = hoursUntil <= 1 ? 'LAST CALL — 1 hour left!' : `${hoursUntil} hours to go`;

  return new EmbedBuilder()
    .setColor(hoursUntil <= 1 ? RED : TEAL)
    .setTitle(`${urgency}  Clash #${NEXT_CLASH.number} — ${label}`)
    .setDescription(
      `**${NEXT_CLASH.date}** at **${NEXT_CLASH.time}**\n\n` +
      `${DIVIDER}\n` +
      `Make sure you're registered and ready in time. Late arrivals may be replaced.\n\n` +
      `🔗 [Register / Check In](${NEXT_CLASH.registrationUrl})`
    )
    .setFooter({ text: 'TFT Clash · See you in the lobby' })
    .setTimestamp();
}

// ─── SEASON INTRO ─────────────────────────────────────────────────────────────
export function seasonIntroEmbed() {
  return new EmbedBuilder()
    .setColor(PURPLE)
    .setTitle(`⚡  ${SEASON.name} is underway`)
    .setDescription(
      `Welcome to **TFT Clash ${SEASON.name}** — the weekly competitive TFT platform.\n\n` +
      `${DIVIDER}\n` +
      `**How it works:**\n` +
      `> 📅 Weekly clashes — register on the platform\n` +
      `> 🏆 Top 4 earns season points (1st=8pts → 8th=1pt)\n` +
      `> 📊 Season leaderboard updated after every clash\n` +
      `> 👑 Season Champion crowned at the end\n\n` +
      `${DIVIDER}\n` +
      `🔗 [tft-clash.vercel.app](https://tft-clash.vercel.app) · Use \`/clash\` for next event info`
    )
    .setFooter({ text: 'TFT Clash · Free to compete, always.' })
    .setTimestamp();
}
