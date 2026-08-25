export default function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    api_credentials_available: Boolean(
      process.env.DATAFORSEO_API_USERNAME?.trim() && process.env.DATAFORSEO_API_PASSWORD?.trim()
    ),
    // Diagnostics only — never the values themselves. Length and shape are
    // enough to spot a truncated paste or the wrong field being used.
    credential_shape: {
      username_length: (process.env.DATAFORSEO_API_USERNAME || '').trim().length,
      username_looks_like_email: /.+@.+\..+/.test((process.env.DATAFORSEO_API_USERNAME || '').trim()),
      password_length: (process.env.DATAFORSEO_API_PASSWORD || '').trim().length,
      username_had_whitespace:
        (process.env.DATAFORSEO_API_USERNAME || '') !== (process.env.DATAFORSEO_API_USERNAME || '').trim(),
      password_had_whitespace:
        (process.env.DATAFORSEO_API_PASSWORD || '') !== (process.env.DATAFORSEO_API_PASSWORD || '').trim(),
      openai_key_present: Boolean(process.env.OPENAI_API_KEY?.trim())
    }
  });
}