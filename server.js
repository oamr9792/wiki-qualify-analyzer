import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Add a specific CORS pre-flight handler
app.options('*', cors());

app.use(express.json());

// DataForSEO API credentials
const API_USERNAME = process.env.DATAFORSEO_API_USERNAME || process.env.VITE_DATAFORSEO_LOGIN;
const API_PASSWORD = process.env.DATAFORSEO_API_PASSWORD || process.env.VITE_DATAFORSEO_PASSWORD;
const BASE_URL = "https://api.dataforseo.com/v3";

// Check if credentials are available and print them partially for debugging
if (!API_USERNAME || !API_PASSWORD) {
  console.error('ERROR: DataForSEO API credentials not found in environment variables');
} else {
  console.log(`Using credentials: ${API_USERNAME.substring(0, 3)}...`);
}

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      node_version: process.version,
      credentials_available: !!API_USERNAME && !!API_PASSWORD,
    }
  });
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Generic DataForSEO search function
async function dataForSeoSearch(endpoint, payload) {
  try {
    console.log(`Sending request to: ${endpoint}`);
    console.log('Payload:', JSON.stringify(payload));
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([payload])
    });
    
    if (!response.ok) {
      throw new Error(`DataForSEO API responded with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in DataForSEO request:', error);
    throw error;
  }
}

// Proxy endpoint for DataForSEO organic searches
app.post('/api/search/organic', async (req, res) => {
  try {
    const { query, location_code = "2840", depth = 20 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    console.log(`Processing organic search request for: "${query}"`);
    
    const payload = {
      "language_code": "en",
      "location_code": location_code,
      "keyword": query,
      "calculate_rectangles": false,
      "depth": depth,
      "device": "desktop",
      "os": "windows"
    };
    
    const data = await dataForSeoSearch('/serp/google/organic/live/regular', payload);
    console.log(`Response received for "${query}". Status code: ${data.status_code}`);
    
    res.json(data);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
  }
});

// Proxy endpoint for DataForSEO news searches
app.post('/api/search/news', async (req, res) => {
  try {
    const { query, location_code = "2840", depth = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    console.log(`Processing news search request for: "${query}"`);
    
    const payload = {
      "language_code": "en",
      "location_code": location_code,
      "keyword": query,
      "calculate_rectangles": false,
      "depth": depth,
      "device": "desktop",
      "os": "windows"
    };
    
    const data = await dataForSeoSearch('/serp/google/news/live/advanced', payload);
    console.log(`News response received for "${query}". Status code: ${data.status_code}`);
    
    res.json(data);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
  }
});

// Combined search endpoint
app.post('/api/search', async (req, res) => {
  const { keyword, depth = 30, se_type = 'organic' } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    const apiUrl = se_type === 'news' 
      ? 'https://api.dataforseo.com/v3/serp/google/news/live/advanced'
      : 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced';
    
    const response = await axios.post(
      apiUrl,
      [{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: keyword,
        depth: depth,
        search_param: se_type === 'news' ? 'tbm=nws' : undefined
      }],
      {
        auth: {
          username: API_USERNAME,
          password: API_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`DataForSEO ${se_type} API response received for "${keyword}"`);
    
    return res.status(200).json(response.data);
    
  } catch (error) {
    console.error('API error:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch search results',
      details: error.response?.data || error.message
    });
  }
});

// Improved health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint called');
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    api_credentials_available: !!API_USERNAME && !!API_PASSWORD
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Try accessing the server at http://localhost:${PORT}/api/debug`);
}); 