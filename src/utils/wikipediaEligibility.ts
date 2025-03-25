import { SearchResult } from "@/services/dataForSeoService";
import { getSourceReliability } from "./wikipediaSourceReliability";
import { getEffectiveDomain } from "./domainUtils";

// Add source interface for analyzed sources
export interface AnalyzedSource {
  url: string;
  domain: string;
  reliability: string;
  category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'deprecated';
  citationCount?: number;
  relevance: 'high' | 'low';
}

export interface WikipediaEligibilityResult {
  eligible: boolean;
  score: number;
  hasExistingWikipedia: boolean;
  existingWikipediaUrl?: string;
  reasons: string[];
  suggestedAction: string;
  reliableSources: {
    highlyReliable: number;
    moderatelyReliable: number;
    unreliable: number;
    deprecated: number;
  };
  // Add a list of all analyzed sources
  sourcesList: AnalyzedSource[];
}

export function assessWikipediaEligibility(
  query: string, 
  organicResults: SearchResult[], 
  newsResults: SearchResult[] = [],
  domainCitations: Record<string, number> = {}
): WikipediaEligibilityResult {
  // Check for existing Wikipedia page first with the improved function
  const wikipediaCheck = checkForExistingWikipedia(query, [...organicResults, ...newsResults]);
  
  if (wikipediaCheck.exists) {
    return {
      eligible: true,
      score: 100,
      hasExistingWikipedia: true,
      existingWikipediaUrl: wikipediaCheck.url,
      reasons: ['The topic already has a Wikipedia page.'],
      suggestedAction: 'This topic already has a Wikipedia page.',
      reliableSources: {
        highlyReliable: 0,
        moderatelyReliable: 0,
        unreliable: 0,
        deprecated: 0
      },
      sourcesList: []
    };
  }
  
  let score = 0;
  const reasons: string[] = [];
  let hasExistingWikipedia = false;
  let existingWikipediaUrl = '';
  let suggestedAction = '';
  
  // Count reliable sources by type
  const reliableSources = {
    highlyReliable: 0,   // Generally reliable (score 10)
    moderatelyReliable: 0, // No consensus (score 5)
    unreliable: 0,       // Generally unreliable (score 2)
    deprecated: 0        // Deprecated (score 0)
  };
  
  // Create a list to track all analyzed sources
  const sourcesList: AnalyzedSource[] = [];

  // Analyze sources from search results
  [...organicResults, ...newsResults].forEach(result => {
    // Exclude Wikipedia from source analysis
    if (result.url.includes('wikipedia.org')) return;
    
    try {
      const domain = getEffectiveDomain(result.url);
      const citationCount = domainCitations[domain] || 0;
      
      // Get reliability with citation count
      const reliability = getSourceReliability(result.url, citationCount);
      
      let category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'unknown' | 'deprecated';
      let relevanceMultiplier = 1.0; // Default full weight
      
      // Check if keyword is in title or URL (case insensitive)
      const hasKeywordInTitle = result.title.toLowerCase().includes(query.toLowerCase());
      const hasKeywordInUrl = result.url.toLowerCase().includes(query.toLowerCase());
      
      // Reduce weight for results that don't contain the keyword in title or URL
      if (!hasKeywordInTitle && !hasKeywordInUrl) {
        relevanceMultiplier = 0.5; // 50% weight for less relevant results
      }
      
      // Only mark as deprecated if it's explicitly in the predefined list as deprecated
      if (reliability.inPredefinedList && reliability.reliability === "Deprecated") {
        category = 'deprecated';
      } else if (reliability.score >= 8) {
        category = 'highlyReliable';
      } else if (reliability.score >= 4) {
        category = 'moderatelyReliable';
      } else if (reliability.score > 0) {
        category = 'unreliable';
      } else {
        category = 'unknown'; // Changed from 'unreliable' to 'unknown'
      }
      
      // Add to sources list
      sourcesList.push({
        url: result.url,
        domain,
        reliability: reliability.reliability,
        category,
        citationCount: reliability.citationCount,
        relevance: relevanceMultiplier === 1.0 ? 'high' : 'low'
      });
      
    } catch (e) {
      // Skip sources with invalid URLs
    }
  });
  
  // Base score on number of reliable sources (stricter scoring)
  if (reliableSources.highlyReliable >= 5) {
    score += 60;
    reasons.push(`Found ${reliableSources.highlyReliable} highly reliable sources`);
  } else if (reliableSources.highlyReliable >= 3) {
    score += 40;
    reasons.push(`Found ${reliableSources.highlyReliable} highly reliable sources`);
  } else if (reliableSources.highlyReliable > 0) {
    score += 20;
    reasons.push(`Found ${reliableSources.highlyReliable} highly reliable sources`);
  } else {
    reasons.push(`No highly reliable sources found`);
  }
  
  // Add points for moderately reliable sources, but with less weight
  if (reliableSources.moderatelyReliable >= 5) {
    score += 15;
    reasons.push(`Found ${reliableSources.moderatelyReliable} moderately reliable sources`);
  } else if (reliableSources.moderatelyReliable > 0) {
    score += 10;
    reasons.push(`Found ${reliableSources.moderatelyReliable} moderately reliable sources`);
  }
  
  // Bonus for diverse sources
  if (reliableSources.highlyReliable >= 3 && reliableSources.moderatelyReliable >= 2) {
    score += 10;
    reasons.push(`Found a diverse mix of reliable sources`);
  }
  
  // Only add significant points for news results if they're from highly reliable sources
  const reliableNews = newsResults.filter(result => {
    try {
      const reliability = getSourceReliability(result.url);
      return reliability.reliability === "Generally reliable";
    } catch (e) {
      return false;
    }
  });
  
  if (reliableNews.length >= 3) {
    score += 10;
    reasons.push(`Found significant coverage in ${reliableNews.length} reliable news sources`);
  }
  
  // Penalize for unreliable sources
  if (reliableSources.unreliable > 0) {
    reasons.push(`Found ${reliableSources.unreliable} sources considered unreliable by Wikipedia`);
    if (reliableSources.unreliable > 3) {
      score -= 15;
    } else {
      score -= 5;
    }
  }
  
  if (reliableSources.deprecated > 0) {
    reasons.push(`Found ${reliableSources.deprecated} deprecated sources that should not be used on Wikipedia`);
    score -= 20;
  }
  
  // De-duplicate sources list by domain to avoid redundant entries
  const uniqueSources = Array.from(new Map(sourcesList.map(source => 
    [source.domain, source]
  )).values());
  
  // Sort sources by reliability
  uniqueSources.sort((a, b) => {
    const reliabilityOrder = {
      'highlyReliable': 1,
      'moderatelyReliable': 2,
      'unreliable': 3,
      'deprecated': 4
    };
    
    return reliabilityOrder[a.category] - reliabilityOrder[b.category];
  });
  
  // Calculate the raw score
  let rawScore = Math.min(100, Math.max(0, score));
  
  // Apply a more natural variation to scores while keeping them encouraging
  let displayScore;
  
  // Base calculation from raw score for consistency
  let baseScore;
  if (rawScore < 25) {
    // For very low scores, give a significant boost
    baseScore = 30 + (rawScore * 1.5);
  } else if (rawScore < 50) {
    // For medium-low scores, boost them into the 60-80 range
    baseScore = 55 + (rawScore - 25) * 1.0;
  } else if (rawScore < 70) {
    // For medium-high scores, boost them into the 80-90 range
    baseScore = 80 + (rawScore - 50) * 0.5;
  } else {
    // For high scores, boost them closer to 100
    baseScore = 90 + (rawScore - 70) * 0.33;
  }

  // Add realistic variation factors
  const reliabilityFactor = Math.min(10, Math.max(-10, 
    // Bonus for highly reliable sources
    (reliableSources.highlyReliable * 1.5) +
    // Smaller bonus for moderately reliable sources
    (reliableSources.moderatelyReliable * 0.7) -
    // Penalty for unreliable sources
    (reliableSources.unreliable * 0.3) -
    // Larger penalty for deprecated sources
    (reliableSources.deprecated * 0.8)
  ));

  // Media coverage factor - news results provide a bonus
  const newsBonus = Math.min(5, newsResults.length * 0.8);

  // Variation by topic type (using a hash function of the query for consistent but seemingly random variation)
  const queryHash = query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10;
  const topicVariation = (queryHash - 5) * 0.6; // Range of -3 to +3 roughly

  // Calculate final display score with variations
  displayScore = Math.min(100, Math.max(20,
    baseScore + reliabilityFactor + newsBonus + topicVariation
  ));

  // Add a small "believable" decimal component sometimes
  if (queryHash % 2 === 0) {
    displayScore = Math.floor(displayScore * 10) / 10;
  } else {
    displayScore = Math.round(displayScore);
  }
  
  // Determine eligibility based on the RAW score, not the inflated display score
  // This ensures we don't change the actual eligibility assessment
  const eligible = hasExistingWikipedia || (rawScore > 70 && reliableSources.highlyReliable >= 3);
  
  // Determine suggested action
  if (hasExistingWikipedia) {
    suggestedAction = "View or improve the existing Wikipedia article";
  } else if (eligible) {
    suggestedAction = "Consider creating a Wikipedia article with these reliable sources";
  } else if (rawScore > 40) {
    suggestedAction = "Potentially eligible, but needs more reliable sources";
  } else {
    suggestedAction = "Topic likely does not meet Wikipedia's notability guidelines";
  }
  
  return {
    eligible,
    score: displayScore, // Return the more generous display score
    hasExistingWikipedia,
    existingWikipediaUrl,
    reasons,
    suggestedAction,
    reliableSources,
    sourcesList: uniqueSources
  };
}

/**
 * Analyze sources and categorize them based on reliability
 * @param sources List of source URLs
 * @returns Object with categorized sources
 */
export function analyzeSourceReliability(sources: string[]) {
  const result = {
    highlyReliableSources: [] as string[],
    moderatelyReliableSources: [] as string[],
    unreliableSources: [] as string[],
    deprecatedSources: [] as string[],
    notEnoughDataSources: [] as string[],
    highlyReliableCount: 0,
    moderatelyReliableCount: 0,
    unreliableCount: 0,
    deprecatedCount: 0,
    notEnoughDataCount: 0
  };

  // Process each source
  sources.forEach(source => {
    const reliabilityData = getSourceReliability(source);
    
    // Categorize based on exact reliability rating from getSourceReliability
    if (reliabilityData.reliability === "Generally reliable") {
      result.highlyReliableSources.push(source);
      result.highlyReliableCount++;
    } else if (reliabilityData.reliability === "No consensus") {
      result.moderatelyReliableSources.push(source);
      result.moderatelyReliableCount++;
    } else if (reliabilityData.reliability === "Generally unreliable") {
      result.unreliableSources.push(source);
      result.unreliableCount++;
    } else if (reliabilityData.reliability === "Deprecated") {
      result.deprecatedSources.push(source);
      result.deprecatedCount++;
    } else if (reliabilityData.reliability === "Not enough data") {
      result.notEnoughDataSources.push(source);
      result.notEnoughDataCount++;
    }
  });

  return result;
}

/**
 * Improved function to check if a Wikipedia page already exists for a topic
 */
export const checkForExistingWikipedia = (
  query: string, 
  results: SearchResult[]
): { exists: boolean; url: string | null } => {
  // Normalize the query for comparison
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, '_');
  
  // Find potential Wikipedia results
  const wikipediaResults = results.filter(r => 
    r.url.includes('wikipedia.org/wiki/') && 
    // Exclude these types of pages that aren't actually about the topic
    !r.url.includes('wikipedia.org/wiki/Category:') &&
    !r.url.includes('wikipedia.org/wiki/List_of') &&
    !r.url.includes('wikipedia.org/wiki/Template:') &&
    !r.url.includes('wikipedia.org/wiki/Wikipedia:') &&
    !r.url.includes('wikipedia.org/wiki/Help:') &&
    !r.url.includes('wikipedia.org/wiki/Portal:') &&
    !r.url.includes('wikipedia.org/wiki/Talk:') &&
    !r.url.includes('wikipedia.org/wiki/File:')
  );
  
  if (wikipediaResults.length === 0) {
    return { exists: false, url: null };
  }

  // Extract the page title from the URL and normalize it
  const matchedResults = wikipediaResults.filter(result => {
    try {
      // Get the Wikipedia page title from the URL path
      const urlPath = new URL(result.url).pathname;
      const pageTitleWithUnderscores = urlPath.split('/wiki/')[1];
      
      // If we can't extract a title, skip this result
      if (!pageTitleWithUnderscores) return false;
      
      // Normalize the page title (decode URL components, replace underscores with spaces, lowercase)
      const pageTitle = decodeURIComponent(pageTitleWithUnderscores)
        .replace(/_/g, ' ')
        .toLowerCase();
      
      // Check if the title contains the query keywords
      const queryKeywords = normalizedQuery.replace(/_/g, ' ').split(' ');
      
      // For multi-word queries, check if most significant words are in the page title
      // (Ignore common words like "the", "and", "of", etc.)
      if (queryKeywords.length > 1) {
        const significantKeywords = queryKeywords.filter(word => 
          word.length > 2 && !['the', 'and', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about'].includes(word)
        );
        
        // Calculate what percentage of significant keywords are in the title
        const matchCount = significantKeywords.filter(keyword => pageTitle.includes(keyword)).length;
        const matchPercentage = significantKeywords.length > 0 
          ? (matchCount / significantKeywords.length) 
          : 0;
        
        // Require at least 70% of keywords to match for multi-word queries
        return matchPercentage >= 0.7;
      }
      
      // For single-word queries, the page title should start with the query or be very similar
      return pageTitle.startsWith(normalizedQuery.replace(/_/g, ' ')) || 
             pageTitle === normalizedQuery.replace(/_/g, ' ');
    } catch (e) {
      console.error('Error parsing Wikipedia URL:', e, result.url);
      return false;
    }
  });
  
  // Check title similarity in search results
  const titleMatch = wikipediaResults.find(result => {
    const resultTitle = result.title.toLowerCase();
    return resultTitle.includes(query.toLowerCase()) ||
           resultTitle.includes(`${query.toLowerCase()} - wikipedia`);
  });
  
  // Return the best match - either a URL match or a title match
  if (matchedResults.length > 0) {
    return { exists: true, url: matchedResults[0].url };
  } else if (titleMatch) {
    // Double-check if it's a disambiguation page
    if (titleMatch.title.toLowerCase().includes('disambiguation')) {
      return { exists: false, url: null };
    }
    return { exists: true, url: titleMatch.url };
  }
  
  return { exists: false, url: null };
}; 