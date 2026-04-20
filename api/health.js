// Vercel serverless function -- health check endpoint
// Returns build identity for rollback decisions and uptime monitoring.
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  var sha = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';
  var ref = process.env.VERCEL_GIT_COMMIT_REF || 'unknown';
  var env = process.env.VERCEL_ENV || 'unknown';

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
    sha: sha,
    ref: ref,
    env: env,
  });
}
