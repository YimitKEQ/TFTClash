/**
 * /metrics - log and view channel growth (YouTube, TikTok, Patreon, avg views).
 *
 *   /metrics log yt:1200 tiktok:8400 ...   record today's numbers
 *   /metrics show                          latest snapshot, deltas, and trend
 *
 * Any field left out of /metrics log is carried forward from the last snapshot,
 * so a partial update never looks like a drop to zero.
 *
 * /metrics show draws a unicode sparkline per channel from the stored history,
 * which turns a column of numbers into a shape you can read in one glance.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import { SlashCommandBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';
import {
  BRAND,
  COLOR,
  MARK,
  baseEmbed,
  delta,
  eyebrow,
  spark,
} from '../lib/ui.js';

// The channels tracked, in display order. One list drives the log options, the
// readout, and the trend, so adding a platform is a one-line change.
var CHANNELS = [
  { key: 'yt_subs', option: 'yt', label: 'YouTube', unit: 'subs' },
  { key: 'tiktok_followers', option: 'tiktok', label: 'TikTok', unit: 'followers' },
  { key: 'patreon_subs', option: 'patreon', label: 'Patreon', unit: 'members' },
  { key: 'avg_views', option: 'avgviews', label: 'Avg views', unit: 'per video' },
];

var HISTORY_LIMIT = 14;

function fmt(n) {
  return n == null ? '-' : Number(n).toLocaleString();
}

async function history(limit) {
  var res = await supabase
    .from('bt_metrics_snapshots')
    .select('snapshot_date, yt_subs, tiktok_followers, patreon_subs, avg_views, created_at')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (res.error || !res.data) return [];
  return res.data;
}

// One readout row per channel: value, delta, and the trend shape.
function channelLines(current, previous, series) {
  return CHANNELS.map(function(c) {
    var d = delta(current[c.key], previous ? previous[c.key] : null);
    var trend = series ? spark((series[c.key] || [])) : '';
    return '**' + c.label + '**  ' + fmt(current[c.key]) + ' ' + c.unit
      + (d ? '  ' + MARK.arrow + '  ' + d : '')
      + (trend ? '\n`' + trend + '`' : '');
  }).join('\n');
}

export var data = new SlashCommandBuilder()
  .setName('metrics')
  .setDescription('Log or view channel growth')
  .addSubcommand(function(s) {
    var sub = s.setName('log').setDescription('Record the latest channel numbers');
    CHANNELS.forEach(function(c) {
      sub.addIntegerOption(function(o) {
        return o.setName(c.option).setDescription(c.label + ' ' + c.unit).setMinValue(0);
      });
    });
    return sub.addStringOption(function(o) { return o.setName('notes').setDescription('Optional note').setMaxLength(280); });
  })
  .addSubcommand(function(s) {
    return s.setName('show').setDescription('Show the latest channel metrics and trend');
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  if (sub === 'show') return showCmd(interaction);
  return logCmd(interaction);
}

async function logCmd(interaction) {
  await interaction.deferReply();

  var supplied = {};
  var any = false;
  CHANNELS.forEach(function(c) {
    var v = interaction.options.getInteger(c.option);
    supplied[c.key] = v;
    if (v != null) any = true;
  });
  var notes = interaction.options.getString('notes');

  if (!any) {
    await interaction.editReply('Give at least one number, for example `/metrics log yt:1200 tiktok:8400`.');
    return;
  }

  var rows = await history(1);
  var prev = rows[0] || null;

  var row = { snapshot_date: new Date().toISOString().split('T')[0], notes: notes || '' };
  CHANNELS.forEach(function(c) {
    row[c.key] = supplied[c.key] != null ? supplied[c.key] : (prev && prev[c.key] != null ? prev[c.key] : 0);
  });

  var res = await supabase.from('bt_metrics_snapshots').insert(row).select('*').single();
  if (res.error) {
    await interaction.editReply('Could not save metrics: ' + res.error.message);
    return;
  }

  var embed = baseEmbed({
    color: COLOR.warn,
    author: BRAND.name + '  ' + MARK.arrow + '  metrics',
    title: 'Logged for ' + row.snapshot_date,
    description: channelLines(row, prev, null),
    footer: 'Fields you left out were carried forward from the last snapshot',
  });
  if (notes) embed.addFields({ name: eyebrow('Note'), value: notes });

  await interaction.editReply({ embeds: [embed] });
}

async function showCmd(interaction) {
  await interaction.deferReply();

  var rows = await history(HISTORY_LIMIT);
  if (!rows.length) {
    await interaction.editReply('No metrics logged yet. Use `/metrics log` to start tracking.');
    return;
  }

  var current = rows[0];
  var previous = rows[1] || null;

  // Oldest to newest, so the sparkline reads left to right like a chart.
  var chrono = rows.slice().reverse();
  var series = {};
  CHANNELS.forEach(function(c) {
    series[c.key] = chrono.map(function(r) { return r[c.key] || 0; });
  });

  var embed = baseEmbed({
    color: COLOR.warn,
    author: BRAND.name + '  ' + MARK.arrow + '  metrics',
    title: 'Channel growth',
    description: channelLines(current, previous, series),
    footer: 'As of ' + current.snapshot_date + '  ' + MARK.arrow + '  trend over the last ' + rows.length + ' snapshot(s)',
  });

  await interaction.editReply({ embeds: [embed] });
}
