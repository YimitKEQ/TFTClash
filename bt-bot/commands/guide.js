/**
 * /guide - how to use this bot, as a picture plus a walkthrough.
 *
 * No arguments posts the poster (docs/images/guide-card.png) with a dropdown to
 * drill into any one topic. `/guide topic:record` jumps straight there.
 *
 * The poster is a committed PNG rendered from docs/guide-card.html, not drawn
 * at runtime. Regenerate it with `npm run guide:render` after editing either
 * this file's TOPICS or the HTML, so the picture and the words never disagree.
 *
 * By default the guide is private to whoever asked, because a full-page poster
 * dumped into a busy channel is worse than useless. Pass share:true to post it
 * for everyone, which is what you want when onboarding somebody new.
 *
 * Copy rule: zero em or en dashes anywhere in user-facing strings.
 */

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from 'discord.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  BRAND,
  COLOR,
  DOT,
  MARK,
  baseEmbed,
  eyebrow,
} from '../lib/ui.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var POSTER_PATH = path.join(__dirname, '..', 'docs', 'images', 'guide-card.png');
var POSTER_NAME = 'brosephtech-guide.png';

// customId prefixes this command answers to (see the router in index.js).
export var componentIds = ['guide'];

/**
 * One entry per topic. `steps` is the walkthrough, `notes` is the small print
 * that saves a support question later. Keeping the copy here rather than in a
 * markdown file means the guide ships with the code that it documents.
 */
var TOPICS = [
  {
    id: 'start',
    label: 'Start here',
    blurb: 'The two minute version',
    color: COLOR.brand,
    summary: 'This bot does three jobs: it turns voice meetings into tasks, it keeps the board honest, and it tells you what needs a human today.',
    steps: [
      '**See your own work.** `/mytasks` is private and sorted worst first. It opens with the one card to pick up now.',
      '**See everything.** `/dashboard` posts the live command centre: what is late, who is behind, what shipped.',
      '**Record a meeting.** Join a voice channel, `/record start`, talk, `/record stop`. You get a recap and a task list to approve.',
      '**Close the loop.** `/card done` ships a card, `/card block` flags one that cannot move. Both work straight from Discord.',
    ],
    notes: [
      'Everything the bot posts about your own work is private to you unless it is a channel announcement.',
      'You never have to touch the web board to do your day. It is there when you want the wide view.',
    ],
  },
  {
    id: 'record',
    label: 'Recording a meeting',
    blurb: 'Voice to tasks, start to finish',
    color: COLOR.live,
    summary: 'The headline feature. Two commands in, a written recap and real tasks out. Your audio is sent to a hosted transcription service, then deleted.',
    steps: [
      '**Join a voice channel**, then run `/record start`. The bot joins muted and un-deafened.',
      '**Talk normally.** Every speaker is captured on their own track, so a long pause never truncates the call. `/record status` shows who it has heard so far.',
      '**Run `/record stop`.** Add `title:Weekly sync` if you want to name it. The tracks are uploaded, transcribed, and summarised, which takes under a minute for a normal meeting.',
      '**Tick the real tasks** in the dropdown and hit **Create selected**. Each one becomes a board card and a Jira issue, with links back.',
      'The full recap lands in the meetings channel with the complete transcript attached as a file.',
    ],
    notes: [
      'Nothing is recorded outside a `/record start` to `/record stop` window.',
      '**Your audio leaves the machine.** The recorded tracks are uploaded to a hosted speech to text service, then deleted. Only the text is kept. Our server is far too slow to do this locally: a 40 minute call would take about six hours.',
      'If you would rather a conversation was not uploaded, use `/meeting` with pasted notes instead. Same recap, same tasks, no audio sent.',
      '`/record jiracheck` verifies the Jira connection if issues stop being created.',
      'No AI key set means basic extraction: you still get tasks, just blunter ones.',
    ],
  },
  {
    id: 'board',
    label: 'Driving the board',
    blurb: 'Create, move, ship, block',
    color: COLOR.success,
    summary: 'Every card verb works from Discord. Start typing a card title and autocomplete finds it, so you never paste an id.',
    steps: [
      '`/card add` creates a card in Ideas with a department, owner, priority and optional due date.',
      '`/card done` moves it to Published. The win posts itself to the wins channel.',
      '`/card move` pushes it to any column. Moving a card restarts its staleness clock, so a card you just touched never reads as stuck.',
      '`/card block reason:...` flags it and records what it is waiting on. `/card unblock` clears it.',
      '`/card assign` hands it over. Unassigning is allowed, but nobody gets nudged about an unowned card.',
    ],
    notes: [
      'Autocomplete is filtered per verb: `/card done` only offers open cards, `/card unblock` only offers blocked ones.',
      'Every change shows up in the live feed within a second or two.',
    ],
  },
  {
    id: 'status',
    label: 'Reading the cards',
    blurb: 'What the dots mean',
    color: COLOR.warn,
    summary: 'Status is always carried by the same five glyphs, in every command. Learn them once.',
    steps: [
      DOT.danger + ' **Overdue.** The due date has passed and the card is not finished.',
      DOT.warn + ' **Gone quiet.** It has sat in the same column for five days or more without being touched.',
      DOT.soon + ' **Due soon.** Landing within two days.',
      DOT.ok + ' **Healthy.** Moving, on time, nothing wrong.',
      MARK.blocked + ' **Blocked.** It cannot move at all until somebody clears it. This always sorts first.',
    ],
    notes: [
      'The colour strip down the left of a card carries the same meaning: red needs you today, amber is a warning, green is fine.',
      'Dates render in your own timezone, so "in 2 days" means two days for you.',
    ],
  },
  {
    id: 'schedule',
    label: 'What runs on its own',
    blurb: 'The bot without being asked',
    color: COLOR.info,
    summary: 'Four scheduled jobs, so nothing rots quietly. All times are in the bot\'s configured timezone.',
    steps: [
      '**09:30 daily** standup: the verdict for the day, plus everything that needs a human, owners pinged.',
      '**12:00 daily** blocked sweep: every blocked card, with its owner tagged.',
      '**18:00 daily** nudge: a personal ping if, and only if, you have something overdue or gone quiet.',
      '**Monday 09:00** weekly digest: who shipped what, and where the board stands.',
    ],
    notes: [
      'Nudges are only sent to people who actually owe something. A clean week means silence.',
      '`/standup` and `/digest` post either one on demand if you need it now.',
    ],
  },
  {
    id: 'channels',
    label: 'Where things land',
    blurb: 'The HQ channel map',
    color: COLOR.neutral,
    summary: 'One category, every channel prefixed bt-. Run `/setup` to build them; it is safe to re-run and skips what already exists.',
    steps: [
      '`#bt-board` the heartbeat: every new card, ship and block as it happens.',
      '`#bt-standup` the daily standup and the Monday digest.',
      '`#bt-meetings` recaps from `/record` and `/meeting`, with the transcript attached.',
      '`#bt-blocked` blocked alerts and the noon sweep, owners pinged.',
      '`#bt-wins` anything that reaches published.',
      '`#bt-content`, `#bt-engineering`, `#bt-design`, `#bt-marketing`, `#bt-ops` for each department\'s own cards.',
    ],
    notes: [
      'A missing channel is skipped, never crashed on. If the feed goes quiet, run `/setup` and check the bot has Manage Channels.',
    ],
  },
];

var TOPIC_BY_ID = {};
TOPICS.forEach(function(t) { TOPIC_BY_ID[t.id] = t; });

// ---- rendering ---------------------------------------------------------------

function posterAttachment() {
  // A missing poster must never break the command: the words are the guide, the
  // picture is the nice part.
  try {
    if (!fs.existsSync(POSTER_PATH)) return null;
    return new AttachmentBuilder(POSTER_PATH, { name: POSTER_NAME });
  } catch (e) {
    console.warn('[guide] poster unavailable: ' + ((e && e.message) || e));
    return null;
  }
}

function overviewEmbed(hasPoster) {
  var embed = baseEmbed({
    color: COLOR.brand,
    author: BRAND.name + '  ' + MARK.arrow + '  guide',
    title: 'How to use this bot',
    description: BRAND.tagline + '.\n\nThe card below is the whole thing on one page. Pick a topic from the menu for a walkthrough of any one part.',
    footer: 'Pick a topic below  ' + MARK.arrow + '  /guide share:true posts this for the whole channel',
  });

  embed.addFields(
    { name: eyebrow('If you do one thing'), value: 'Run `/mytasks`. It is private, and it opens with the single card to pick up next.', inline: false },
    { name: eyebrow('If you run a meeting'), value: 'Join a voice channel and run `/record start`. Everything else follows from there.', inline: false }
  );

  if (hasPoster) embed.setImage('attachment://' + POSTER_NAME);
  return embed;
}

function topicEmbed(topic) {
  var embed = baseEmbed({
    color: topic.color,
    author: BRAND.name + '  ' + MARK.arrow + '  guide  ' + MARK.arrow + '  ' + topic.label.toLowerCase(),
    title: topic.label,
    description: topic.summary,
    footer: 'Pick another topic below',
  });

  embed.addFields({
    name: eyebrow(topic.id === 'status' ? 'The glyphs' : 'How it goes'),
    value: topic.steps.map(function(s, i) {
      // A numbered walkthrough only makes sense where order matters. Reference
      // lists (glyphs, channels) read better unnumbered.
      var ordered = topic.id !== 'status' && topic.id !== 'channels';
      return (ordered ? '**' + (i + 1) + '.** ' : '') + s;
    }).join('\n').slice(0, 1024),
  });

  if (topic.notes && topic.notes.length) {
    embed.addFields({
      name: eyebrow('Worth knowing'),
      value: topic.notes.map(function(n) { return MARK.arrow + ' ' + n; }).join('\n').slice(0, 1024),
    });
  }

  return embed;
}

function topicMenu(selectedId) {
  var select = new StringSelectMenuBuilder()
    .setCustomId('guide:topic')
    .setPlaceholder('Pick a topic')
    .addOptions(TOPICS.map(function(t) {
      return {
        label: t.label,
        description: t.blurb,
        value: t.id,
        default: t.id === selectedId,
      };
    }));
  return [new ActionRowBuilder().addComponents(select)];
}

// ---- command -----------------------------------------------------------------

export var data = new SlashCommandBuilder()
  .setName('guide')
  .setDescription('How to use this bot, with a one page cheat sheet')
  .addStringOption(function(opt) {
    opt.setName('topic').setDescription('Jump straight to one topic').setRequired(false);
    return opt.addChoices.apply(opt, TOPICS.map(function(t) { return { name: t.label, value: t.id }; }));
  })
  .addBooleanOption(function(opt) {
    return opt.setName('share').setDescription('Post it for everyone instead of just you (good for onboarding)').setRequired(false);
  });

export async function execute(interaction) {
  var share = interaction.options.getBoolean('share') === true;
  await interaction.deferReply({ ephemeral: !share });

  var topicId = interaction.options.getString('topic');
  if (topicId && TOPIC_BY_ID[topicId]) {
    await interaction.editReply({
      embeds: [topicEmbed(TOPIC_BY_ID[topicId])],
      components: topicMenu(topicId),
    });
    return;
  }

  var poster = posterAttachment();
  var payload = { embeds: [overviewEmbed(!!poster)], components: topicMenu(null) };
  if (poster) payload.files = [poster];
  await interaction.editReply(payload);
}

export async function handleComponent(interaction) {
  if (interaction.customId !== 'guide:topic') return;
  var topicId = (interaction.values && interaction.values[0]) || '';
  var topic = TOPIC_BY_ID[topicId];
  if (!topic) {
    await interaction.deferUpdate().catch(function() {});
    return;
  }
  // Swapping to a topic drops the poster attachment. Discord keeps an existing
  // attachment on edit unless told otherwise, so clear it explicitly rather
  // than leaving a full page image pinned above a short walkthrough.
  await interaction.update({
    embeds: [topicEmbed(topic)],
    components: topicMenu(topicId),
    files: [],
    attachments: [],
  }).catch(function(e) {
    console.warn('[guide] topic switch failed: ' + ((e && e.message) || e));
  });
}
