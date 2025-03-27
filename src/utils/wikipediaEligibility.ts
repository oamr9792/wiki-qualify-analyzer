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
  domainCitations: Record<string, number> = {},
  foundWikipediaUrl?: string
): WikipediaEligibilityResult {
  console.log("RUNNING FIXED ELIGIBILITY ASSESSMENT!");

  // Handle existing Wikipedia page
  const hasExistingWikipedia = !!foundWikipediaUrl;
  if (hasExistingWikipedia) {
    return {
      eligible: true,
      score: 100,
      hasExistingWikipedia: true,
      existingWikipediaUrl: foundWikipediaUrl,
      reasons: ['The topic already has a Wikipedia page.'],
      suggestedAction: 'This topic already has a Wikipedia page.',
      reliableSources: {
        highlyReliable: 0,
        moderatelyReliable: 0,
        unreliable: 0,
        deprecated: 0
      },
      sourcesList: [],
      categorizedSources: {
        highlyReliable: [],
        reliableNoMention: [],
        contextualMention: [],
        unreliable: []
      }
    };
  }

  // Initialize variables
  let displayScore = 0;
  let eligible = false;
  const reasons: string[] = [];
  let suggestedAction = '';
  
  // Initialize counters
  const reliableSources = {
    highlyReliable: 0,
    moderatelyReliable: 0,
    unreliable: 0,
    deprecated: 0
  };
  
  // Analyze all sources
  const sourcesList: AnalyzedSource[] = [];
  
  // Process all search results
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
  
  // Categorize sources
  const categorizedSources = categorizeSources(sourcesList, query, organicResults, newsResults);
  
  // Get counts
  const highlyReliableCount = categorizedSources.highlyReliable.length;
  const uniqueDomains = new Set(categorizedSources.highlyReliable.map(s => s.domain)).size;
  
  // Track domain counts for scoring with true diminishing returns
  const domainScores = new Map<string, number>();

  // IMPORTANT: Sort all sources by domain first to process sources from the same domain together
  const allSourcesToScore = [
    ...categorizedSources.highlyReliable.map(s => ({...s, basePoints: 20})),
    ...categorizedSources.contextualMention.map(s => ({...s, basePoints: 7})),
    ...categorizedSources.reliableNoMention.map(s => ({...s, basePoints: 3}))
  ];

  // Sort by domain so same domains are processed together
  allSourcesToScore.sort((a, b) => a.domain.localeCompare(b.domain));

  // Reset score
  displayScore = 0;

  // Process all sources in a single loop with proper diminishing returns AND domain cap
  console.log("SCORING WITH DIMINISHING RETURNS AND DOMAIN CAP (MAX 3):");
  allSourcesToScore.forEach(source => {
    // Get current count for this domain
    const currentCount = domainScores.get(source.domain) || 0;
    
    // Only score up to 3 sources from the same domain
    if (currentCount < 3) {
      // Calculate diminishing factor - starts at 1.0, then 0.85, then 0.7225
      const diminishingFactor = Math.pow(0.85, currentCount);
      
      // Calculate points with diminishing returns
      const points = source.basePoints * diminishingFactor;
      
      // Add to total score
      displayScore += points;
      
      // Log details
      console.log(`${source.domain} (#${currentCount + 1}): ${points.toFixed(2)} points (base: ${source.basePoints})`);
    } else {
      // Log that we're ignoring this source due to domain cap
      console.log(`${source.domain} (#${currentCount + 1}): IGNORED - Exceeded domain cap of 3`);
    }
    
    // Increment domain count regardless of whether we scored it
    domainScores.set(source.domain, currentCount + 1);
  });

  // Log domain totals
  console.log("DOMAIN TOTALS:");
  const domainTotals = new Map<string, number>();
  for (const [domain, count] of domainScores.entries()) {
    let total = 0;
    for (let i = 0; i < count; i++) {
      // Recalculate the score for each occurrence to show diminishing returns
      const categorySource = allSourcesToScore.find(s => s.domain === domain);
      if (categorySource) {
        const factor = Math.pow(0.85, i);
        total += categorySource.basePoints * factor;
      }
    }
    domainTotals.set(domain, total);
    console.log(`${domain}: ${count} occurrences, ${total.toFixed(2)} points total`);
  }

  // Round score and apply limits
  displayScore = Math.min(100, Math.round(displayScore));
  displayScore = Math.max(5, displayScore);
  
  // Set eligibility based on score
  eligible = displayScore >= 66;
  
  // Create accurate descriptive text based on actual counts
  if (displayScore >= 75) {
    suggestedAction = "Create a Wikipedia article with these reliable sources";
    reasons.push(`Strong potential. Found ${highlyReliableCount} reliable sources (from ${uniqueDomains} different domains) that specifically mention this topic. This exceeds Wikipedia's notability requirements.`);
  } else if (displayScore >= 66) {
    suggestedAction = "Consider creating a Wikipedia draft, but it may require additional sources";
    reasons.push(`Good potential. Found ${highlyReliableCount} reliable sources (from ${uniqueDomains} different domains) that specifically mention this topic. This meets Wikipedia's minimum notability threshold.`);
  } else if (displayScore >= 46) {
    suggestedAction = "Almost eligible. Find more reliable sources that specifically mention this topic.";
    reasons.push(`Moderate potential. Found ${highlyReliableCount} reliable sources that specifically mention this topic. This approaches Wikipedia's notability requirements but needs more coverage.`);
  } else {
    suggestedAction = "Not eligible. Wikipedia requires more coverage in reliable, independent sources.";
    reasons.push(`Limited potential. Found ${highlyReliableCount} reliable sources that specifically mention this topic. Wikipedia typically requires at least 3 reliable sources from different publishers.`);
  }
  
  // Return the assessment result
  return {
    eligible,
    score: displayScore,
    hasExistingWikipedia,
    existingWikipediaUrl: foundWikipediaUrl,
    reasons,
    suggestedAction,
    reliableSources,
    sourcesList,
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
    
    // Check for FULL keyword match in title, URL, or meta description - using EXACT matching
    const hasFullKeywordInTitle = matchingResult.title?.toLowerCase().includes(normalizedQuery);

    // For URL check, be much more strict about how we detect the keyword
    const urlLower = matchingResult.url.toLowerCase();
    // Only use limited URL variants to prevent false positives
    const urlVariants = [
      normalizedQuery,
      normalizedQuery.replace(/\s+/g, '-'),
      normalizedQuery.replace(/\s+/g, '_') 
    ];

    // Use word boundary checks for URL to avoid partial matches
    const hasFullKeywordInUrl = urlVariants.some(variant => {
      // Check if the URL contains the variant with word boundaries
      // This helps prevent partial word matches
      return (
        // URL contains the exact variant
        urlLower.includes('/' + variant + '/') || 
        urlLower.includes('/' + variant + '.') ||
        urlLower.endsWith('/' + variant) ||
        // Or it's part of the domain (for branded domains)
        urlLower.includes(variant + '.com') ||
        urlLower.includes(variant + '.org') ||
        urlLower.includes(variant + '.net')
      );
    });

    // For meta description, require EXACT full match
    const descriptionLower = matchingResult.description?.toLowerCase() || '';
    // Only count as a match if the EXACT normalized query is in the description
    const hasFullKeywordInMeta = descriptionLower.includes(normalizedQuery);

    // Add super detailed logging to debug the matches
    console.log(`🔍 STRICT DETECTION for ${source.domain}:
      Query: "${normalizedQuery}"
      Title: "${matchingResult.title}"
      URL: "${matchingResult.url}" 
      Description: "${descriptionLower.substring(0, 100)}..."
      
      Title includes exact query: ${hasFullKeywordInTitle}
      URL includes exact query variants: ${hasFullKeywordInUrl}
      Meta includes exact query: ${hasFullKeywordInMeta}
      
      Result: ${(hasFullKeywordInTitle || hasFullKeywordInUrl || hasFullKeywordInMeta) ? 'RELIABLE SOURCE' : 'NOT A RELIABLE SOURCE'}
    `);

    // VERY STRICT RULE: full keyword MUST be in title/URL/meta EXACTLY as searched
    if (hasFullKeywordInTitle || hasFullKeywordInUrl || hasFullKeywordInMeta) {
      console.log(`  ✅ RELIABLE SOURCE: ${source.domain}`);
      console.log(`    Contains EXACT search term "${normalizedQuery}" in: ${hasFullKeywordInTitle ? 'TITLE' : ''} ${hasFullKeywordInUrl ? 'URL' : ''} ${hasFullKeywordInMeta ? 'META' : ''}`);
      categorizedSources.highlyReliable.push(source);
    } else {
      // If not in metadata, check for contextual mentions
      
      // Only consider it a contextual mention if the FULL search term appears in description
      const hasExactTermInDescription = descriptionLower.includes(normalizedQuery);
      
      // Check for common variants only for multi-word queries
      const hasVariantInDescription = normalizedQuery.includes(' ') && 
        urlVariants.some(variant => 
          variant !== normalizedQuery && descriptionLower.includes(variant)
        );
      
      if (hasExactTermInDescription || hasVariantInDescription) {
        console.log(`  ⚠️ CONTEXTUAL MENTION: ${source.domain}`);
        console.log(`    Full search term found in description text but not in title/URL/meta`);
        categorizedSources.contextualMention.push(source);
      } else {
        console.log(`  ❌ NO MENTION: ${source.domain}`);
        console.log(`    No evidence of full search term mention`);
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