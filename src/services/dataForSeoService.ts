import { useState } from 'react';

const API_ENDPOINT = '/api/search';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  position: number;
  type?: string;
  rank?: number;
  source?: string;
  date?: string;
}

const checkServerHealth = async () => {
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      console.warn('Health check returned non-200 status:', response.status);
      return;
    }
    const data = await response.json();
    if (!data.api_credentials_available) {
      throw new Error('API credentials not configured');
    }
  } catch (error) {
    console.warn('Server health check warning:', error);
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
      try {
        await checkServerHealth();
      } catch (healthError) {
        console.warn('Health check error, continuing anyway:', healthError);
      }

      console.log(`Making request to: ${API_ENDPOINT}`);

      // Increased depth: 100 organic + 50 news for wider source coverage
      const organicResponse = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: query,
          depth: 100,
          se_type: 'organic'
        }),
      });

      const newsResponse = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: query,
          depth: 50,
          se_type: 'news'
        }),
      });

      if (!organicResponse.ok || !newsResponse.ok) {
        throw new Error('Search API request failed');
      }

      const organicData = await organicResponse.json();
      const newsData = await newsResponse.json();

      setRawData({ organic: organicData, news: newsData });

      const organicItems = organicData.tasks?.[0]?.result?.[0]?.items || [];
      const newsItems = newsData.tasks?.[0]?.result?.[0]?.items || [];

      console.log('Total organic items from API:', organicItems.length);
      console.log('Total news items from API:', newsItems.length);

      const formattedOrganic = organicItems
        .filter((item: any) => item.type === 'organic')
        .map((item: any, index: number) => ({
          title: item.title || '',
          url: item.url || '',
          description: item.description || 'No description available',
          position: index + 1,
          type: item.type,
          rank: item.rank_absolute || item.rank_group,
          source: 'organic'
        }));

      const formattedNews: SearchResult[] = [];

      for (const item of newsItems) {
        if (item.type === 'top_stories' && Array.isArray(item.items)) {
          item.items.forEach((storyItem: any) => {
            formattedNews.push({
              title: storyItem.title || '',
              url: storyItem.url || '',
              description: storyItem.source ? `Source: ${storyItem.source}` : 'No description available',
              position: formattedNews.length + 1,
              type: 'news',
              rank: storyItem.rank_absolute || storyItem.rank_group || formattedNews.length + 1,
              source: 'news',
              date: storyItem.date || storyItem.timestamp
            });
          });
        } else if (item.type === 'news_search') {
          formattedNews.push({
            title: item.title || '',
            url: item.url || '',
            description: item.snippet || 'No description available',
            position: formattedNews.length + 1,
            type: 'news',
            rank: item.rank_absolute || item.rank_group,
            source: 'news',
            date: item.time_published || item.timestamp
          });
        }
      }

      console.log(`Processed ${formattedOrganic.length} organic results and ${formattedNews.length} news results`);

      setResults(formattedOrganic);
      setNewsResults(formattedNews);
      setTotalCount(formattedOrganic.length);
      setNewsCount(formattedNews.length);

    } catch (error) {
      console.error('Error searching:', error);

      // Fallback mock results
      const mockResults: SearchResult[] = [
        {
          title: `${query} - Wikipedia`,
          url: `https://en.wikipedia.org/wiki/${query.replace(/\s+/g, '_')}`,
          description: `Information about ${query} from Wikipedia, the free encyclopedia.`,
          position: 1,
          type: 'organic',
          source: 'organic'
        },
        {
          title: `About ${query} - Official Website`,
          url: `https://www.${query.toLowerCase().replace(/\s+/g, '')}.com`,
          description: `Official website for ${query}. Learn more about our services and history.`,
          position: 2,
          type: 'organic',
          source: 'organic'
        },
      ];

      setResults(mockResults);
      setNewsResults([]);
      setTotalCount(mockResults.length);
      setNewsCount(0);
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
