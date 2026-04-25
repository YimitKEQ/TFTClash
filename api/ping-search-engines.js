// Vercel serverless function — pings IndexNow (Bing/Yandex) with all TFT Clash URLs
// Call this manually or set up a Vercel deploy hook to POST to /api/ping-search-engines
// Bing and Yandex both support IndexNow. Google recommends sitemap submission instead.

var INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
var SITE_DOMAIN = 'https://tftclash.com';

var URLS = [
  SITE_DOMAIN + '/',
  SITE_DOMAIN + '/leaderboard',
  SITE_DOMAIN + '/standings',
  SITE_DOMAIN + '/bracket',
  SITE_DOMAIN + '/results',
  SITE_DOMAIN + '/hall-of-fame',
  SITE_DOMAIN + '/events',
  SITE_DOMAIN + '/archive',
  SITE_DOMAIN + '/milestones',
  SITE_DOMAIN + '/challenges',
  SITE_DOMAIN + '/pricing',
  SITE_DOMAIN + '/rules',
  SITE_DOMAIN + '/faq',
  SITE_DOMAIN + '/signup',
  SITE_DOMAIN + '/tft-clash-weekly-tournament.html',
  SITE_DOMAIN + '/how-to-host-tft-tournament.html',
  SITE_DOMAIN + '/tft-tournament-points-system.html',
  SITE_DOMAIN + '/free-tft-tournament-platform.html',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var secret = process.env.PING_SECRET;
  if (!secret || req.headers['x-ping-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!INDEXNOW_KEY) {
    return res.status(503).json({ error: 'INDEXNOW_KEY not configured' });
  }

  var body = JSON.stringify({
    host: 'tftclash.com',
    key: INDEXNOW_KEY,
    keyLocation: SITE_DOMAIN + '/tftclash-indexnow.txt',
    urlList: URLS,
  });

  var results = {};

  // Ping Bing via IndexNow
  try {
    var bingRes = await fetch('https://www.bing.com/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body,
    });
    results.bing = bingRes.status;
  } catch (err) {
    results.bing = 'error: ' + err.message;
  }

  // Ping IndexNow API (picked up by multiple engines)
  try {
    var indexnowRes = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body,
    });
    results.indexnow = indexnowRes.status;
  } catch (err) {
    results.indexnow = 'error: ' + err.message;
  }

  console.log('[SEO] IndexNow ping results:', results);

  return res.status(200).json({
    ok: true,
    pinged: URLS.length + ' URLs',
    results: results,
    timestamp: new Date().toISOString(),
  });
}
