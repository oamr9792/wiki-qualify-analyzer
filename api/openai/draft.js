import { rateLimit } from '../_utils/rateLimit.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = rateLimit(req);
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests' });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

    // Vercel functions parse JSON into req.body; on some adapters, it’s req.body already
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { query, sources } = body;

    if (!query || !Array.isArray(sources)) {
      return res.status(400).json({ error: 'Missing query or sources' });
    }

    const sourcesList = sources.map(s => `- ${s.domain} (${s.category}): ${s.url}`).join('\n');

    const systemPrompt =
      'You are a professional Wikipedia editor. Write neutral, well-sourced content. Use numbered footnotes like [1], [2]. Include a References section with matching numbers.';

    const userPrompt = `Using only the sources below, write a draft Wikipedia-style article about "${query}".
Key requirements:
1) Use numbered footnotes [1], [2] inline for every factual claim
2) Neutral tone, follow WP:NPOV and WP:V
3) Include a "References" section listing the sources with matching numbers
4) Markdown headings only

Sources:
${sourcesList}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'OpenAI error', details: text });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate draft', details: err?.message });
  }
}

