import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
} from 'discord.js';

// Host status panel. /status posts a panel of buttons into the current channel.
// Pressing a button (staff only) updates the panel in place to show the chosen
// status and sets the bot's Discord presence to match. The panel message IS the
// status display, so there is no spam and it survives bot restarts (button
// interactions are dispatched by customId, no hydration needed).

// Each status: button label/emoji/style, the announced message, embed color,
// and the bot presence (status + activity) to apply.
export var STATUSES = [
  {
    key: 'available',
    label: 'Available',
    emoji: '🟢',
    style: ButtonStyle.Success,
    blurb: "I'm around and reachable. Ping away.",
    color: 0x6ee7b7,
    presence: { status: 'online', type: ActivityType.Playing, name: 'Available · /clash' },
  },
  {
    key: 'busy',
    label: 'Busy',
    emoji: '🔴',
    style: ButtonStyle.Danger,
    blurb: "Heads down right now. I'll get back to you when I can.",
    color: 0xffb4ab,
    presence: { status: 'dnd', type: ActivityType.Playing, name: 'Busy' },
  },
  {
    key: 'asleep',
    label: 'Asleep',
    emoji: '🌙',
    style: ButtonStyle.Secondary,
    blurb: "Offline and asleep. I'll catch up when I'm back.",
    color: 0x9aabbf,
    presence: { status: 'idle', type: ActivityType.Playing, name: 'Asleep 🌙' },
  },
  {
    key: 'working',
    label: 'Working',
    emoji: '🛠️',
    style: ButtonStyle.Primary,
    blurb: 'At work and focused. Replies may be slow.',
    color: 0xffc66b,
    presence: { status: 'dnd', type: ActivityType.Playing, name: 'Working' },
  },
  {
    key: 'running_clash',
    label: 'Running Clash',
    emoji: '⚔️',
    style: ButtonStyle.Primary,
    blurb: 'Live running a clash right now. Eyes on the bracket, slow on DMs.',
    color: 0x67e2d9,
    presence: { status: 'online', type: ActivityType.Competing, name: 'a live Clash ⚔️' },
  },
  {
    key: 'limited',
    label: 'Limited Availability',
    emoji: '🟡',
    style: ButtonStyle.Secondary,
    blurb: "Around but stretched thin. Keep it brief and I'll do my best.",
    color: 0xfb923c,
    presence: { status: 'idle', type: ActivityType.Playing, name: 'Limited availability' },
  },
];

function statusByKey(key) {
  return STATUSES.find(function (s) { return s.key === key; }) || null;
}

// Build the panel message (embed + button rows). `current` is the selected
// status object (or null when freshly posted); `byTag` is who last set it.
function buildPanel(current, byTag) {
  var embed = new EmbedBuilder();
  if (current) {
    embed
      .setColor(current.color)
      .setTitle('Host Status')
      .setDescription(current.emoji + '  **' + current.label + '**\n' + current.blurb)
      .setFooter({ text: 'Set by ' + (byTag || 'staff') })
      .setTimestamp(new Date());
  } else {
    embed
      .setColor(0x1f1f27)
      .setTitle('Host Status')
      .setDescription('No status set yet. Pick an option below to broadcast your availability.')
      .setFooter({ text: 'Staff only' });
  }

  // Max 5 buttons per row, so split 6 across two rows (3 + 3).
  var row1 = new ActionRowBuilder();
  var row2 = new ActionRowBuilder();
  STATUSES.forEach(function (s, i) {
    var btn = new ButtonBuilder()
      .setCustomId('hoststatus:' + s.key)
      .setLabel(s.label)
      .setEmoji(s.emoji)
      .setStyle(s.style);
    (i < 3 ? row1 : row2).addComponents(btn);
  });

  return { embeds: [embed], components: [row1, row2] };
}

export var data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Post the host status panel in this channel (staff only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  // Public reply so the panel persists as a real message anyone can see (only
  // staff can actually press the buttons; non-staff get an ephemeral notice).
  await interaction.reply(buildPanel(null, null));
}

// Routed from index.js for any button whose customId starts with 'hoststatus:'.
export async function handleHostStatusButton(interaction) {
  var canManage = interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
  if (!canManage) {
    return interaction.reply({ content: 'Only staff can change the host status.', ephemeral: true });
  }

  var key = interaction.customId.split(':')[1];
  var s = statusByKey(key);
  if (!s) {
    return interaction.reply({ content: 'Unknown status option.', ephemeral: true });
  }

  // Update the panel message in place to reflect the new status.
  await interaction.update(buildPanel(s, interaction.user.tag));

  // Mirror it on the bot's own Discord presence.
  try {
    interaction.client.user.setPresence({
      activities: [{ name: s.presence.name, type: s.presence.type }],
      status: s.presence.status,
    });
  } catch (e) {
    // Presence update is best-effort; the panel still updated above.
  }
}
