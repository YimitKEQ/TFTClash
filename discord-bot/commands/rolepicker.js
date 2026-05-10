import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import {
  listPickers,
  getPicker,
  createPicker,
  deletePicker,
  addPickerOption,
  removePickerOption,
  postPicker,
} from '../utils/rolePickers.js';

function fmtPickerLine(p) {
  var posted = p.message_id ? ('posted in <#' + p.channel_id + '>') : 'not posted';
  var n = (p.options || []).length;
  return '`' + p.slug + '` — ' + n + ' option(s) · ' + posted;
}

function fmtOptions(options) {
  if (!options || !options.length) return '_(no options yet)_';
  return options.map(function(o) {
    return (o.emoji || '•') + '  **' + (o.label || o.role_name) + '** → @' + o.role_name;
  }).join('\n');
}

export var data = new SlashCommandBuilder()
  .setName('rolepicker')
  .setDescription('Manage reaction-role panels (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(function(sub) {
    return sub.setName('create').setDescription('Create a new role picker panel')
      .addStringOption(function(o) { return o.setName('slug').setDescription('Short identifier, e.g. "pings" or "regions"').setRequired(true); })
      .addStringOption(function(o) { return o.setName('title').setDescription('Embed title').setRequired(true); })
      .addStringOption(function(o) { return o.setName('intro').setDescription('Optional intro text above the options').setRequired(false); });
  })
  .addSubcommand(function(sub) {
    return sub.setName('add').setDescription('Add a role option to a picker')
      .addStringOption(function(o) { return o.setName('slug').setDescription('Picker slug').setRequired(true); })
      .addStringOption(function(o) { return o.setName('emoji').setDescription('Reaction emoji (single Unicode emoji)').setRequired(true); })
      .addRoleOption(function(o) { return o.setName('role').setDescription('Role to grant').setRequired(true); })
      .addStringOption(function(o) { return o.setName('label').setDescription('Display label (defaults to role name)').setRequired(false); })
      .addStringOption(function(o) { return o.setName('desc').setDescription('Short description shown after the label').setRequired(false); });
  })
  .addSubcommand(function(sub) {
    return sub.setName('remove').setDescription('Remove a role option from a picker')
      .addStringOption(function(o) { return o.setName('slug').setDescription('Picker slug').setRequired(true); })
      .addRoleOption(function(o) { return o.setName('role').setDescription('Role to remove from the picker').setRequired(true); });
  })
  .addSubcommand(function(sub) {
    return sub.setName('post').setDescription('Post or repost a picker into a channel')
      .addStringOption(function(o) { return o.setName('slug').setDescription('Picker slug').setRequired(true); })
      .addChannelOption(function(o) { return o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(true); });
  })
  .addSubcommand(function(sub) {
    return sub.setName('list').setDescription('List all role pickers');
  })
  .addSubcommand(function(sub) {
    return sub.setName('show').setDescription('Show options for a picker')
      .addStringOption(function(o) { return o.setName('slug').setDescription('Picker slug').setRequired(true); });
  })
  .addSubcommand(function(sub) {
    return sub.setName('delete').setDescription('Delete a picker (does not delete posted message automatically)')
      .addStringOption(function(o) { return o.setName('slug').setDescription('Picker slug').setRequired(true); });
  });

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  var sub = interaction.options.getSubcommand();
  var guild = interaction.guild;
  var guildId = guild.id;

  if (sub === 'create') {
    var slug = interaction.options.getString('slug').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    var title = interaction.options.getString('title');
    var intro = interaction.options.getString('intro');
    try {
      var p = await createPicker(guildId, slug, title, intro);
      return interaction.editReply('Created picker `' + p.slug + '`. Add roles with `/rolepicker add slug:' + p.slug + ' emoji:✅ role:@RoleName`, then `/rolepicker post`.');
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  if (sub === 'add') {
    var slugA = interaction.options.getString('slug').toLowerCase();
    var emoji = interaction.options.getString('emoji').trim();
    var role = interaction.options.getRole('role');
    var label = interaction.options.getString('label');
    var desc = interaction.options.getString('desc');
    if (!role) return interaction.editReply('Role is required.');
    try {
      await addPickerOption(guildId, slugA, { emoji: emoji, role_name: role.name, label: label, desc: desc });
      return interaction.editReply('Added ' + emoji + ' → @' + role.name + ' to `' + slugA + '`. Run `/rolepicker post slug:' + slugA + '` to update the live panel.');
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  if (sub === 'remove') {
    var slugR = interaction.options.getString('slug').toLowerCase();
    var roleR = interaction.options.getRole('role');
    try {
      await removePickerOption(guildId, slugR, roleR.name);
      return interaction.editReply('Removed @' + roleR.name + ' from `' + slugR + '`. Repost with `/rolepicker post slug:' + slugR + '`.');
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  if (sub === 'post') {
    var slugP = interaction.options.getString('slug').toLowerCase();
    var channel = interaction.options.getChannel('channel');
    try {
      var picker = await getPicker(guildId, slugP);
      if (!picker) return interaction.editReply('Picker `' + slugP + '` not found.');
      if (!picker.options || !picker.options.length) {
        return interaction.editReply('Picker `' + slugP + '` has no options yet. Add some with `/rolepicker add` first.');
      }
      // Verify all roles exist before posting
      var missing = picker.options.filter(function(o) {
        return !guild.roles.cache.find(function(r) { return r.name === o.role_name; });
      });
      if (missing.length) {
        return interaction.editReply('Cannot post — these roles do not exist on the server: ' + missing.map(function(m) { return '@' + m.role_name; }).join(', '));
      }
      var posted = await postPicker(guild, slugP, channel);
      return interaction.editReply('Posted `' + slugP + '` in ' + channel.toString() + '. Message ID `' + posted.message.id + '`.');
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  if (sub === 'list') {
    try {
      var all = await listPickers(guildId);
      if (!all.length) return interaction.editReply('No pickers yet. Create one with `/rolepicker create`.');
      var embed = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('Role pickers (' + all.length + ')')
        .setDescription(all.map(fmtPickerLine).join('\n').slice(0, 4000));
      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  if (sub === 'show') {
    var slugS = interaction.options.getString('slug').toLowerCase();
    try {
      var pp = await getPicker(guildId, slugS);
      if (!pp) return interaction.editReply('Picker `' + slugS + '` not found.');
      var emb = new EmbedBuilder()
        .setColor(0x4ECDC4)
        .setTitle('Picker: ' + pp.title + ' (`' + pp.slug + '`)')
        .setDescription(fmtOptions(pp.options))
        .setFooter({ text: pp.message_id ? ('posted in #' + (guild.channels.cache.get(pp.channel_id) || {}).name) : 'not posted yet' });
      return interaction.editReply({ embeds: [emb] });
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  if (sub === 'delete') {
    var slugD = interaction.options.getString('slug').toLowerCase();
    try {
      await deletePicker(guildId, slugD);
      return interaction.editReply('Deleted picker `' + slugD + '`. The posted message (if any) was left in place — delete it manually.');
    } catch (e) {
      return interaction.editReply('Failed: ' + e.message);
    }
  }

  return interaction.editReply('Unknown subcommand.');
}
