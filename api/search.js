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

    // Trimmed: credentials pasted into a dashboard commonly carry a trailing
    // newline or space, which produces an opaque 40100 from DataForSEO.
    const apiUsername = process.env.DATAFORSEO_API_USERNAME?.trim();
    const apiPassword = process.env.DATAFORSEO_API_PASSWORD?.trim();
    if (!apiUsername || !apiPassword) {
      return res.status(500).json({ error: 'DataForSEO credentials not configured' });
    }
    const credentials = Buffer.from(`${apiUsername}:${apiPassword}`).toString('base64');

    // Abort before the platform kills the function, so the client receives a
    // usable error instead of Vercel's opaque FUNCTION_INVOCATION_TIMEOUT.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    let response;
    try {
      response = await fetch(apiUrl, {
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
        ]),
        signal: controller.signal
      });
    } catch (fetchError) {
      if (fetchError?.name === 'AbortError') {
        return res.status(504).json({
          error: 'Search provider timed out',
          details: `DataForSEO did not respond within 45s for "${keyword}" (depth ${depth}).`
        });
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text();

      // 40100 is DataForSEO's auth rejection. Surface something actionable
      // rather than a raw JSON blob.
      if (response.status === 401 || text.includes('40100')) {
        return res.status(401).json({
          error: 'Search provider rejected the credentials',
          details:
            'DataForSEO returned "not authorized". The most common cause is using the ' +
            'account login password instead of the separate API password shown at ' +
            'app.dataforseo.com/api-access. Check that DATAFORSEO_API_USERNAME is the ' +
            'account email and DATAFORSEO_API_PASSWORD is the API password, then redeploy.'
        });
      }

      return res.status(response.status).json({ error: 'DataForSEO error', details: text });
    }

    const data = await response.json();

    // DataForSEO reports per-task failures inside a 200 response.
    const task = data?.tasks?.[0];
    if (task && task.status_code && task.status_code !== 20000) {
      return res.status(502).json({
        error: 'DataForSEO task failed',
        details: `${task.status_code}: ${task.status_message || 'unknown task error'}`
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch search results',
      details: error?.message || 'Unknown error'
    });
  }
}