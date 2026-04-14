import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getTournamentState, getStandings, getTournamentIdByClashNumber } from '../utils/data.js';
import { supabase } from '../utils/supabase.js';

var GOLD = 0xFFCE78;

export var data = new SlashCommandBuilder()
  .setName('tournament')
  .setDescription('Show the current TFT Clash tournament summary')
  .addIntegerOption(function(option) {
    return option
      .setName('clash')
      .setDescription('Clash number (defaults to current)')
      .setRequired(false)
      .setMinValue(1);
  });

export async function execute(interaction) {
  await interaction.deferReply();

  var ts = await getTournamentState();
  var requested = interaction.options.getInteger('clash');
  var clashNumber = requested || (ts && ts.clashNumber) || null;

  if (!clashNumber) {
    return interaction.editReply('No tournament data available.');
  }

  // Resolve tournament_id: use ts.dbTournamentId for the current clash, look up by name otherwise.
  var tournamentId = (!requested && ts && ts.dbTournamentId)
    ? ts.dbTournamentId
    : await getTournamentIdByClashNumber(clashNumber);

  var regs = [];
  if (tournamentId) {
    var regRes = await supabase
      .from('registrations')
      .select('status')
      .eq('tournament_id', tournamentId);
    regs = regRes.data || [];
  }
  var total = regs.length;
  var checkedIn = regs.filter(function(r) { return r.status === 'checked_in'; }).length;

  // Top 5 by season points from the shared helper.
  var topPlayers = await getStandings(5);
  var topLines = topPlayers
    .map(function(p, i) {
      var rank = i + 1;
      return '`#' + rank + '` **' + p.name + '** - ' + (p.pts || 0) + ' pts';
    })
    .join('\n');

  var phase;
  if (requested) {
    phase = 'Historical';
  } else {
    phase = (ts && ts.phase) ? ts.phase : 'idle';
  }

  var embed = new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('TFT Clash #' + clashNumber)
    .setDescription('Phase: **' + phase + '**')
    .addFields(
      { name: 'Registered', value: String(total), inline: true },
      { name: 'Checked in', value: String(checkedIn), inline: true },
    );

  if (topLines) {
    embed.addFields({ name: 'Current top 5', value: topLines });
  }

  embed.setFooter({ text: 'Use /standings for full leaderboard' });
  embed.setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
