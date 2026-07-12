/**
 * gf-perms-check.js - verify the 👑 GRAND FINAL lounge actually grants VIEW
 * access to all 8 finalists (not just that the category/channels exist).
 */
import { Client, GatewayIntentBits, PermissionFlagsBits, Partials } from 'discord.js';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FINALISTS = [
  { name: 'wondeR', id: '246959391335645184' }, { name: 'yatora1', id: '1000625185289932843' },
  { name: 'Sacred Norris', id: '566547566364327956' }, { name: 'RavingRaven', id: '455447266023571457' },
  { name: 'Lynx', id: '186851013817401346' }, { name: 'Nike3', id: '136065430799384577' },
  { name: 'PortugueseBabe', id: '910857189105758239' }, { name: 'magoose', id: '257509468298936330' },
];

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers], partials: [Partials.Channel] });
  await client.login(process.env.DISCORD_TOKEN);
  await new Promise(function(res) { client.once('ready', res); });
  const guild = await client.guilds.fetch(process.env.GUILD_ID).then(function(g) { return g.fetch(); });
  await guild.channels.fetch();
  var general = guild.channels.cache.get('1525596870078894320') // category
    ? guild.channels.cache.find(function(c) { return c.parentId === '1525596870078894320' && c.name.indexOf('general') !== -1; })
    : null;
  if (!general) { console.log('general channel not found'); process.exit(1); }
  for (var i = 0; i < FINALISTS.length; i++) {
    var f = FINALISTS[i];
    var member = await guild.members.fetch(f.id).catch(function() { return null; });
    if (!member) { console.log(f.name + ': NOT a guild member'); continue; }
    var perms = general.permissionsFor(member);
    console.log(f.name + ': can view=' + perms.has(PermissionFlagsBits.ViewChannel) + ' can send=' + perms.has(PermissionFlagsBits.SendMessages));
  }
  await client.destroy();
  process.exit(0);
}
main().catch(function(e) { console.error('FATAL:', e); process.exit(1); });
