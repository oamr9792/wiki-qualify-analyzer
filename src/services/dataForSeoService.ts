import { useState } from 'react';

// Use the proxied endpoint instead of direct server access
const API_ENDPOINT = '/api/search';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  position: number;
  type?: string;
  rank?: number;
  source?: string; // To differentiate organic vs news
  date?: string; // For news articles
}

interface SearchResponse {
  results: SearchResult[];
  newsResults: SearchResult[];
  totalCount: number;
  newsCount: number;
  isLoading: boolean;
  error: string | null;
  rawData?: any; // For debugging
}

// Simple helper to check if the server is running
const checkServerHealth = async () => {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const data = await response.json();
    console.log('Server health check successful:', data);
    return true;
  } catch (error) {
    console.error('Server health check failed:', error);
    throw new Error('Cannot connect to API server. Make sure the server is running with "npm run server"');
  }
};

export const useDataForSeoSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [newsResults, setNewsResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);

  const searchGoogle = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setResults([]);
    setNewsResults([]);
    
    try {
      // Check server health
      await checkServerHealth();
      
      console.log(`Making request to: ${API_ENDPOINT}`);
      
      // Make API requests through the Vite proxy
      const organicResponse = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: query,
          depth: 30,
          se_type: 'organic'
        }),
      });
      
      const newsResponse = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: query,
          depth: 20,
          se_type: 'news'
        }),
      });

      if (!organicResponse.ok || !newsResponse.ok) {
        throw new Error('Search API request failed');
      }

      const organicData = await organicResponse.json();
      const newsData = await newsResponse.json();
      
      // Store raw data for debugging
      setRawData({ organic: organicData, news: newsData });
      
      // Process organic results
      const organicResults = organicData.tasks?.[0]?.result?.[0]?.items || [];
      
      // Process news results
      const newsItems = newsData.tasks?.[0]?.result?.[0]?.items || [];
      console.log('News API raw items:', newsItems?.slice(0, 2));
      console.log('News API item types:', newsItems?.map(item => item.type));
      
      // Format the search results
      const formattedOrganic = organicResults
        .filter(item => item.type === 'organic')
        .map((item, index) => ({
          title: item.title,
          url: item.url,
          description: item.description || "No description available",
          position: index + 1,
          type: item.type,
          rank: item.rank_absolute || item.rank_group,
          source: 'organic'
        }));
        
      // Format the news results - handle multiple item types from Google News API
      const formattedNews = [];

      for (const item of newsItems) {
        // Handle top_stories item type which contains nested news items
        if (item.type === 'top_stories' && Array.isArray(item.items)) {
          item.items.forEach((storyItem, storyIndex) => {
            formattedNews.push({
              title: storyItem.title,
              url: storyItem.url,
              description: storyItem.source ? `Source: ${storyItem.source}` : "No description available",
              position: formattedNews.length + 1,
              type: 'news',
              rank: storyItem.rank_absolute || storyItem.rank_group || formattedNews.length + 1,
              source: 'news',
              date: storyItem.date || storyItem.timestamp
            });
          });
        } 
        // Handle news_search item type (standard news result)
        else if (item.type === 'news_search') {
          formattedNews.push({
            title: item.title,
            url: item.url,
            description: item.snippet || "No description available",
            position: formattedNews.length + 1,
            type: 'news',
            rank: item.rank_absolute || item.rank_group,
            source: 'news',
            date: item.time_published || item.timestamp
          });
        }
      }
      
      console.log(`Processed ${formattedNews.length} news items`);
      
      // Update state with formatted results
      setResults(formattedOrganic);
      setNewsResults(formattedNews);
      setTotalCount(formattedOrganic.length);
      setNewsCount(formattedNews.length);
      
      console.log(`Found ${formattedOrganic.length} organic results and ${formattedNews.length} news results`);
      
    } catch (error) {
      console.error('Error searching:', error);
      setError(error instanceof Error ? error.message : 'Failed to perform search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    results,
    newsResults,
    totalCount,
    newsCount,
    isLoading,
    error,
    rawData,
    searchGoogle
  };
}; 