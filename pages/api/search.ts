import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keyword, depth = 30, se_type = 'organic' } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
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
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch search results',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 