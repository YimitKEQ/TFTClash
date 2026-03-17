// Vercel serverless function — health check endpoint
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
  });
}
