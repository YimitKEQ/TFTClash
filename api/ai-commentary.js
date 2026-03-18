// Vercel serverless function — AI Commentary (proxies to Anthropic API)
// Requires: ANTHROPIC_API_KEY in Vercel env vars (NOT a VITE_ prefix)

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;
const attempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const prev = attempts.get(ip) ?? [];
  const recent = prev.filter(t => t > now - RATE_WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > RATE_MAX;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ text: 'The commentator stepped away from the desk. Check back after the next lobby.' });
  }

  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || prompt.length === 0 || prompt.length > 2000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || 'Commentary unavailable.';
    res.json({ text });
  } catch (err) {
    console.error('AI commentary error:', err.message);
    res.json({ text: 'The commentator stepped away from the desk. Check back after the next lobby.' });
  }
}
