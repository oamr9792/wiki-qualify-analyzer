import { useState } from 'react';
import type { SearchResult } from './dataForSeoService';

// Mock data
const MOCK_ORGANIC_RESULTS: SearchResult[] = [
  {
    title: "Wikipedia - Eylon Levy",
    url: "https://en.wikipedia.org/wiki/Eylon_Levy",
    description: "Eylon Levy is an Israeli spokesperson, journalist and political advisor...",
    position: 1,
    source: 'organic',
    type: 'organic'
  },
  {
    title: "The Guardian - Eylon Levy profile",
    url: "https://www.theguardian.com/world/2023/dec/04/who-is-eylon-levy-israel-government-spokesperson",
    description: "Who is Eylon Levy? The government spokesperson emerging as the face of Israel's war...",
    position: 2,
    source: 'organic',
    type: 'organic'
  },
  // Add more mock results here
];

const MOCK_NEWS_RESULTS: SearchResult[] = [
  {
    title: "Israeli spokesperson Eylon Levy suspended after UK criticism",
    url: "https://www.bbc.com/news/world-middle-east-67876421",
    description: "Israeli government spokesperson Eylon Levy has been suspended from duties after criticising the UK...",
    position: 1,
    source: 'news',
    type: 'news',
    date: "2023-12-15"
  },
  {
    title: "Eylon Levy's suspension shows the limits of Israel's PR campaign",
    url: "https://www.nytimes.com/2023/12/18/world/middleeast/israel-eylon-levy-uk-weapons.html",
    description: "The sudden suspension of Eylon Levy, a polished and forceful Israeli government spokesperson...",
    position: 2,
    source: 'news',
    type: 'news',
    date: "2023-12-18"
  },
  // Add more mock news results
];

export const useMockDataForSeoSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [newsResults, setNewsResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [newsCount, setNewsCount] = useState(0);

  const searchGoogle = async (query: string) => {
    setIsLoading(true);
    setError(null);
    setResults([]);
    setNewsResults([]);
    
    // Simulate network delay
    setTimeout(() => {
      if (query.toLowerCase().includes('eylon levy')) {
        setResults(MOCK_ORGANIC_RESULTS);
        setNewsResults(MOCK_NEWS_RESULTS);
        setTotalCount(MOCK_ORGANIC_RESULTS.length);
        setNewsCount(MOCK_NEWS_RESULTS.length);
      } else {
        // Default behavior for other searches
        setResults(MOCK_ORGANIC_RESULTS.slice(0, 2));
        setNewsResults([]);
        setTotalCount(2);
        setNewsCount(0);
      }
      
      setIsLoading(false);
    }, 1500);
  };

  return {
    results,
    newsResults,
    totalCount,
    newsCount,
    isLoading,
    error,
    rawData: null,
    searchGoogle
  };
}; 