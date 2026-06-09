/**
 * donateChannel.js — public #donate channel under the WELCOME category.
 *
 * ensureDonateChannel(client): find-or-create a read-only 💖・donate channel
 * in the WELCOME category and pin a donate embed with a PayPal link button.
 * Idempotent: if the bot already pinned a donate message there, it skips.
 *
 * Donate URL resolution: DONATE_URL env > PAYPAL_DONATE_ID (hosted button)
 * > paypal.me fallback (same chain as the website's lib/paypal.js).
 */

import {
  ChannelType, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';

var GOLD = 0xE8A838;
var CHANNEL_NAME = '💖・donate';
var CHANNEL_MATCH = 'donate';

function donateUrl() {
  if (process.env.DONATE_URL) return process.env.DONATE_URL;
  if (process.env.PAYPAL_DONATE_ID) {
    return 'https://www.paypal.com/donate/?hosted_button_id=' + encodeURIComponent(process.env.PAYPAL_DONATE_ID);
  }
  return 'https://paypal.me/monkelodie';
}

function findWelcomeCategory(guild) {
  return guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildCategory && /welcome/i.test(c.name);
  }) || null;
}

function buildDonateEmbed() {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('💖 Support TFT Clash')
    .setDescription(
      'TFT Clash is **free to compete, always** - no paywall, no entry fees.\n\n' +
      'Everything here is community-funded: if you enjoy the weekly clashes and want to ' +
      'help keep them running (and growing), a donation of any size makes a real difference.'
    )
    .addFields(
      {
        name: 'Where it goes',
        value: '🏆 Prize support for weekly clashes\n🖥️ Servers, hosting and the platform\n📣 Growing the community and bigger events',
        inline: false,
      },
      {
        name: 'How to donate',
        value: 'Hit the button below, or go to ' + donateUrl(),
        inline: false,
      }
    )
    .setFooter({ text: '100% optional. Playing and competing is free, forever.' });
}

export async function ensureDonateChannel(client) {
  var guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return { ok: false, reason: 'no-guild' };

  var channel = guild.channels.cache.find(function(c) {
    return c.type === ChannelType.GuildText && c.name.indexOf(CHANNEL_MATCH) !== -1;
  });

  if (!channel) {
    var hostRole = guild.roles.cache.find(function(r) { return r.name === 'Host'; });
    // Public read-only: everyone can see, nobody but Host can type.
    var ows = [{
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions],
    }];
    if (hostRole) ows.push({
      id: hostRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });

    var createOpts = {
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: 'Support TFT Clash - donations fund prizes and keep the platform free for everyone.',
      permissionOverwrites: ows,
    };
    var welcome = findWelcomeCategory(guild);
    if (welcome) createOpts.parent = welcome.id;

    try {
      channel = await guild.channels.create(createOpts);
      console.log('[donate] Created ' + CHANNEL_NAME + (welcome ? ' under ' + welcome.name : ''));
    } catch (e) {
      console.error('[donate] channel create failed: ' + ((e && e.message) || e));
      return { ok: false, reason: 'create-failed' };
    }
  }

  // Skip if the bot already pinned a donate message here.
  try {
    var pins = await channel.messages.fetchPinned();
    var meId = client.user.id;
    var existing = pins.find(function(m) {
      return m.author && m.author.id === meId && m.embeds && m.embeds.length &&
        /support tft clash/i.test(m.embeds[0].title || '');
    });
    if (existing) return { ok: true, channelId: channel.id, posted: false };
  } catch (_e) {}

  try {
    var row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Donate via PayPal')
        .setStyle(ButtonStyle.Link)
        .setURL(donateUrl())
        .setEmoji('💖')
    );
    var msg = await channel.send({ embeds: [buildDonateEmbed()], components: [row] });
    try { await msg.pin(); } catch (_e) {}
    console.log('[donate] Donate embed posted and pinned');
    return { ok: true, channelId: channel.id, posted: true };
  } catch (e) {
    console.error('[donate] embed post failed: ' + ((e && e.message) || e));
    return { ok: false, reason: 'post-failed' };
  }
}
