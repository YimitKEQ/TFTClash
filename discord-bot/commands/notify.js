import { SlashCommandBuilder } from 'discord.js';
import { addNotifyRole, removeNotifyRole, NOTIFY_KINDS } from '../utils/notifyRoles.js';

var KIND_CHOICES = Object.keys(NOTIFY_KINDS).map(function(k) {
  return { name: NOTIFY_KINDS[k].label, value: k };
});

export const data = new SlashCommandBuilder()
  .setName('notify')
  .setDescription('Subscribe or unsubscribe from TFT Clash notifications')
  .addSubcommand(function(sub) {
    return sub
      .setName('subscribe')
      .setDescription('Get pinged for this kind of event')
      .addStringOption(function(opt) {
        return opt.setName('kind').setDescription('Notification kind').setRequired(true).addChoices.apply(opt, KIND_CHOICES);
      });
  })
  .addSubcommand(function(sub) {
    return sub
      .setName('unsubscribe')
      .setDescription('Stop getting pinged for this kind')
      .addStringOption(function(opt) {
        return opt.setName('kind').setDescription('Notification kind').setRequired(true).addChoices.apply(opt, KIND_CHOICES);
      });
  })
  .addSubcommand(function(sub) {
    return sub.setName('list').setDescription('Show available notification kinds');
  });

export async function execute(interaction) {
  var sub = interaction.options.getSubcommand();
  var member = interaction.member;
  if (sub === 'list') {
    var hasRole = function(name) {
      return !!(member && member.roles && member.roles.cache.find(function(r) { return r.name === name; }));
    };
    var lines = ['**Notification kinds** (✅ = you are subscribed):'];
    Object.keys(NOTIFY_KINDS).forEach(function(k) {
      var d = NOTIFY_KINDS[k];
      var on = hasRole(d.roleName);
      lines.push((on ? '✅' : d.emoji) + '  **' + d.label + '** — ' + d.desc);
    });
    lines.push('');
    lines.push('Use `/notify subscribe kind:<name>` to opt in, `/notify unsubscribe` to opt out, or react in the roles channel.');
    return interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }
  var kind = interaction.options.getString('kind');
  if (!NOTIFY_KINDS[kind]) {
    return interaction.reply({ content: 'Unknown notification kind.', ephemeral: true });
  }
  if (sub === 'subscribe') {
    var ok = await addNotifyRole(member, kind);
    return interaction.reply({ content: ok ? ('Subscribed to **' + NOTIFY_KINDS[kind].label + '**.') : 'Failed to add the role — bot may be missing permissions or role hierarchy. Contact a host.', ephemeral: true });
  }
  if (sub === 'unsubscribe') {
    var ok2 = await removeNotifyRole(member, kind);
    return interaction.reply({ content: ok2 ? ('Unsubscribed from **' + NOTIFY_KINDS[kind].label + '**.') : 'Failed to remove the role — contact a host.', ephemeral: true });
  }
}
