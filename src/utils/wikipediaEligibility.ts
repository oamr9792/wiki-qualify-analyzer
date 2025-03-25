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

  // Check for existing Wikipedia article
  const wikipediaResult = [...organicResults, ...newsResults].find(r => 
    r.url.includes('wikipedia.org/wiki/') && 
    !r.url.includes('wikipedia.org/wiki/Category:') &&
    !r.url.includes('wikipedia.org/wiki/Wikipedia:') &&
    !r.url.includes('wikipedia.org/wiki/Template:') &&
    !r.url.includes('wikipedia.org/wiki/Portal:')
  );
  
  if (wikipediaResult) {
    hasExistingWikipedia = true;
    existingWikipediaUrl = wikipediaResult.url;
    score += 100; // Give maximum score for existing articles
    reasons.push("Topic already has a Wikipedia article");
  }
  
  // Analyze sources from search results
  [...organicResults, ...newsResults].forEach(result => {
    // Exclude Wikipedia from source analysis
    if (result.url.includes('wikipedia.org')) return;
    
    try {
      const domain = getEffectiveDomain(result.url);
      const citationCount = domainCitations[domain] || 0;
      
      // Get reliability with citation count
      const reliability = getSourceReliability(result.url, citationCount);
      
      let category: 'highlyReliable' | 'moderatelyReliable' | 'unreliable' | 'deprecated';
      let relevanceMultiplier = 1.0; // Default full weight
      
      // Check if keyword is in title or URL (case insensitive)
      const hasKeywordInTitle = result.title.toLowerCase().includes(query.toLowerCase());
      const hasKeywordInUrl = result.url.toLowerCase().includes(query.toLowerCase());
      
      // Reduce weight for results that don't contain the keyword in title or URL
      if (!hasKeywordInTitle && !hasKeywordInUrl) {
        relevanceMultiplier = 0.5; // 50% weight for less relevant results
      }
      
      if (reliability.reliability === "Generally reliable") {
        reliableSources.highlyReliable += relevanceMultiplier;
        category = 'highlyReliable';
      } else if (reliability.reliability === "No consensus") {
        reliableSources.moderatelyReliable += relevanceMultiplier;
        category = 'moderatelyReliable';
      } else if (reliability.reliability === "Generally unreliable") {
        reliableSources.unreliable += relevanceMultiplier;
        category = 'unreliable';
      } else {
        reliableSources.deprecated += relevanceMultiplier;
        category = 'deprecated';
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
  
  // Cap the score at 100
  score = Math.min(100, Math.max(0, score));
  
  // Determine eligibility based on score and other factors
  // If there's an existing Wikipedia article, it's automatically eligible
  const eligible = hasExistingWikipedia || (score > 70 && reliableSources.highlyReliable >= 3);
  
  // Determine suggested action
  if (hasExistingWikipedia) {
    suggestedAction = "View or improve the existing Wikipedia article";
  } else if (eligible) {
    suggestedAction = "Consider creating a Wikipedia article with these reliable sources";
  } else if (score > 40) {
    suggestedAction = "Potentially eligible, but needs more reliable sources";
  } else {
    suggestedAction = "Topic likely does not meet Wikipedia's notability guidelines";
  }
  
  return {
    eligible,
    score,
    hasExistingWikipedia,
    existingWikipediaUrl,
    reasons,
    suggestedAction,
    reliableSources,
    sourcesList: uniqueSources
  };
} 