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
  sourcesList: AnalyzedSource[];
  categorizedSources?: {
    highlyReliable: AnalyzedSource[];
    reliableNoMention: AnalyzedSource[];
    contextualMention: AnalyzedSource[];
    unreliable: AnalyzedSource[];
  };
}

export function assessWikipediaEligibility(
  query: string, 
  organicResults: SearchResult[], 
  newsResults: SearchResult[] = [],
  domainCitations: Record<string, number> = {}
): WikipediaEligibilityResult {
  // Add near the beginning of assessWikipediaEligibility function
  console.log("SEARCH RESULTS:", {
    organicCount: organicResults.length,
    newsCount: newsResults.length,
    organicUrls: organicResults.map(r => r.url),
    newsUrls: newsResults.length > 0 ? newsResults.map(r => r.url) : []
  });

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
  
  // Move this definition to the BEGINNING of the assessWikipediaEligibility function
  // (after initial Wikipedia check)
  let displayScore = 0;
  let eligible = false;
  const reasons: string[] = [];

  // Declare eligible here, before it's used
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
      let relevance: 'high' | 'low' = 'high'; // Default to high
      
      // Check if keyword is in title or URL (case insensitive)
      const hasKeywordInTitle = result.title.toLowerCase().includes(query.toLowerCase());
      const hasKeywordInUrl = result.url.toLowerCase().includes(query.toLowerCase());
      
      // When analyzing sources, be more strict about what counts as "high" relevance
      if (!hasKeywordInTitle && !hasKeywordInUrl) {
        relevanceMultiplier = 0.5; // 50% weight for less relevant results
        relevance = 'low';
      } else {
        // Check if the FULL keyword is present, not just parts of it
        const fullKeywordInTitle = result.title.toLowerCase().includes(query.toLowerCase());
        const fullKeywordInUrl = result.url.toLowerCase().includes(query.toLowerCase().replace(/\s+/g, '-')) || 
                                result.url.toLowerCase().includes(query.toLowerCase().replace(/\s+/g, '_'));
        
        relevance = (fullKeywordInTitle || fullKeywordInUrl) ? 'high' : 'low';
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
        relevance
      });
      
    } catch (e) {
      // Skip sources with invalid URLs
    }
  });
  
  // And before the categorizedSources call:
  console.log("SOURCE LIST BEFORE CATEGORIZATION:", sourcesList.map(s => ({ 
    domain: s.domain, 
    url: s.url, 
    category: s.category,
    relevance: s.relevance 
  })));

  // Improved source categorization with strict keyword matching
  const categorizedSources = categorizeSources(sourcesList, query, organicResults, newsResults);

  // Count truly reliable sources - only those that mention the full keyword
  const highlyReliableCount = categorizedSources.highlyReliable.length;
  // Add contextual mentions at half value (0.5 each)
  const contextualMentionValue = categorizedSources.contextualMention.length * 0.5;
  // Combined effective source count (whole number + fractional part)
  const effectiveSourceCount = highlyReliableCount + contextualMentionValue;

  // Log the detailed source analysis
  console.log("DETAILED SOURCE ANALYSIS:", {
    query,
    highlyReliable: categorizedSources.highlyReliable.map(s => s.domain),
    reliableNoMention: categorizedSources.reliableNoMention.map(s => s.domain),
    contextualMention: categorizedSources.contextualMention.map(s => s.domain),
    highlyReliableCount,
    contextualMentionValue,
    effectiveSourceCount
  });

  // Apply STRICT scoring based on the effective source count
  if (effectiveSourceCount < 1) {
    // No reliable sources = exactly 15
    displayScore = 15;
    eligible = false;
    reasons.push("No reliable sources found that specifically mention this topic. Wikipedia requires specific coverage.");
  } 
  else if (effectiveSourceCount < 2) {
    // Less than 2 effective sources (e.g., 1 reliable or 2 contextual) = 25-35
    displayScore = Math.floor(25 + (Math.random() * 11));
    eligible = false;
    reasons.push(`Found ${highlyReliableCount} reliable sources and ${categorizedSources.contextualMention.length} contextual mentions of this topic. Wikipedia typically requires at least 3 reliable sources.`);
  } 
  else if (effectiveSourceCount < 3) {
    // Less than 3 effective sources = 40-55
    displayScore = Math.floor(40 + (Math.random() * 16));
    eligible = false;
    reasons.push(`Found ${highlyReliableCount} reliable sources and ${categorizedSources.contextualMention.length} contextual mentions of this topic. This is approaching Wikipedia's notability requirements.`);
  } 
  else if (effectiveSourceCount < 4) {
    // Less than 4 effective sources = 60-70
    displayScore = Math.floor(60 + (Math.random() * 11));
    eligible = false;
    reasons.push(`Found ${highlyReliableCount} reliable sources and ${categorizedSources.contextualMention.length} contextual mentions of this topic. This approaches Wikipedia's notability threshold.`);
  } 
  else if (effectiveSourceCount < 5) {
    // Less than 5 effective sources = 70-80
    displayScore = Math.floor(70 + (Math.random() * 11));
    eligible = true;
    reasons.push(`Found ${highlyReliableCount} reliable sources and ${categorizedSources.contextualMention.length} contextual mentions of this topic. This meets Wikipedia's notability requirements.`);
  }
  else {
    // 5+ effective sources = 80-100
    displayScore = Math.floor(80 + (Math.random() * 21));
    eligible = true;
    reasons.push(`Found ${highlyReliableCount} reliable sources and ${categorizedSources.contextualMention.length} contextual mentions of this topic. This exceeds Wikipedia's notability requirements.`);
  }

  // Set the suggested action based on the reliable source count
  if (hasExistingWikipedia) {
    suggestedAction = "View or improve the existing Wikipedia article";
  } else if (eligible) {
    suggestedAction = "Consider creating a Wikipedia article with these reliable sources";
  } else if (effectiveSourceCount >= 3) {
    suggestedAction = "Approaching eligibility, but needs more high-quality reliable sources";
  } else if (effectiveSourceCount > 0) {
    suggestedAction = "Not currently eligible. Needs more reliable sources that specifically discuss this topic.";
  } else {
    suggestedAction = "Not eligible. Wikipedia requires coverage in reliable, independent sources.";
  }

  // Add clear debugging to help diagnose issues
  console.log("SOURCE ANALYSIS FINAL:", {
    query,
    effectiveSourceCount,
    score: displayScore,
    eligible,
    reasons,
    sourcesWithRelevance: sourcesList.map(s => ({
      domain: s.domain,
      category: s.category,
      relevance: s.relevance
    }))
  });

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
  
  // Define reliableSourcesCount for debug logging
  const reliableSourcesCount = sourcesList.filter(s => 
    s.category === 'highlyReliable' || s.category === 'moderatelyReliable'
  ).length;

  // Now the debug logging will work correctly
  console.log("Source analysis details:", {
    query,
    sourcesList,
    effectiveSourceCount,
    reliableSourcesText: reliableSourcesCount,
    highlyReliableCount: reliableSources.highlyReliable,
    moderatelyReliableCount: reliableSources.moderatelyReliable
  });

  // Add this right before returning from assessWikipediaEligibility
  console.log("CATEGORIZED SOURCES BEFORE RETURN:", {
    highlyReliable: categorizedSources.highlyReliable.length,
    highlyReliableDomains: categorizedSources.highlyReliable.map(s => s.domain),
    reliableNoMention: categorizedSources.reliableNoMention.length,
    reliableNoMentionDomains: categorizedSources.reliableNoMention.map(s => s.domain),
    unreliable: categorizedSources.unreliable.length,
    unreliableDomains: categorizedSources.unreliable.map(s => s.domain),
    contextualMention: categorizedSources.contextualMention.length,
    contextualMentionDomains: categorizedSources.contextualMention?.map(s => s.domain) || []
  });

  // Add this toward the end of the assessWikipediaEligibility function
  console.log("ANALYSIS COMPARISON:", {
    query: query,
    mainAnalysisCount: effectiveSourceCount,
    uiSourcesHighlyReliable: categorizedSources.highlyReliable.length,
    uiSourcesReliableNoMention: categorizedSources.reliableNoMention.length,
    uiSourcesUnreliable: categorizedSources.unreliable.length,
    summaryMessage: reasons[0]
  });

  return {
    eligible,
    score: displayScore,
    hasExistingWikipedia,
    existingWikipediaUrl,
    reasons,
    suggestedAction,
    reliableSources,
    sourcesList: uniqueSources,
    categorizedSources
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
  const normalizedQuery = query.trim().toLowerCase();

  // Only look for direct Wikipedia matches in the search results
  const wikipediaResult = results.find(result => {
    // Must be a Wikipedia URL
    if (!result.url.includes('wikipedia.org/wiki/')) {
      return false;
    }
    
    // Skip non-article pages
    if (
      result.url.includes('wikipedia.org/wiki/Category:') ||
      result.url.includes('wikipedia.org/wiki/Wikipedia:') ||
      result.url.includes('wikipedia.org/wiki/Template:') ||
      result.url.includes('wikipedia.org/wiki/Help:') ||
      result.url.includes('wikipedia.org/wiki/Portal:') ||
      result.url.includes('wikipedia.org/wiki/Talk:') ||
      result.url.includes('wikipedia.org/wiki/File:') ||
      result.url.includes('wikipedia.org/wiki/List_of')
    ) {
      return false;
    }
    
    // Check if the title matches our query (basic check)
    // The Wikipedia result title typically has " - Wikipedia" appended
    const titleWithoutSuffix = result.title
      .replace(/ - Wikipedia.*$/, '')
      .toLowerCase();
    
    // Direct match or very close match
    return titleWithoutSuffix === normalizedQuery || 
           normalizedQuery.includes(titleWithoutSuffix) || 
           titleWithoutSuffix.includes(normalizedQuery);
  });
  
  return {
    exists: !!wikipediaResult,
    url: wikipediaResult ? wikipediaResult.url : null
  };
};

// Update the categorization function to work properly
// Replace the existing categorizeSources function with this:

const categorizeSources = (sourcesList: AnalyzedSource[], query: string, organicResults: SearchResult[], newsResults: SearchResult[]) => {
  // Categories for sources
  const categorizedSources = {
    highlyReliable: [] as AnalyzedSource[],     // Domain reliable + full keyword in title/URL/meta
    reliableNoMention: [] as AnalyzedSource[],  // Domain reliable but doesn't mention full keyword
    contextualMention: [] as AnalyzedSource[],  // Keyword in content only, not in title/URL/meta 
    unreliable: [] as AnalyzedSource[]          // Not reliable/deprecated
  };
  
  // Add the missing findMatchingResult function
  const findMatchingResult = (sourceUrl: string, results: SearchResult[]): SearchResult | undefined => {
    // Normalize URLs for comparison by removing protocol and trailing slashes
    const normalizeUrl = (url: string) => {
      return url.replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/$/, '');
    };
    
    const normalizedSourceUrl = normalizeUrl(sourceUrl);
    
    return results.find(r => normalizeUrl(r.url) === normalizedSourceUrl);
  };
  
  // Track URLs we've already processed to avoid duplicates
  const processedUrls = new Set<string>();
  
  // Exact FULL query match required
  const normalizedQuery = query.toLowerCase().trim();
  
  // Process each source
  sourcesList.forEach(source => {
    // Skip if we've already processed this URL
    if (processedUrls.has(source.url)) {
      console.log(`  → Skipping duplicate URL: ${source.url}`);
      return;
    }
    
    // Add to processed URLs set
    processedUrls.add(source.url);
    
    console.log(`Processing source: ${source.domain} (${source.category})`);
    // First check if domain is reliable
    const isReliableDomain = source.category === 'highlyReliable' || source.category === 'moderatelyReliable';
    
    if (!isReliableDomain) {
      console.log(`  → Unreliable domain: ${source.domain}`);
      categorizedSources.unreliable.push(source);
      return;
    }
    
    // Get the matching search result to check title/URL/description
    const matchingResult = findMatchingResult(source.url, [...organicResults, ...newsResults]);
    
    if (!matchingResult) {
      console.log(`  → No matching result found for: ${source.url}`);
      categorizedSources.reliableNoMention.push(source);
      return;
    }
    
    // Check for FULL keyword match in title, URL, or meta description
    const hasFullKeywordInTitle = matchingResult.title?.toLowerCase().includes(normalizedQuery);

    // More thorough URL check with normalized variants
    const urlLower = matchingResult.url.toLowerCase();
    const queryVariants = [
      normalizedQuery,
      normalizedQuery.replace(/\s+/g, '-'),
      normalizedQuery.replace(/\s+/g, '_'),
      normalizedQuery.replace(/\s+/g, '+'),
      normalizedQuery.replace(/\s+/g, '')
    ];
    const hasFullKeywordInUrl = queryVariants.some(variant => urlLower.includes(variant));

    // Improved description check - be more thorough
    const descriptionLower = matchingResult.description?.toLowerCase() || '';
    const hasFullKeywordInMeta = descriptionLower.includes(normalizedQuery) || 
                                queryVariants.some(variant => descriptionLower.includes(variant));

    console.log(`DETECTION RESULTS for ${source.domain}:
      Query: "${normalizedQuery}"
      In Title: ${hasFullKeywordInTitle} 
      In URL: ${hasFullKeywordInUrl}
      In Meta: ${hasFullKeywordInMeta}
    `);

    // GENERAL RULE 1: If the full query appears in title, URL, or meta description, it's a highly reliable source
    if (hasFullKeywordInTitle || hasFullKeywordInUrl || hasFullKeywordInMeta) {
      console.log(`  → Highly reliable with specific mention: ${source.domain}`);
      categorizedSources.highlyReliable.push(source);
    } else {
      // Not in metadata - check for contextual mentions
      
      // GENERAL RULE 2: A contextual mention is when the FULL search term likely appears in content
      // We need several approaches since we don't have full content access
      const hasFullQueryInDescription = descriptionLower.includes(normalizedQuery);

      // Check additional variants of the search term
      const fullQueryVariants = [
        normalizedQuery,
        normalizedQuery.replace(/\s+/g, '-'),
        normalizedQuery.replace(/\s+/g, '_'),
        normalizedQuery.replace(/\s+/g, '.'),
        normalizedQuery.replace(/\s+/g, '') // No spaces
      ];

      // Check if any variant appears in the description
      const hasFullQueryVariantInDescription = fullQueryVariants.some(variant => 
        variant !== normalizedQuery && descriptionLower.includes(variant)
      );

      // Special handling for known content types (like Reuters articles)
      // Their descriptions often don't contain the full search term even when the article does
      const isLikelyContentMention = (
        // Special case for Reuters articles which often mention terms in content
        (source.domain.includes('reuters.com') && (
          descriptionLower.includes(normalizedQuery.split(' ')[0]) || 
          descriptionLower.includes(normalizedQuery.split(' ').pop() || '')
        )) ||
        // Check for URLs that suggest topic-specific coverage
        urlLower.includes(normalizedQuery.split(' ')[0]) ||
        // For pages about people, companies, or topics specifically
        urlLower.includes('/about/') ||
        urlLower.includes('/profile/') ||
        urlLower.includes('/bio/') ||
        urlLower.includes('/company/') ||
        urlLower.includes('/topic/')
      );

      // Log detection details  
      console.log(`  → Enhanced content analysis for contextual mention:
        Full search term in description: ${hasFullQueryInDescription}
        Variant in description: ${hasFullQueryVariantInDescription}
        Likely content mention based on patterns: ${isLikelyContentMention}
        
        URL: ${source.url}
        Description: "${descriptionLower.substring(0, 100)}..."
      `);
      
      // More aggressive detection of contextual mentions
      if (hasFullQueryInDescription || hasFullQueryVariantInDescription || isLikelyContentMention) {
        console.log(`  → Contextual mention detected: ${source.domain}`);
        
        // Log the specific reason for transparency
        if (hasFullQueryInDescription) {
          console.log(`    Reason: Full search term "${normalizedQuery}" found in description`);
        } else if (hasFullQueryVariantInDescription) {
          console.log(`    Reason: Variant of search term found in description`);
        } else {
          console.log(`    Reason: Content patterns suggest full mention in article`);
        }
        
        categorizedSources.contextualMention.push(source);
      } else {
        console.log(`  → Reliable domain but no mention: ${source.domain}`);
        categorizedSources.reliableNoMention.push(source);
      }
    }
  });
  
  console.log("FINAL CATEGORIZATION:", {
    highlyReliable: categorizedSources.highlyReliable.length,
    reliableNoMention: categorizedSources.reliableNoMention.length,
    contextualMention: categorizedSources.contextualMention.length,
    unreliable: categorizedSources.unreliable.length
  });
  
  return categorizedSources;
}; 