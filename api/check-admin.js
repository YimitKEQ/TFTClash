// Vercel serverless function — replaces the Supabase Edge Function
// Deploy: happens automatically when you push to Vercel
// Set ADMIN_PASSWORD in Vercel dashboard → Settings → Environment Variables
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { password } = req.body ?? {};
  const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminPw) return res.status(500).json({ isAdmin: false, error: 'ADMIN_PASSWORD not set' });
  res.json({ isAdmin: password === adminPw });
}
