import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Hardcoded credentials
  const apiUsername = 'orani@reputationcitadel.com';
  const apiPassword = '01299217bfd31b0b';
  
  res.status(200).json({ 
    status: 'ok', 
    message: 'API is running',
    timestamp: new Date().toISOString(),
    api_credentials_available: true // We know they're available
  });
} 