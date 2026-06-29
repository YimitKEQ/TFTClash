/**
 * /metrics - log and view BrosephTech channel growth (YouTube, TikTok, Patreon,
 * average views). Snapshots feed the dashboard's "Channel metrics" section and
 * its sparkline trend.
 *
 *   /metrics log yt:1200 tiktok:8400 ...   record today's numbers
 *   /metrics show                          show the latest snapshot + deltas
 *
 * Any field you leave out of /metrics log is carried forward from the last
 * snapshot, so a partial update never looks like a drop to zero.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { supabase } from '../lib/supabase.js';

function fmt(n) { return n == null ? '-' : Number(n).toLocaleString(); }
function deltaStr(cur, prev) {
  if (cur == null || prev == null) return '';
  var d = cur - prev;
  if (d === 0) return '  (no change)';
  return '  (' + (d > 0 ? '+' : '') + d.toLocaleString() + ')';
}

async function latestSnapshot() {
  var res = await supabase
    .from('bt_metrics_snapshots')
    .select('snapshot_date, yt_subs, tiktok_followers, patreon_subs, avg_views, created_at')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (res.error || !res.data || !res.data.length) return null;
  return res.data[0];
}

export var data = new SlashCommandBuilder()
  .setName('metrics')
  .setDescription('Log or view BrosephTech channel growth')
  .addSubcommand(function(s) {
    return s.setName('log').setDescription('Record the latest channel numbers')
      .addIntegerOption(function(o) { return o.setName('yt').setDescription('YouTube subscribers').setMinValue(0); })
      .addIntegerOption(function(o) { return o.setName('tiktok').setDescription('TikTok followers').setMinValue(0); })
      .addIntegerOption(function(o) { return o.setName('patreon').setDescription('Patreon members').setMinValue(0); })
      .addIntegerOption(function(o) { return o.setName('avgviews').setDescription('Average views per video').setMinValue(0); })
      .addStringOption(function(o) { return o.setName('notes').setDescription('Optional note').setMaxLength(280); });
  })
  .addSubcommand(function(s) {
    return s.setName('show').setDescription('Show the latest channel metrics');
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  if (sub === 'show') return showCmd(interaction);
  return logCmd(interaction);
}

async function logCmd(interaction) {
  await interaction.deferReply();

  var yt = interaction.options.getInteger('yt');
  var tiktok = interaction.options.getInteger('tiktok');
  var patreon = interaction.options.getInteger('patreon');
  var avgviews = interaction.options.getInteger('avgviews');
  var notes = interaction.options.getString('notes');

  if (yt == null && tiktok == null && patreon == null && avgviews == null) {
    await interaction.editReply('Give at least one number, e.g. `/metrics log yt:1200 tiktok:8400`.');
    return;
  }

  var prev = await latestSnapshot();
  var pick = function(v, k) { return v != null ? v : (prev && prev[k] != null ? prev[k] : 0); };

  var row = {
    snapshot_date: new Date().toISOString().split('T')[0],
    yt_subs: pick(yt, 'yt_subs'),
    tiktok_followers: pick(tiktok, 'tiktok_followers'),
    patreon_subs: pick(patreon, 'patreon_subs'),
    avg_views: pick(avgviews, 'avg_views'),
    notes: notes || '',
  };

  var res = await supabase.from('bt_metrics_snapshots').insert(row).select('*').single();
  if (res.error) {
    await interaction.editReply('Could not save metrics: ' + res.error.message);
    return;
  }

  var embed = new EmbedBuilder()
    .setColor(0xE8A020)
    .setTitle('Metrics logged')
    .setDescription(
      'YouTube **' + fmt(row.yt_subs) + '**' + deltaStr(row.yt_subs, prev && prev.yt_subs) + '\n' +
      'TikTok **' + fmt(row.tiktok_followers) + '**' + deltaStr(row.tiktok_followers, prev && prev.tiktok_followers) + '\n' +
      'Patreon **' + fmt(row.patreon_subs) + '**' + deltaStr(row.patreon_subs, prev && prev.patreon_subs) + '\n' +
      'Avg views **' + fmt(row.avg_views) + '**' + deltaStr(row.avg_views, prev && prev.avg_views)
    )
    .setFooter({ text: 'BrosephTech - ' + row.snapshot_date })
    .setTimestamp(new Date());
  if (notes) embed.addFields({ name: 'Note', value: notes });

  await interaction.editReply({ embeds: [embed] });
}

async function showCmd(interaction) {
  await interaction.deferReply();
  var res = await supabase
    .from('bt_metrics_snapshots')
    .select('snapshot_date, yt_subs, tiktok_followers, patreon_subs, avg_views, created_at')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2);
  if (res.error || !res.data || !res.data.length) {
    await interaction.editReply('No metrics logged yet. Use `/metrics log` to start tracking.');
    return;
  }
  var cur = res.data[0];
  var prev = res.data[1] || null;
  var embed = new EmbedBuilder()
    .setColor(0xE8A020)
    .setTitle('Channel metrics')
    .setDescription(
      'YouTube **' + fmt(cur.yt_subs) + '**' + deltaStr(cur.yt_subs, prev && prev.yt_subs) + '\n' +
      'TikTok **' + fmt(cur.tiktok_followers) + '**' + deltaStr(cur.tiktok_followers, prev && prev.tiktok_followers) + '\n' +
      'Patreon **' + fmt(cur.patreon_subs) + '**' + deltaStr(cur.patreon_subs, prev && prev.patreon_subs) + '\n' +
      'Avg views **' + fmt(cur.avg_views) + '**' + deltaStr(cur.avg_views, prev && prev.avg_views)
    )
    .setFooter({ text: 'As of ' + cur.snapshot_date });
  await interaction.editReply({ embeds: [embed] });
}
