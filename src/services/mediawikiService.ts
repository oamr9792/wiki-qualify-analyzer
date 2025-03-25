// MediaWiki API citation counting service
import { useCallback, useState } from 'react';
import { getEffectiveDomain } from '@/utils/domainUtils';

// Cache to store domain citation counts to avoid repeated API calls
const citationCountCache: Record<string, number> = {};

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
 * Get the number of times a domain is cited across Wikipedia articles
 * using the exturlusage API endpoint directly
 * @param domain Domain to check (e.g., "nytimes.com")
 * @returns Promise resolving to citation count
 */
export const getWikipediaCitationCount = async (domain: string): Promise<number> => {
  // Return cached result if available
  if (citationCountCache[domain] !== undefined) {
    return citationCountCache[domain];
  }
  
  try {
    // Use exactly the API structure provided in the example
    const apiUrl = new URL('https://en.wikipedia.org/w/api.php');
    
    // Set parameters exactly as in the Python example
    apiUrl.searchParams.append('action', 'query');
    apiUrl.searchParams.append('list', 'exturlusage');
    apiUrl.searchParams.append('euquery', domain);
    apiUrl.searchParams.append('eulimit', '500');
    apiUrl.searchParams.append('format', 'json');
    apiUrl.searchParams.append('origin', '*'); // Required for CORS
    
    console.log(`Fetching citation count for ${domain} using: ${apiUrl.toString()}`);
    
    const response = await fetch(apiUrl.toString());
    
    if (!response.ok) {
      console.error(`Error fetching citation count for ${domain}: ${response.statusText}`);
      citationCountCache[domain] = 0;
      return 0;
    }
    
    const data = await response.json();
    
    // Extract citation list exactly as in the Python example
    const citations = data.query?.exturlusage || [];
    const citationCount = citations.length;
    
    console.log(`Citations found for ${domain}: ${citationCount}`);
    console.log('First few citations:', citations.slice(0, 3));
    
    // Cache the result
    citationCountCache[domain] = citationCount;
    
    return citationCount;
  } catch (error) {
    console.error(`Error in getWikipediaCitationCount for ${domain}:`, error);
    citationCountCache[domain] = 0;
    return 0;
  }
};

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