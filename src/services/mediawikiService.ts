// MediaWiki API citation counting service
import { useCallback, useState } from 'react';
import { getEffectiveDomain } from '@/utils/domainUtils';

// Cache to store domain citation counts to avoid repeated API calls
const citationCountCache: Record<string, number> = {};

// Add a debounce mechanism to prevent too many rapid calls
let pendingRequests = new Map();

export interface MediaWikiResponse {
  count: number;
  loading: boolean;
  error: string | null;
}

export const useMediaWikiCitations = () => {
  const [state, setState] = useState<MediaWikiResponse>({
    count: 0,
    loading: false,
    error: null
  });

  /**
   * Get citation count for a domain from MediaWiki API
   * @param domain The domain to check (e.g., nytimes.com)
   */
  const getCitationCount = useCallback(async (domain: string) => {
    // Normalize the domain to handle localized versions
    const normalizedDomain = getEffectiveDomain(domain);
    
    // Return from cache if available
    if (citationCountCache[normalizedDomain]) {
      setState({
        count: citationCountCache[normalizedDomain],
        loading: false,
        error: null
      });
      return;
    }

    setState(prevState => ({ ...prevState, loading: true, error: null }));

    try {
      // Use the English Wikipedia API for searches
      const apiUrl = new URL('https://en.wikipedia.org/w/api.php');
      
      // Set query parameters
      const params = {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: `insource:${normalizedDomain}`,
        srlimit: '50',
        origin: '*' // Required for CORS
      };
      
      Object.entries(params).forEach(([key, value]) => {
        apiUrl.searchParams.append(key, value);
      });

      const response = await fetch(apiUrl.toString());
      const data = await response.json();
      
      // Get total number of matches
      const totalHits = data.query?.searchinfo?.totalhits || 0;
      
      // Cache the result with the normalized domain
      citationCountCache[normalizedDomain] = totalHits;
      
      setState({
        count: totalHits,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error("Error fetching citation count:", error);
      setState(prevState => ({
        ...prevState,
        count: 0,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }));
    }
  }, []);

  return {
    ...state,
    getCitationCount
  };
};

/**
 * Calculate reliability score based on citation count
 * @param citationCount Number of citations on Wikipedia
 * @returns Reliability score between 0-10
 */
export const calculateReliabilityScore = (citationCount: number): number => {
  if (citationCount >= 1000) return 10; // Highly cited
  if (citationCount >= 500) return 8;
  if (citationCount >= 200) return 7;
  if (citationCount >= 100) return 6;
  if (citationCount >= 50) return 5;  // Moderate
  if (citationCount >= 10) return 4;
  if (citationCount >= 5) return 3;
  return 2; // Very low citation count
};

/**
 * Fetches the number of times a domain is cited across Wikipedia
 * @param domain The domain to check (e.g., "nytimes.com")
 * @returns The number of citations
 */
export async function getWikipediaCitationCount(domain: string): Promise<number> {
  // Return from cache if available
  if (domain in citationCountCache) {
    return citationCountCache[domain];
  }

  // Check if there's already a pending request for this domain
  if (pendingRequests.has(domain)) {
    return pendingRequests.get(domain);
  }

  // Create a new promise for this request
  const promise = new Promise<number>(async (resolve) => {
    // Add a small delay to batch requests
    await new Promise(r => setTimeout(r, 50));
    
    try {
      // Encode domain for URL safety
      const encodedDomain = encodeURIComponent(domain);
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=exturlusage&euquery=${encodedDomain}&eulimit=500&format=json&origin=*`;

      const response = await fetch(apiUrl);
      const data = await response.json();
      const citations = data?.query?.exturlusage ?? [];
      const count = citations.length;
      
      // Cache the result
      citationCountCache[domain] = count;
      resolve(count);
    } catch (error) {
      console.error(`Failed to fetch citation count for ${domain}:`, error);
      // Cache as 0 to prevent repeated failed requests
      citationCountCache[domain] = 0;
      resolve(0);
    } finally {
      // Remove from pending requests
      pendingRequests.delete(domain);
    }
  });
  
  // Store the pending request
  pendingRequests.set(domain, promise);
  return promise;
}

/**
 * Searches Wikipedia for existing pages about a subject
 * @param query The search query
 * @returns Search results from Wikipedia
 */
export async function searchWikipedia(query: string): Promise<any[]> {
  const encodedQuery = encodeURIComponent(query);
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&origin=*`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data?.query?.search || [];
  } catch (error) {
    console.error(`Failed to search Wikipedia for ${query}:`, error);
    return [];
  }
}

/**
 * Gets the intro extract from a Wikipedia page to verify relevance
 * @param title Wikipedia page title
 * @returns The intro extract text
 */
export async function getPageExtract(title: string): Promise<string> {
  const encodedTitle = encodeURIComponent(title);
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodedTitle}&format=json&origin=*`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    const pages = data?.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (pageId && pages[pageId]) {
      return pages[pageId].extract || '';
    }
    return '';
  } catch (error) {
    console.error(`Failed to get extract for ${title}:`, error);
    return '';
  }
}

/**
 * Calculate domain credibility score based on citation count and reliability
 * @param citationCount Number of Wikipedia citations
 * @param reliability Reliability score from 0-1
 * @returns Credibility score from 0-10
 */
export function calculateCredibilityScore(citationCount: number, reliability: number): number {
  // High reliability domains (≥0.8) get a score of 8
  if (reliability >= 0.8) {
    return 8;
  }
  
  // Low reliability domains (≤0.2) get a score of 2
  if (reliability <= 0.2) {
    return 2;
  }
  
  // Moderate reliability domains (0.2-0.8) are scored based on citations
  if (citationCount >= 100 && reliability >= 0.5) {
    return 7; // Authoritative
  } else if (citationCount >= 10 && reliability >= 0.3) {
    return 4; // Moderate
  } else {
    return 3; // Limited
  }
}

/**
 * Maps credibility score to reliability category
 * @param score Credibility score from 0-10
 * @returns Reliability category
 */
export function mapScoreToCategory(score: number): 'highlyReliable' | 'moderatelyReliable' | 'unreliable' {
  if (score >= 7) {
    return 'highlyReliable';
  } else if (score >= 4) {
    return 'moderatelyReliable';
  } else {
    return 'unreliable';
  }
}

/**
 * Evaluates the reliability level of a domain based on citation count
 * using a conservative scoring algorithm
 * @param citationCount Number of citations
 * @returns Reliability rating
 */
export const getCitationBasedReliability = (citationCount: number): string => {
  // More realistic thresholds for Wikipedia citations
  if (citationCount >= 500) {
    return "Generally reliable";
  } else if (citationCount >= 100) {
    return "No consensus";
  } else {
    return "No consensus";
  }
}; 