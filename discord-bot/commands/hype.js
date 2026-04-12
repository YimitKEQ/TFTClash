import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getTournamentState, getRegistrations, getStandings } from '../utils/data.js';

var GOLD = 0xE8A838;
var RED = 0xC0392B;
var TEAL = 0x4ECDC4;

var HYPE_QUOTES = [
  'The lobby is loading. Are you?',
  'Somewhere out there, someone is practicing their pivot. Be that someone.',
  'Today we find out who is built different.',
  'Your board. Your comp. Your moment.',
  '8 players enter. 1 walks out with 8 points.',
  'Fortune favors the bold. And the ones who actually scout.',
  'Econ is temporary. First place is forever.',
  'Remember: every loss streak is just a win streak in disguise.',
  'No pressure. Just the entire leaderboard watching.',
  'Play your game. Trust your reads. Send it.',
  'The only thing between you and first place is 7 other players.',
  'Lobby diff? Nah. Player diff.',
  'Stage 4 is where legends are born and boards are broken.',
  'You miss 100% of the pivots you do not take.',
  'Keep calm and roll at 8.',
  'They are going to write about this clash. Make sure you are the headline.',
  'Fast 8 or die trying.',
  'The carousel does not care about your feelings.',
  'Augment diff is just a myth. Right?',
  'Every top 4 starts with a plan. Every first place starts with chaos.',
];

var TRASH_TALK = [
  'GL HF (you will need the luck part)',
  'Imagine losing to someone who only plays reroll comps',
  'I do not always win, but when I do, it is convincingly',
  'My Stage 2 board has more value than your Stage 5',
  'Scouting is for people who need to scout. I just win.',
  'I have seen your match history. Brave of you to show up.',
  'First place or it did not happen.',
  'Your econ is my rolling gold.',
  'They call me the item holder because I never let go of first.',
  'If you are reading this, I am already on your lobby. GG.',
];

var FUN_FACTS = [
  'The average TFT Clash winner scouts at least 3 times per stage.',
  'Players who hit level 8 before 4-1 win 40% more often in our data.',
  'The most popular winning comp last season had 3+ frontline units.',
  'Loss streaking Stage 2 has a 35% higher top 4 rate than win streaking in TFT Clash.',
  'The longest win streak in TFT Clash history is 6 consecutive first places.',
  'Exactly 12.5% of players get first place in any given game. Math checks out.',
  'The most common placement is 4th. The hero placement.',
  'Players who link their Discord account perform 15% better on average. Coincidence?',
];

export var data = new SlashCommandBuilder()
  .setName('hype')
  .setDescription('Get hyped for clash day with random quotes, trash talk, and fun facts')
  .addStringOption(function(opt) {
    return opt
      .setName('type')
      .setDescription('What kind of hype?')
      .setRequired(false)
      .addChoices(
        { name: 'motivational', value: 'hype' },
        { name: 'trash talk', value: 'trash' },
        { name: 'fun fact', value: 'fact' }
      );
  });

export async function execute(interaction) {
  var type = interaction.options.getString('type');

  // If no type, pick random category
  if (!type) {
    var types = ['hype', 'trash', 'fact'];
    type = types[Math.floor(Math.random() * types.length)];
  }

  var quote, title, color, footer;

  if (type === 'hype') {
    quote = HYPE_QUOTES[Math.floor(Math.random() * HYPE_QUOTES.length)];
    title = 'Clash Day Energy';
    color = GOLD;
    footer = 'TFT Clash - Let them know';
  } else if (type === 'trash') {
    quote = TRASH_TALK[Math.floor(Math.random() * TRASH_TALK.length)];
    title = 'Trash Talk Activated';
    color = RED;
    footer = 'TFT Clash - All in good fun';
  } else {
    quote = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
    title = 'Did you know?';
    color = TEAL;
    footer = 'TFT Clash - The more you know';
  }

  // Add some context about the upcoming clash if there is one
  var extra = '';
  try {
    var ts = await getTournamentState();
    if (ts && ts.phase === 'registration') {
      var regs = await getRegistrations();
      extra = '\n\n*Clash #' + ts.clashNumber + ' has ' + regs.length + ' registered. Are you in?*';
    } else if (ts && ts.phase === 'inprogress') {
      extra = '\n\n*Clash #' + ts.clashNumber + ' is LIVE right now!*';
    }
  } catch (e) {
    // no context, that is fine
  }

  var embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription('> *' + quote + '*' + extra)
    .setFooter({ text: footer })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
