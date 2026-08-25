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

      const post = (body: Record<string, unknown>) =>
        fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

      // Issued in parallel. Awaiting these sequentially doubled wall-clock time
      // and was pushing the serverless function past its execution limit.
      const [organicResponse, newsResponse] = await Promise.all([
        post({ keyword: query, depth: 100, se_type: 'organic' }),
        post({ keyword: query, depth: 50, se_type: 'news' }),
      ]);

      const describeFailure = async (response: Response) => {
        try {
          const body = await response.json();
          if (body?.error) return body.details ? `${body.error} — ${body.details}` : body.error;
        } catch {
          /* response was not JSON; fall through to the status code */
        }
        return `HTTP ${response.status}`;
      };

      // Organic results are essential — without them there is nothing to assess.
      if (!organicResponse.ok) {
        throw new Error(await describeFailure(organicResponse));
      }

      const organicData = await organicResponse.json();

      // News is supplementary. A subject with no news coverage is a normal and
      // meaningful outcome, so a news failure must not discard a good organic
      // search — it is recorded as a warning and the analysis proceeds.
      let newsData: any = {};
      if (newsResponse.ok) {
        newsData = await newsResponse.json();
      } else {
        console.warn('News search failed; continuing with organic results only:', await describeFailure(newsResponse));
      }

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

      // Previously this fabricated two fake results — a Wikipedia URL built from
      // the query and "https://www.<query>.com" as an "official website". Those
      // were then scored as if they were real search results, so every failed
      // search silently produced a plausible-looking but invented analysis.
      //
      // Surfacing the failure is the only honest option: an analysis built on
      // invented sources is worse than no analysis.
      setResults([]);
      setNewsResults([]);
      setTotalCount(0);
      setNewsCount(0);
      setError(
        error instanceof Error
          ? `Search failed: ${error.message}`
          : 'Search failed for an unknown reason.',
      );
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
