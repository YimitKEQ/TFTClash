import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { scanGuild, findDuplicates, cleanupOrphanDuplicates } from '../utils/serverLayout.js';

function fmtChannelLine(c) {
  return '#' + c.name;
}

function buildAuditEmbed(guild) {
  var snapshot = scanGuild(guild);
  var dupes = findDuplicates(guild);

  var totalChannels = snapshot.categories.reduce(function(n, c) { return n + c.channels.length; }, 0) + snapshot.orphans.length;

  var embed = new EmbedBuilder()
    .setColor(dupes.length || snapshot.orphans.length ? 0xE8A838 : 0x4ECDC4)
    .setTitle('Server Layout — Audit')
    .setDescription(
      'Categories: **' + snapshot.categories.length + '**' +
      ' · Channels: **' + totalChannels + '**' +
      ' · Orphans: **' + snapshot.orphans.length + '**' +
      ' · Duplicates: **' + dupes.length + '**' +
      (snapshot.hidden ? '\n_' + snapshot.hidden + ' tournament/lobby category(ies) hidden — managed by other commands._' : '')
    )
    .setTimestamp();

  // Per-category channel listing (truncate to fit embed limits)
  var fields = [];
  snapshot.categories.forEach(function(cat) {
    var lines = cat.channels.map(fmtChannelLine);
    var value = lines.length ? lines.join('\n') : '_(empty)_';
    if (value.length > 1024) value = value.slice(0, 1020) + '\n…';
    fields.push({ name: cat.name, value: value, inline: true });
  });
  // Discord caps at 25 fields total — keep room for orphans + dupes
  embed.addFields(fields.slice(0, 22));

  if (snapshot.orphans.length) {
    var orphanLines = snapshot.orphans.map(function(o) { return '#' + o.name; });
    embed.addFields({ name: 'Uncategorized channels', value: orphanLines.join('\n').slice(0, 1024) });
  }

  if (dupes.length) {
    var dupeLines = dupes.map(function(g) {
      var locs = g.channels.map(function(c) { return c.parentName ? ('`' + c.parentName + '`') : '_(uncategorized)_'; }).join(' ↔ ');
      return '`#' + g.name + '` → ' + locs;
    });
    embed.addFields({ name: 'Duplicate channels', value: dupeLines.join('\n').slice(0, 1024) });
  }

  embed.setFooter({ text: 'Read-only. Use /layout cleanup-orphans to delete uncategorized duplicates.' });
  return embed;
}

function buildCleanupEmbed(res) {
  var color = res.errors.length ? 0xC0392B : (res.deleted.length ? 0x4ECDC4 : 0x95A5A6);
  var embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('Server Layout — Orphan Cleanup')
    .setDescription(
      'Deleted: **' + res.deleted.length + '**' +
      ' · Skipped: **' + res.skipped.length + '**' +
      ' · Errors: **' + res.errors.length + '**'
    )
    .setTimestamp();
  if (res.deleted.length) {
    embed.addFields({ name: 'Deleted', value: res.deleted.map(function(d) { return '#' + d.name; }).join('\n').slice(0, 1024) });
  }
  if (res.skipped.length) {
    embed.addFields({ name: 'Skipped', value: res.skipped.map(function(s) { return '`' + s.name + '` — ' + s.reason; }).join('\n').slice(0, 1024) });
  }
  if (res.errors.length) {
    embed.addFields({ name: 'Errors', value: res.errors.slice(0, 5).map(function(e) { return '• ' + e; }).join('\n').slice(0, 1024) });
  }
  return embed;
}

export var data = new SlashCommandBuilder()
  .setName('layout')
  .setDescription('Inspect or clean up the existing Discord channel layout (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(function(sub) {
    return sub.setName('audit').setDescription('Read-only snapshot of categories, channels, orphans and duplicates');
  })
  .addSubcommand(function(sub) {
    return sub.setName('cleanup-orphans').setDescription('Delete uncategorized channels that are duplicates of categorized ones')
      .addBooleanOption(function(o) { return o.setName('confirm').setDescription('Set true to actually delete').setRequired(true); });
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var sub = interaction.options.getSubcommand();
  var guild = interaction.guild;

  if (sub === 'audit') {
    return interaction.editReply({ embeds: [buildAuditEmbed(guild)] });
  }

  if (sub === 'cleanup-orphans') {
    var confirm = interaction.options.getBoolean('confirm');
    if (!confirm) {
      return interaction.editReply('Pass `confirm:true` to actually delete uncategorized duplicates. Run `/layout audit` first to preview.');
    }
    var res = await cleanupOrphanDuplicates(guild);
    return interaction.editReply({ embeds: [buildCleanupEmbed(res)] });
  }

  return interaction.editReply('Unknown subcommand.');
}
