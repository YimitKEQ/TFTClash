/**
 * embedKit.js — shared brand primitives for all TFT Clash bot embeds.
 *
 * STATUS_COLOR  : phase → hex color (single source of truth)
 * brandEmbed    : returns EmbedBuilder with consistent author/footer/timestamp
 * placeBadge    : podium chip (01/02/03 for top 3, monospace 4. for rest)
 * divider       : chevron rule motif matching TournamentRecapScreen
 */

import { EmbedBuilder } from 'discord.js';

export const STATUS_COLOR = Object.freeze({
  idle:         0x6B7280,
  registration: 0x4ECDC4,
  checkin:      0x3498DB,
  inprogress:   0xC0392B,
  complete:     0xE8A838,
  notice:       0x9B72CF,
  alert:        0xC0392B,
});

const SITE_URL = 'https://tftclash.com';

export function brandEmbed(opts) {
  var o = opts || {};
  var color = (typeof o.color === 'number') ? o.color : STATUS_COLOR.notice;
  var footerNote = o.footerNote ? ('TFT Clash · ' + o.footerNote) : 'TFT Clash';
  var eb = new EmbedBuilder().setColor(color).setTimestamp();
  if (o.author) eb.setAuthor({ name: o.author, url: SITE_URL });
  if (o.title) eb.setTitle(o.title);
  if (o.body) eb.setDescription(o.body);
  if (Array.isArray(o.fields) && o.fields.length) eb.addFields(o.fields);
  eb.setFooter({ text: footerNote });
  return eb;
}

export function placeBadge(n) {
  var place = Number(n) || 0;
  if (place === 1) return '`01`';
  if (place === 2) return '`02`';
  if (place === 3) return '`03`';
  if (place >= 4 && place <= 99) return '`' + (place < 10 ? '0' + place : String(place)) + '`';
  return '`--`';
}

export function divider() {
  return '\u203A\u203A\u203A \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
}

export function phaseColor(phase) {
  if (phase && Object.prototype.hasOwnProperty.call(STATUS_COLOR, phase)) {
    return STATUS_COLOR[phase];
  }
  return STATUS_COLOR.notice;
}
