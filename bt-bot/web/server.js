/**
 * server.js - the BrosephTech browser dashboard.
 *
 * A tiny self-contained web server started by the bot. Serves one dark,
 * auto-refreshing dashboard page and a JSON API, both reading the shared board
 * via the bot's Supabase service role (read-only). Token protected so it can be
 * safely tunneled to the crew.
 *
 * Enable by setting DASHBOARD_TOKEN in .env. Optional:
 *   DASHBOARD_PORT  default 8787
 *   DASHBOARD_HOST  default 127.0.0.1 (set 0.0.0.0 to expose for a tunnel)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildOverview } from '../lib/dashboardData.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

function getToken() {
  return process.env.DASHBOARD_TOKEN || '';
}

// Accept the token from a cookie, the Authorization header, or ?k= (which then
// sets the cookie so refreshes work without keeping it in the URL).
function authed(req) {
  var token = getToken();
  if (!token) return false;
  var fromQuery = req.query && req.query.k ? String(req.query.k) : '';
  var fromHeader = req.headers && req.headers.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, '') : '';
  var fromCookie = '';
  var cookie = req.headers && req.headers.cookie ? req.headers.cookie : '';
  var m = cookie.match(/(?:^|;\s*)bt_dash=([^;]+)/);
  if (m) fromCookie = decodeURIComponent(m[1]);
  return fromQuery === token || fromHeader === token || fromCookie === token;
}

export function startDashboard() {
  var token = getToken();
  if (!token) {
    console.log('[dashboard] DASHBOARD_TOKEN not set - browser dashboard disabled.');
    return null;
  }
  if (token.length < 8) {
    console.warn('[dashboard] DASHBOARD_TOKEN is very short; use a long random string.');
  }

  var port = parseInt(process.env.DASHBOARD_PORT, 10) || 8787;
  var host = process.env.DASHBOARD_HOST || '127.0.0.1';

  var app = express();
  app.disable('x-powered-by');

  app.get('/health', function(req, res) { res.json({ ok: true }); });

  // Public usage docs (no token - documentation + demo screenshots only, no
  // real board data). Served at /docs.
  app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

  // Page. If ?k= is correct, set the cookie and redirect to a clean URL.
  app.get('/', function(req, res) {
    if (req.query && req.query.k && String(req.query.k) === token) {
      res.setHeader('Set-Cookie', 'bt_dash=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/');
      // Preserve any other query params (e.g. ?demo=1) across the token redirect.
      var rest = Object.keys(req.query).filter(function(k) { return k !== 'k'; })
        .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(req.query[k]); }).join('&');
      res.redirect(rest ? '/?' + rest : '/');
      return;
    }
    if (!authed(req)) {
      res.status(401).type('html').send(loginHtml());
      return;
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/api/overview', async function(req, res) {
    if (!authed(req)) { res.status(401).json({ error: 'unauthorized' }); return; }
    try {
      var data = await buildOverview();
      res.json(data);
    } catch (e) {
      console.error('[dashboard] overview failed: ' + ((e && e.message) || e));
      res.status(500).json({ error: 'overview_failed', detail: (e && e.message) || String(e) });
    }
  });

  var server = app.listen(port, host, function() {
    console.log('[dashboard] live at http://' + host + ':' + port + '/?k=YOUR_TOKEN');
  });
  server.on('error', function(e) {
    console.error('[dashboard] could not start on ' + host + ':' + port + ' - ' + ((e && e.message) || e));
  });
  return server;
}

// Public base URL used by the Discord /dashboard command to link out.
export function dashboardUrl() {
  if (!getToken()) return null;
  if (process.env.DASHBOARD_PUBLIC_URL) return process.env.DASHBOARD_PUBLIC_URL;
  var port = parseInt(process.env.DASHBOARD_PORT, 10) || 8787;
  var host = process.env.DASHBOARD_HOST || '127.0.0.1';
  return 'http://' + host + ':' + port + '/';
}

function loginHtml() {
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>BrosephTech HQ</title><style>'
    + 'body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e17;color:#e6edf3;font-family:system-ui,sans-serif}'
    + '.box{background:#121826;border:1px solid #1f2a3c;border-radius:16px;padding:32px;max-width:360px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
    + 'h1{font-size:18px;margin:0 0 6px} p{color:#8b98ad;font-size:13px;margin:0 0 16px}'
    + 'input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #2a3850;background:#0a0e17;color:#e6edf3;margin-bottom:10px}'
    + 'button{width:100%;padding:10px;border:0;border-radius:10px;background:#5BA3DB;color:#04121f;font-weight:700;cursor:pointer}'
    + '</style></head><body><div class="box"><h1>BrosephTech HQ</h1><p>Enter the dashboard token.</p>'
    + '<form method="GET" action="/"><input name="k" type="password" placeholder="token" autofocus><button>Open dashboard</button></form>'
    + '</div></body></html>';
}
