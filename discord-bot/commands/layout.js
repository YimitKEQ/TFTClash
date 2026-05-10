import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { auditLayout, applyLayout } from '../utils/serverLayout.js';

function chunk(arr, n) {
  var out = [];
  for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function fmtMissing(missing) {
  if (!missing.length) return '_(none)_';
  return missing.map(function(m) { return '`' + m.category + ' / ' + m.name + '`' + (m.kind === 'forum' ? ' (forum)' : ''); }).join('\n');
}

function fmtExtraCh(extras) {
  if (!extras.length) return '_(none)_';
  return extras.map(function(e) { return '`' + e.category + ' / ' + e.name + '`' + (e.type === 'forum' ? ' (forum)' : ''); }).join('\n');
}

function buildAuditEmbed(audit) {
  var embed = new EmbedBuilder()
    .setColor(audit.missingCategories.length || audit.missingChannels.length ? 0xE8A838 : 0x4ECDC4)
    .setTitle('Server Layout Audit')
    .setDescription(
      'Categories present: **' + audit.existingCategories.length + '**, missing: **' + audit.missingCategories.length + '**\n' +
      'Channels present: **' + audit.existingChannels.length + '**, missing: **' + audit.missingChannels.length + '**\n' +
      'Per-tournament categories (excluded): managed by /tournament create'
    )
    .setTimestamp();

  if (audit.missingCategories.length) {
    embed.addFields({ name: 'Missing categories', value: audit.missingCategories.map(function(c) { return '`' + c + '`'; }).join('\n').slice(0, 1024) });
  }
  if (audit.missingChannels.length) {
    var rows = fmtMissing(audit.missingChannels);
    var blocks = chunk(rows.split('\n'), 10).map(function(b) { return b.join('\n'); }).slice(0, 3);
    blocks.forEach(function(b, i) {
      embed.addFields({ name: 'Missing channels' + (blocks.length > 1 ? ' (' + (i + 1) + '/' + blocks.length + ')' : ''), value: b.slice(0, 1024) });
    });
  }
  if (audit.extraCategories.length) {
    embed.addFields({ name: 'Extra categories (not in layout)', value: audit.extraCategories.map(function(c) { return '`' + c + '`'; }).join('\n').slice(0, 1024) });
  }
  if (audit.extraChannels.length) {
    embed.addFields({ name: 'Extra channels in known categories', value: fmtExtraCh(audit.extraChannels).slice(0, 1024) });
  }
  embed.setFooter({ text: '/layout apply will create only what is missing — never deletes.' });
  return embed;
}

function buildApplyEmbed(res) {
  var embed = new EmbedBuilder()
    .setColor(res.errors.length ? 0xC0392B : 0x4ECDC4)
    .setTitle('Server Layout Applied')
    .setDescription(
      'Created categories: **' + res.createdCategories.length + '**\n' +
      'Created channels: **' + res.createdChannels.length + '**\n' +
      'Errors: **' + res.errors.length + '**'
    )
    .setTimestamp();
  if (res.createdCategories.length) {
    embed.addFields({ name: 'New categories', value: res.createdCategories.map(function(c) { return '`' + c + '`'; }).join('\n').slice(0, 1024) });
  }
  if (res.createdChannels.length) {
    embed.addFields({ name: 'New channels', value: res.createdChannels.map(function(c) { return '`' + c + '`'; }).join('\n').slice(0, 1024) });
  }
  if (res.errors.length) {
    embed.addFields({ name: 'Errors', value: res.errors.slice(0, 5).map(function(e) { return '• ' + e; }).join('\n').slice(0, 1024) });
  }
  return embed;
}

export var data = new SlashCommandBuilder()
  .setName('layout')
  .setDescription('Audit or apply the desired Discord server layout (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(function(sub) {
    return sub.setName('audit').setDescription('Dry-run: show categories/channels that are missing or unexpected');
  })
  .addSubcommand(function(sub) {
    return sub.setName('apply').setDescription('Create any missing categories/channels. Never deletes.');
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var sub = interaction.options.getSubcommand();
  var guild = interaction.guild;

  if (sub === 'audit') {
    var audit = auditLayout(guild);
    return interaction.editReply({ embeds: [buildAuditEmbed(audit)] });
  }

  if (sub === 'apply') {
    var res = await applyLayout(guild);
    return interaction.editReply({ embeds: [buildApplyEmbed(res)] });
  }

  return interaction.editReply('Unknown subcommand.');
}
