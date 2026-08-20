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
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildOverview, getRecap } from '../lib/dashboardData.js';

var __dirname = path.dirname(fileURLToPath(import.meta.url));

function getToken() {
  return process.env.DASHBOARD_TOKEN || '';
}

/**
 * Compare in constant time. A plain === leaks the length of the matching prefix
 * through timing, which is a slow but real way to recover a shared secret when
 * the endpoint is reachable from anywhere. Cheap to do properly, so do it.
 */
export function tokenMatches(given, expected) {
  var a = String(given == null ? '' : given);
  var b = String(expected == null ? '' : expected);
  if (!b) return false;
  // Hash both sides first so the buffers are always equal length: timingSafeEqual
  // throws on a length mismatch, and that throw is itself a length oracle.
  var ha = crypto.createHash('sha256').update(a).digest();
  var hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * Failed-attempt throttle, per client IP.
 *
 * One shared static token with unlimited guesses is brute forceable given enough
 * time, and there is no human to notice it happening. After MAX_FAILS bad
 * attempts inside the window the IP is locked out for LOCKOUT_MS. In memory on
 * purpose: this guards one small server, and a restart clearing it is fine.
 */
var MAX_FAILS = 8;
var WINDOW_MS = 10 * 60 * 1000;
var LOCKOUT_MS = 15 * 60 * 1000;
var attempts = new Map();

function clientKey(req) {
  return String((req && req.ip) || (req && req.socket && req.socket.remoteAddress) || 'unknown');
}

export function lockoutState(store, key, now) {
  var rec = store.get(key);
  if (!rec) return { locked: false, fails: 0 };
  if (rec.lockedUntil && rec.lockedUntil > now) return { locked: true, fails: rec.fails, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) };
  if (rec.lockedUntil && rec.lockedUntil <= now) { store.delete(key); return { locked: false, fails: 0 }; }
  if (now - rec.first > WINDOW_MS) { store.delete(key); return { locked: false, fails: 0 }; }
  return { locked: false, fails: rec.fails };
}

export function recordFailure(store, key, now) {
  var rec = store.get(key);
  if (!rec || now - rec.first > WINDOW_MS) rec = { first: now, fails: 0, lockedUntil: 0 };
  rec.fails++;
  if (rec.fails >= MAX_FAILS) rec.lockedUntil = now + LOCKOUT_MS;
  store.set(key, rec);
  // Opportunistic sweep so a hostile IP range cannot grow this map forever.
  if (store.size > 5000) {
    store.forEach(function(v, k) {
      if ((!v.lockedUntil || v.lockedUntil <= now) && now - v.first > WINDOW_MS) store.delete(k);
    });
  }
  return rec;
}

export function clearFailures(store, key) {
  store.delete(key);
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
  return tokenMatches(fromQuery, token) || tokenMatches(fromHeader, token) || tokenMatches(fromCookie, token);
}

/**
 * Gate every protected route through one place: throttle first, then auth, then
 * record the outcome. `onFail` renders whatever that route should return.
 */
function guard(req, res, onFail) {
  var now = Date.now();
  var key = clientKey(req);
  var state = lockoutState(attempts, key, now);
  if (state.locked) {
    res.setHeader('Retry-After', String(state.retryAfter || 900));
    res.status(429).type('text').send('Too many attempts. Try again later.');
    return false;
  }
  if (!authed(req)) {
    recordFailure(attempts, key, now);
    onFail();
    return false;
  }
  clearFailures(attempts, key);
  return true;
}

/**
 * Headers applied to every response.
 *
 * Referrer-Policy is the load bearing one: the token can arrive as ?k=, and
 * without this any outbound link from the page would hand that token to a third
 * party in the Referer header. no-store keeps the token URL and the board data
 * out of shared caches, and the frame headers stop the dashboard being embedded
 * and clickjacked into a restart or an action.
 */
function securityHeaders(req, res, next) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
}

// Only mark the cookie Secure when the request actually arrived over https,
// otherwise a plain-http tunnel or a local run would set a cookie the browser
// refuses to send back, and the dashboard would look permanently logged out.
function cookieFor(req, token) {
  var https = req.protocol === 'https'
    || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return 'bt_dash=' + encodeURIComponent(token)
    + '; HttpOnly; SameSite=Lax; Max-Age=2592000; Path=/'
    + (https ? '; Secure' : '');
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
  // Behind a tunnel or reverse proxy, req.ip is the proxy without this, which
  // would collapse every client into one bucket and let one bad actor lock the
  // whole crew out of the throttle.
  app.set('trust proxy', process.env.DASHBOARD_TRUST_PROXY ? Number(process.env.DASHBOARD_TRUST_PROXY) || 1 : false);
  app.use(securityHeaders);

  app.get('/health', function(req, res) { res.json({ ok: true }); });

  /**
   * Public usage docs, no token. Everything under docs/ is crew-facing
   * documentation and demo screenshots, and it MUST stay that way: this mount
   * hands the whole directory to anyone who can reach the server.
   *
   * OPERATIONS.md used to live here, which published the VM name, the GCP
   * project, every port and the exact ssh command to anyone who guessed the
   * path. It now lives in ops/, outside this tree. Internal runbooks go in
   * ops/, never in docs/. test/docs-public.test.js fails the build if that
   * slips again.
   */
  app.use('/docs', express.static(path.join(__dirname, '..', 'docs')));

  // Page. If ?k= is correct, set the cookie and redirect to a clean URL.
  app.get('/', function(req, res) {
    if (req.query && req.query.k) {
      if (!guard(req, res, function() {
        res.status(401).type('html').send(loginHtml('That token was not right.'));
      })) return;
      res.setHeader('Set-Cookie', cookieFor(req, token));
      // Preserve any other query params (e.g. ?demo=1) across the token redirect.
      var rest = Object.keys(req.query).filter(function(k) { return k !== 'k'; })
        .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(req.query[k]); }).join('&');
      res.redirect(rest ? '/?' + rest : '/');
      return;
    }
    if (!guard(req, res, function() {
      res.status(401).type('html').send(loginHtml(''));
    })) return;
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.get('/api/overview', async function(req, res) {
    if (!guard(req, res, function() { res.status(401).json({ error: 'unauthorized' }); })) return;
    try {
      var data = await buildOverview();
      res.json(data);
    } catch (e) {
      console.error('[dashboard] overview failed: ' + ((e && e.message) || e));
      res.status(500).json({ error: 'overview_failed', detail: (e && e.message) || String(e) });
    }
  });

  // Full recap for one meeting (lazy history expansion on the dashboard).
  app.get('/api/recap/:id', async function(req, res) {
    if (!guard(req, res, function() { res.status(401).json({ error: 'unauthorized' }); })) return;
    try {
      var recap = await getRecap(req.params.id);
      if (!recap) { res.status(404).json({ error: 'not_found' }); return; }
      res.json(recap);
    } catch (e) {
      console.error('[dashboard] recap failed: ' + ((e && e.message) || e));
      res.status(500).json({ error: 'recap_failed' });
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

function loginHtml(note) {
  var msg = note ? String(note).replace(/[<>&]/g, '') : 'Enter the dashboard token.';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex, nofollow">'
    + '<meta name="referrer" content="no-referrer">'
    + '<title>BrosephTech HQ</title><style>'
    + 'body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e17;color:#e6edf3;font-family:system-ui,sans-serif}'
    + '.box{background:#121826;border:1px solid #1f2a3c;border-radius:16px;padding:32px;max-width:360px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
    + 'h1{font-size:18px;margin:0 0 6px} p{color:#8b98ad;font-size:13px;margin:0 0 16px}'
    + 'input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #2a3850;background:#0a0e17;color:#e6edf3;margin-bottom:10px}'
    + 'button{width:100%;padding:10px;border:0;border-radius:10px;background:#5BA3DB;color:#04121f;font-weight:700;cursor:pointer}'
    + '</style></head><body><div class="box"><h1>BrosephTech HQ</h1><p>' + msg + '</p>'
    + '<form method="GET" action="/"><input name="k" type="password" placeholder="token" autofocus><button>Open dashboard</button></form>'
    + '</div></body></html>';
}
