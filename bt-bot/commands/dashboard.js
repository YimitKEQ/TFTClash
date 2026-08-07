/**
 * /dashboard - the live command centre for the board, in Discord.
 *
 * This used to be one embed with eight stacked fields: a run-on strip of code
 * pills, department health, crew, attention, due soon, two meeting sections and
 * Jira, all in a single grey wall. It is now a sectioned report: a hero card
 * that says what to DO, then one focused card per concern, each with its own
 * color strip. Discord allows ten embeds per message and stacked color strips
 * read as sections, so this is cheaper to scan and cheaper to send.
 *
 * Shares lib/dashboardData.buildOverview with the web dashboard so the numbers
 * can never disagree.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { buildOverview } from '../lib/dashboardData.js';
import { dashboardUrl } from '../web/server.js';
import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  bar,
  baseEmbed,
  clamp,
  eyebrow,
  health,
  healthMeter,
  kpiFields,
  pack,
  rel,
} from '../lib/ui.js';

// How many rows each section shows before it collapses into a count. Small on
// purpose: the web dashboard is the place to see everything.
var LIMITS = { attention: 6, dueSoon: 4, crew: 5, meetings: 3, jira: 4 };

function ownerText(card) {
  var list = (card && card.assignees) || [];
  return list.length ? list.join(', ') : 'unassigned';
}

// ---- section builders --------------------------------------------------------

// The hero: verdict, health meter, and the six counters as inline fields.
function heroEmbed(d, iconURL) {
  var h = health(d.totals);
  var embed = baseEmbed({
    color: h.color,
    author: BRAND.name + '  ' + MARK.arrow + '  Command centre',
    authorIcon: iconURL,
    title: h.verdict,
    description: h.guidance + '\n' + healthMeter(h),
    // No native timestamp here: Discord renders footer text literally, so a
    // <t:...> would ship as raw markup. The embed's own timestamp, set by
    // baseEmbed, already prints the refresh time next to this line.
    footer: d.totals.cards + ' cards tracked  ' + MARK.arrow + '  ' + d.totals.ideasOpen + ' open ideas',
    timestamp: new Date(d.generatedAt),
  });
  embed.addFields(kpiFields(d.totals));
  return embed;
}

// What to act on right now, worst first: blocked, then overdue, then due soon.
function attentionEmbed(d) {
  var lines = [];

  (d.lists.blocked || []).slice(0, LIMITS.attention).forEach(function(c) {
    lines.push(MARK.blocked + ' **' + clamp(c.title, 62) + '**  ' + MARK.arrow + '  ' + ownerText(c));
  });
  (d.lists.overdue || []).slice(0, LIMITS.attention).forEach(function(c) {
    lines.push(DOT.danger + ' **' + clamp(c.title, 62) + '**  ' + MARK.arrow + '  ' + ownerText(c) + '  ' + MARK.arrow + '  ' + c.daysOverdue + 'd late');
  });
  (d.lists.stuck || []).slice(0, LIMITS.attention).forEach(function(c) {
    lines.push(DOT.warn + ' **' + clamp(c.title, 62) + '**  ' + MARK.arrow + '  ' + ownerText(c) + '  ' + MARK.arrow + '  untouched ' + c.staleDays + 'd');
  });

  if (!lines.length) return null;

  var embed = baseEmbed({
    color: COLOR.danger,
    title: 'Do next',
    description: 'Ranked worst first. Blocked cards cannot move at all, so they come before merely late ones.',
    footer: 'Blocked, overdue, then gone quiet',
  });
  embed.addFields({ name: eyebrow('Needs a human', lines.length), value: pack(lines) });

  var soon = (d.lists.dueSoon || []).slice(0, LIMITS.dueSoon).map(function(c) {
    return DOT.soon + ' **' + clamp(c.title, 62) + '**  ' + MARK.arrow + '  ' + (c.due_date ? rel(c.due_date) : 'soon');
  });
  if (soon.length) embed.addFields({ name: eyebrow('Landing soon', soon.length), value: pack(soon) });

  return embed;
}

// Where the work sits: department load meters and the crew who are behind.
function loadEmbed(d) {
  var departments = (d.departments || []).filter(function(dp) { return dp.total > 0; });
  var crew = (d.members || []).filter(function(m) { return m.overdue || m.stuck; }).slice(0, LIMITS.crew);
  if (!departments.length && !crew.length) return null;

  var embed = baseEmbed({
    color: COLOR.info,
    title: 'Where the work sits',
    footer: 'Bars are scaled against the busiest department',
  });

  if (departments.length) {
    var peak = departments.reduce(function(m, dp) { return Math.max(m, dp.active); }, 0);
    var deptLines = departments.map(function(dp) {
      var flags = [];
      if (dp.overdue) flags.push(DOT.danger + ' ' + dp.overdue);
      if (dp.stuck) flags.push(DOT.warn + ' ' + dp.stuck);
      if (dp.blocked) flags.push(MARK.blocked + ' ' + dp.blocked);
      return '`' + bar(dp.active, peak, 8) + '` **' + dp.label + '** ' + dp.active
        + (flags.length ? '  ' + flags.join('  ') : '');
    });
    embed.addFields({ name: eyebrow('Active by department'), value: pack(deptLines) });
  }

  if (crew.length) {
    var crewLines = crew.map(function(m) {
      var bits = [];
      if (m.overdue) bits.push(DOT.danger + ' ' + m.overdue + ' late');
      if (m.stuck) bits.push(DOT.warn + ' ' + m.stuck + ' quiet');
      if (m.dueSoon) bits.push(DOT.soon + ' ' + m.dueSoon + ' soon');
      return '**' + m.name + '**  ' + MARK.arrow + '  ' + bits.join('  ');
    });
    embed.addFields({ name: eyebrow('Behind right now', crew.length), value: pack(crewLines) });
  } else {
    embed.addFields({ name: eyebrow('Behind right now'), value: DOT.ok + ' Nobody. Everyone is on top of their cards.' });
  }

  // The board pipeline as a single flow line, so the shape of the funnel is
  // visible without a whole extra section.
  var flow = (d.columns || []).filter(function(c) { return !c.done; })
    .map(function(c) { return c.label + ' ' + c.count; }).join('  ' + MARK.arrow + '  ');
  if (flow) embed.addFields({ name: eyebrow('Pipeline'), value: flow });

  return embed;
}

// The most recent meeting, then Jira, in one card. Both are context, not action.
function contextEmbed(d) {
  var lr = d.latestRecap;
  var jira = d.jira && d.jira.configured && !d.jira.error ? d.jira : null;
  if (!lr && !jira) return null;

  var embed = baseEmbed({
    color: COLOR.neutral,
    title: 'Context',
    footer: BRAND.name,
  });

  if (lr && lr.tldr) {
    embed.addFields({
      name: eyebrow('Latest meeting'),
      value: '**' + clamp(lr.title, 70) + '**  ' + MARK.arrow + '  ' + rel(lr.createdAt) + '\n'
        + clamp(lr.tldr, 500) + '\n'
        + '*' + (lr.createdBy || 'the team') + '  ' + MARK.arrow + '  ' + lr.tasksCreated + ' task(s) created*',
    });
    var earlier = (d.recaps || []).slice(1, 1 + LIMITS.meetings).map(function(m) {
      return '**' + clamp(m.title, 48) + '**  ' + MARK.arrow + '  ' + m.tasksCreated + ' task(s)  ' + MARK.arrow + '  ' + rel(m.createdAt);
    });
    if (earlier.length) embed.addFields({ name: eyebrow('Earlier', earlier.length), value: pack(earlier) });
  }

  if (jira) {
    var counts = jira.counts || {};
    var jiraLines = ['To do ' + (counts.todo || 0) + '  ' + MARK.arrow + '  In progress ' + (counts.inProgress || 0) + '  ' + MARK.arrow + '  Done ' + (counts.done || 0)];
    (jira.openItems || []).slice(0, LIMITS.jira).forEach(function(it) {
      jiraLines.push('[' + it.key + '](' + it.url + ')  ' + clamp(it.summary, 56) + (it.priority ? '  ' + MARK.arrow + '  ' + it.priority : ''));
    });
    embed.addFields({ name: eyebrow('Jira ' + (jira.projectKey || '')), value: pack(jiraLines) });
  }

  return embed;
}

// Exported so the preview renderer (scripts/preview-embeds.js) and the test
// suite can build the real cards without a Discord connection.
export function buildEmbeds(d, iconURL) {
  return [
    heroEmbed(d, iconURL),
    attentionEmbed(d),
    loadEmbed(d),
    contextEmbed(d),
  ].filter(Boolean);
}

function buildComponents() {
  var row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash:refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary)
  );
  var url = dashboardUrl();
  // Only attach a link button for a real, reachable public URL. Discord rejects
  // localhost and 0.0.0.0 link buttons, which would fail the whole send.
  if (url && /^https?:\/\//i.test(url)
    && url.indexOf('127.0.0.1') === -1
    && url.indexOf('localhost') === -1
    && url.indexOf('0.0.0.0') === -1) {
    row.addComponents(new ButtonBuilder().setLabel('Open web dashboard').setStyle(ButtonStyle.Link).setURL(url));
  }
  return [row];
}

function iconOf(interaction) {
  try {
    return interaction.client.user.displayAvatarURL();
  } catch (e) {
    return null;
  }
}

export var data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('Post a live command centre snapshot of the board');

// customId prefixes this command answers to (see the router in index.js).
export var componentIds = ['dash'];

export async function execute(interaction) {
  await interaction.deferReply();
  var d;
  try {
    d = await buildOverview();
  } catch (e) {
    await interaction.editReply('Could not build the dashboard: ' + ((e && e.message) || e));
    return;
  }
  await interaction.editReply({ embeds: buildEmbeds(d, iconOf(interaction)), components: buildComponents() });
}

export async function handleComponent(interaction) {
  if (interaction.customId !== 'dash:refresh') return;
  await interaction.deferUpdate().catch(function() {});
  try {
    var d = await buildOverview();
    await interaction.editReply({ embeds: buildEmbeds(d, iconOf(interaction)), components: buildComponents() });
  } catch (e) {
    await interaction.followUp({ content: 'Refresh failed: ' + ((e && e.message) || e), ephemeral: true }).catch(function() {});
  }
}
