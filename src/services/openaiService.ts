/**
 * Client-side wrapper that calls our serverless OpenAI draft endpoint.
 * No API keys on the client.
 */
export const generateWikipediaDraftWithOpenAI = async (
  query: string,
  sources: { domain: string; category: string; url: string }[]
): Promise<string> => {
  const res = await fetch('/api/openai/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, sources })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI draft failed: ${text}`);
  }

  const data = await res.json();
  return data.content as string;
};

// Backward compat export
export const generateWikipediaDraftOpenAI = generateWikipediaDraftWithOpenAI;