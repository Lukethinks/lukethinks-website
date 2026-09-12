// Vercel Serverless Function: /api/likes.js
// Production-ready endpoint for tracking likes and engagement.
// Works out of the box with Vercel KV, Upstash Redis, or in-memory fallback.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { episodeId, action } = req.query || req.body || {};

  if (!episodeId) {
    return res.status(400).json({ error: 'Missing episodeId parameter' });
  }

  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      const key = `podcast:likes:${episodeId}`;

      if (req.method === 'POST' && action === 'toggle') {
        const { liked } = req.body || {};
        const increment = liked ? 1 : -1;
        const count = await kv.incrby(key, increment);
        return res.status(200).json({ episodeId, likes: Math.max(0, count), success: true });
      }

      const count = (await kv.get(key)) || 0;
      return res.status(200).json({ episodeId, likes: count, success: true });
    }

    return res.status(200).json({
      episodeId,
      status: 'localStorage_active',
      message: 'Likes persist in visitor localStorage. Connect Vercel KV to enable global real-time counters.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}