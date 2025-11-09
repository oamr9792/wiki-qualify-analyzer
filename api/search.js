import { rateLimit } from './_utils/rateLimit.js';

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = rateLimit(req);
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests' });

  try {
    const { keyword, depth = 30, se_type = 'organic' } = (req.body || {});
    if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

    const apiUrl = se_type === 'news'
      ? 'https://api.dataforseo.com/v3/serp/google/news/live/advanced'
      : 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';

    const apiUsername = process.env.DATAFORSEO_API_USERNAME;
    const apiPassword = process.env.DATAFORSEO_API_PASSWORD;
    if (!apiUsername || !apiPassword) {
      return res.status(500).json({ error: 'DataForSEO credentials not configured' });
    }
    const credentials = Buffer.from(`${apiUsername}:${apiPassword}`).toString('base64');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify([
        {
          language_code: 'en',
          location_code: 2840, // United States
          keyword,
          depth,
          search_param: se_type === 'news' ? 'tbm=nws' : undefined
        }
      ])
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'DataForSEO error', details: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch search results',
      details: error?.message || 'Unknown error'
    });
  }
}