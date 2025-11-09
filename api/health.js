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
    api_credentials_available: Boolean(process.env.DATAFORSEO_API_USERNAME && process.env.DATAFORSEO_API_PASSWORD)
  });
}