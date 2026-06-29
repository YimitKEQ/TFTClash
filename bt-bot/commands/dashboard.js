/**
 * /dashboard - post a live command-center snapshot of the BrosephTech board to
 * Discord: KPIs, department health, who is behind, work that needs attention,
 * and recent meetings/recordings. Comes with a Refresh button and a link to the
 * full browser dashboard when it is enabled.
 *
 * Shares lib/dashboardData.buildOverview with the web dashboard so the numbers
 * always match.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { buildOverview } from '../lib/dashboardData.js';
import { dashboardUrl } from '../web/server.js';

function clamp(s, n) {
  var v = String(s == null ? '' : s);
  return v.length > n ? v.slice(0, n - 3) + '...' : v;
}

function ago(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return s + 's ago';
  var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function buildEmbed(d) {
  var t = d.totals;
  var embed = new EmbedBuilder()
    .setColor(0x5BA3DB)
    .setTitle('BrosephTech HQ')
    .setDescription(
      '`' + t.active + '` active   ' +
      '`' + t.overdue + '` overdue   ' +
      '`' + t.stuck + '` stuck   ' +
      '`' + t.dueSoon + '` due soon   ' +
      '`' + t.blocked + '` blocked\n' +
      '`' + t.shippedThisWeek + '` shipped this week   ' +
      '`' + t.ideasOpen + '` open ideas   ' +
      '`' + t.cards + '` cards tracked'
    )
    .setTimestamp(new Date());

  // Department health.
  var deptLines = (d.departments || []).map(function(dp) {
    return '**' + dp.label + '**  ' + dp.active + ' active'
      + (dp.overdue ? ', ' + dp.overdue + ' overdue' : '')
      + (dp.stuck ? ', ' + dp.stuck + ' stuck' : '')
      + (dp.dueSoon ? ', ' + dp.dueSoon + ' soon' : '');
  });
  if (deptLines.length) embed.addFields({ name: 'Department health', value: clamp(deptLines.join('\n'), 1024) });

  // Crew that needs a nudge.
  var hot = (d.members || []).filter(function(m) { return m.overdue || m.stuck; }).slice(0, 6);
  if (hot.length) {
    var crewLines = hot.map(function(m) {
      var bits = [];
      if (m.overdue) bits.push(m.overdue + ' overdue');
      if (m.stuck) bits.push(m.stuck + ' stuck');
      if (m.dueSoon) bits.push(m.dueSoon + ' soon');
      return '**' + m.name + '** - ' + bits.join(', ');
    });
    embed.addFields({ name: 'Needs a nudge', value: clamp(crewLines.join('\n'), 1024) });
  } else {
    embed.addFields({ name: 'Needs a nudge', value: 'Everyone is on top of their cards.' });
  }

  // Overdue + blocked highlights.
  var att = [];
  (d.lists.overdue || []).slice(0, 5).forEach(function(c) {
    att.push('`' + c.daysOverdue + 'd late` ' + clamp(c.title, 60) + (c.assignees.length ? ' - ' + c.assignees.join(', ') : ''));
  });
  (d.lists.blocked || []).slice(0, 3).forEach(function(c) {
    att.push('`blocked` ' + clamp(c.title, 60) + (c.assignees.length ? ' - ' + c.assignees.join(', ') : ''));
  });
  if (att.length) embed.addFields({ name: 'Needs attention', value: clamp(att.join('\n'), 1024) });

  // Due soon.
  var soon = (d.lists.dueSoon || []).slice(0, 5).map(function(c) {
    return '`' + (c.daysUntil === 0 ? 'today' : 'in ' + c.daysUntil + 'd') + '` ' + clamp(c.title, 60);
  });
  if (soon.length) embed.addFields({ name: 'Due soon', value: clamp(soon.join('\n'), 1024) });

  // Recent meetings + recordings, side by side.
  var meet = (d.meetings || []).slice(0, 3).map(function(m) {
    return '**' + clamp(m.title, 50) + '** - ' + m.tasksCreated + ' task(s), ' + ago(m.createdAt);
  });
  if (meet.length) embed.addFields({ name: 'Recent meetings', value: clamp(meet.join('\n'), 1024), inline: true });

  var rec = (d.voice || []).slice(0, 3).map(function(v) {
    return '**' + clamp(v.channelName || 'Recording', 40) + '** - ' + v.tasksCreated + ' task(s), ' + ago(v.createdAt);
  });
  if (rec.length) embed.addFields({ name: 'Recent recordings', value: clamp(rec.join('\n'), 1024), inline: true });

  // Channel metrics.
  if (d.metrics) {
    var mt = d.metrics;
    function fmt(n, delta) {
      if (n == null) return '-';
      var s = Number(n).toLocaleString();
      if (delta != null && delta !== 0) s += ' (' + (delta > 0 ? '+' : '') + delta + ')';
      return s;
    }
    embed.addFields({
      name: 'Channel metrics',
      value: 'YouTube ' + fmt(mt.ytSubs, mt.deltas.ytSubs)
        + '  -  TikTok ' + fmt(mt.tiktokFollowers, mt.deltas.tiktokFollowers)
        + '  -  Patreon ' + fmt(mt.patreonSubs, mt.deltas.patreonSubs),
    });
  }

  // Jira board (when connected).
  if (d.jira && d.jira.configured && !d.jira.error) {
    var jl = [];
    jl.push('`' + d.jira.counts.todo + '` to do   `' + d.jira.counts.inProgress + '` in progress   `' + d.jira.counts.done + '` done');
    (d.jira.openItems || []).slice(0, 4).forEach(function(it) {
      jl.push('[' + it.key + '](' + it.url + ') ' + clamp(it.summary, 56) + (it.priority ? ' `' + it.priority + '`' : ''));
    });
    embed.addFields({ name: 'Jira (' + d.jira.projectKey + ')', value: clamp(jl.join('\n'), 1024) });
  }

  embed.setFooter({ text: 'BrosephTech command center - updated ' + ago(d.generatedAt) });
  return embed;
}

function buildComponents() {
  var row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash:refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary)
  );
  var url = dashboardUrl();
  // Only attach a link button for a real, reachable public URL (Discord rejects
  // localhost/non-http link buttons in some clients).
  if (url && /^https?:\/\//i.test(url) && url.indexOf('127.0.0.1') === -1 && url.indexOf('localhost') === -1) {
    row.addComponents(new ButtonBuilder().setLabel('Open web dashboard').setStyle(ButtonStyle.Link).setURL(url));
  }
  return [row];
}

export var data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('Post a live command-center snapshot of the board');

export async function execute(interaction) {
  await interaction.deferReply();
  var d;
  try {
    d = await buildOverview();
  } catch (e) {
    await interaction.editReply('Could not build the dashboard: ' + ((e && e.message) || e));
    return;
  }
  await interaction.editReply({ embeds: [buildEmbed(d)], components: buildComponents() });
}

export async function handleComponent(interaction) {
  if (interaction.customId !== 'dash:refresh') return;
  await interaction.deferUpdate().catch(function() {});
  try {
    var d = await buildOverview();
    await interaction.editReply({ embeds: [buildEmbed(d)], components: buildComponents() });
  } catch (e) {
    await interaction.followUp({ content: 'Refresh failed: ' + ((e && e.message) || e), ephemeral: true }).catch(function() {});
  }
}
