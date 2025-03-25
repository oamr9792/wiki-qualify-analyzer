export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle preflight requests for CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Regular POST handling
  try {
    const { keyword, depth = 30, se_type = 'organic' } = req.body || {};

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const apiUrl = se_type === 'news' 
      ? 'https://api.dataforseo.com/v3/serp/google/news/live/advanced'
      : 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
    
    // Hardcoded credentials as requested
    const apiUsername = 'orani@reputationcitadel.com';
    const apiPassword = '01299217bfd31b0b';
    
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
          keyword: keyword,
          depth: depth,
          search_param: se_type === 'news' ? 'tbm=nws' : undefined
        }
      ])
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `API request failed with status ${response.status}`,
        details: await response.text()
      });
    }
    
    const data = await response.json();
    
    // Set CORS headers for the API response
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch search results',
      details: error.message || 'Unknown error'
    });
  }
} 