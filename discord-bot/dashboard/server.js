/**
 * dashboard/server.js — Express API for the TFT Clash bot dashboard.
 * Shares the live Discord.js client instance from the main process.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { EmbedBuilder } from 'discord.js';
import { getStandings, getSeasonConfig, getTournamentState, getRegistrations, getClashResults } from '../utils/data.js';
import { standingsEmbed, resultsEmbed, clashInfoEmbed, GOLD, PURPLE, TEAL } from '../utils/embeds.js';
import { postStandings, postReminder24h, postReminder1h } from '../scheduler.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── In-memory log buffer ────────────────────────────────────────────────────
var MAX_LOGS = 200;
var botLogs = [];
var startTime = Date.now();

function pushLog(level, message) {
  botLogs.push({ ts: new Date().toISOString(), level: level, message: message });
  if (botLogs.length > MAX_LOGS) botLogs.shift();
}

// Intercept console.log/error to also push to log buffer
var origLog = console.log;
var origError = console.error;
console.log = function() {
  var args = Array.prototype.slice.call(arguments);
  var msg = args.map(function(a) { return typeof a === 'string' ? a : JSON.stringify(a); }).join(' ');
  pushLog('info', msg);
  origLog.apply(console, arguments);
};
console.error = function() {
  var args = Array.prototype.slice.call(arguments);
  var msg = args.map(function(a) {
    if (a instanceof Error) return a.message;
    return typeof a === 'string' ? a : JSON.stringify(a);
  }).join(' ');
  pushLog('error', msg);
  origError.apply(console, arguments);
};

/**
 * Start the dashboard Express server.
 * @param {import('discord.js').Client} client - Live Discord.js client
 */
export function startDashboard(client) {
  var app = express();
  var port = parseInt(process.env.DASHBOARD_PORT) || 3737;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Helper to get the guild
  function getGuild() {
    return client.guilds.cache.get(process.env.GUILD_ID);
  }

  // ─── GET /api/status ─────────────────────────────────────────────────────────
  app.get('/api/status', async function(req, res) {
    try {
      var guild = getGuild();
      var ts = await getTournamentState();
      var season = await getSeasonConfig();
      var regs = await getRegistrations();
      res.json({
        bot: {
          tag: client.user ? client.user.tag : 'Unknown',
          status: client.ws.status === 0 ? 'online' : 'reconnecting',
          uptime: Date.now() - startTime,
          ping: client.ws.ping,
        },
        guild: guild ? {
          name: guild.name,
          memberCount: guild.memberCount,
          channelCount: guild.channels.cache.size,
          id: guild.id,
        } : null,
        tournament: ts ? {
          phase: ts.phase,
          clashNumber: ts.clashNumber,
          clashDate: ts.clashDate,
          clashTime: ts.clashTime,
          registeredCount: regs.length,
        } : null,
        season: season,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/channels ───────────────────────────────────────────────────────
  app.get('/api/channels', function(req, res) {
    var guild = getGuild();
    if (!guild) return res.json([]);
    var channels = guild.channels.cache
      .filter(function(c) { return c.type === 0; }) // GuildText
      .map(function(c) {
        return {
          id: c.id,
          name: c.name,
          category: c.parent ? c.parent.name : null,
        };
      })
      .sort(function(a, b) { return a.name.localeCompare(b.name); });
    res.json(channels);
  });

  // ─── GET /api/standings ──────────────────────────────────────────────────────
  app.get('/api/standings', async function(req, res) {
    try {
      var players = await getStandings(20);
      var season = await getSeasonConfig();
      res.json({ players: players, season: season });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/registrations ──────────────────────────────────────────────────
  app.get('/api/registrations', async function(req, res) {
    try {
      var regs = await getRegistrations();
      var ts = await getTournamentState();
      res.json({ registrations: regs, clashNumber: ts ? ts.clashNumber : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/logs ───────────────────────────────────────────────────────────
  app.get('/api/logs', function(req, res) {
    var since = req.query.since || null;
    var logs = since
      ? botLogs.filter(function(l) { return l.ts > since; })
      : botLogs.slice(-100);
    res.json(logs);
  });

  // ─── POST /api/announce ──────────────────────────────────────────────────────
  app.post('/api/announce', async function(req, res) {
    try {
      var channelId = req.body.channelId;
      var title = req.body.title || '';
      var message = req.body.message || '';
      var mention = req.body.mention || 'none';

      if (!channelId || !message) {
        return res.status(400).json({ error: 'channelId and message are required' });
      }

      var guild = getGuild();
      var channel = guild ? guild.channels.cache.get(channelId) : null;
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      var embed = new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(title || '📣 Announcement')
        .setDescription(message)
        .setFooter({ text: 'TFT Clash' })
        .setTimestamp();

      var content = mention === 'everyone' ? '@everyone' : mention === 'here' ? '@here' : undefined;
      await channel.send({ content: content, embeds: [embed] });

      console.log('[dashboard] Announcement sent to #' + channel.name);
      res.json({ ok: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/results ───────────────────────────────────────────────────────
  app.post('/api/results', async function(req, res) {
    try {
      var clashNumber = req.body.clashNumber;
      var placements = req.body.placements;

      if (!clashNumber || !placements || !placements.length) {
        return res.status(400).json({ error: 'clashNumber and placements are required' });
      }

      var embed = resultsEmbed(clashNumber, placements);

      var guild = getGuild();
      var resultsCh = guild ? guild.channels.cache.find(function(c) { return c.name === 'results'; }) : null;
      if (resultsCh) {
        await resultsCh.send({ embeds: [embed] });
      }

      console.log('[dashboard] Results posted for Clash #' + clashNumber);
      res.json({ ok: true, channel: resultsCh ? resultsCh.name : null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/send ──────────────────────────────────────────────────────────
  app.post('/api/send', async function(req, res) {
    try {
      var channelId = req.body.channelId;
      var content = req.body.content;

      if (!channelId || !content) {
        return res.status(400).json({ error: 'channelId and content are required' });
      }

      var guild = getGuild();
      var channel = guild ? guild.channels.cache.get(channelId) : null;
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      await channel.send(content);
      console.log('[dashboard] Message sent to #' + channel.name + ': ' + content.substring(0, 50));
      res.json({ ok: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/trigger ──────────────────────────────────────────────────────
  app.post('/api/trigger', async function(req, res) {
    try {
      var job = req.body.job;
      var jobs = {
        standings: postStandings,
        reminder24h: postReminder24h,
        reminder1h: postReminder1h,
      };

      if (!jobs[job]) {
        return res.status(400).json({ error: 'Unknown job. Available: standings, reminder24h, reminder1h' });
      }

      var result = await jobs[job](client);
      console.log('[dashboard] Triggered job: ' + job);
      res.json({ ok: true, job: job, result: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/embed ─────────────────────────────────────────────────────────
  // Send a custom embed to any channel
  app.post('/api/embed', async function(req, res) {
    try {
      var channelId = req.body.channelId;
      var title = req.body.title || '';
      var description = req.body.description || '';
      var color = req.body.color || 'purple';
      var mention = req.body.mention || 'none';

      if (!channelId || !description) {
        return res.status(400).json({ error: 'channelId and description are required' });
      }

      var colors = { purple: PURPLE, gold: GOLD, teal: TEAL, red: 0xC0392B };
      var guild = getGuild();
      var channel = guild ? guild.channels.cache.get(channelId) : null;
      if (!channel) return res.status(404).json({ error: 'Channel not found' });

      var embed = new EmbedBuilder()
        .setColor(colors[color] || PURPLE)
        .setDescription(description)
        .setFooter({ text: 'TFT Clash' })
        .setTimestamp();

      if (title) embed.setTitle(title);

      var content = mention === 'everyone' ? '@everyone' : mention === 'here' ? '@here' : undefined;
      await channel.send({ content: content, embeds: [embed] });

      console.log('[dashboard] Custom embed sent to #' + channel.name);
      res.json({ ok: true, channel: channel.name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Fallback to index.html ──────────────────────────────────────────────────
  app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  var server = app.listen(port, function() {
    console.log('[dashboard] http://localhost:' + port);
  });
  server.on('error', function(err) {
    if (err.code === 'EADDRINUSE') {
      console.error('[dashboard] Port ' + port + ' already in use. Dashboard disabled. Kill the other process or set DASHBOARD_PORT in .env');
    } else {
      console.error('[dashboard] Server error:', err.message);
    }
  });
}
